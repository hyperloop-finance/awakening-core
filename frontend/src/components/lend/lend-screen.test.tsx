import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { awakeningApi } from "@/lib/api/client";
import type { MarketDetail, Quote } from "@/lib/api/types";
import { LendScreen } from "./lend-screen";

const walletState = vi.hoisted(() => ({
  wallet: "0xdddddddddddddddddddddddddddddddddddddddd",
}));

vi.mock("@/components/shell/wallet", () => ({
  useWalletIdentity: () => ({ wallet: walletState.wallet, setDemoEnabled: vi.fn() }),
}));

const marketId = `0x${"a".repeat(64)}`;
const market: MarketDetail = {
  id: marketId,
  collateralAsset: "BTC",
  principalAsset: "USDC",
  maturity: "2027-09-01T00:00:00Z",
  fixedApr: "12.00",
  utilization: "41.20",
  availableLiquidity: "2500000.000000",
  offerDepth: "18",
  settlementState: "OPEN",
  contractsReady: false,
  collateralRatio: "1.500000",
  patCoverage: "100.20",
  minimumAmount: "100.000000",
};

const quote: Quote = {
  marketId,
  side: "LEND",
  principal: "1000",
  collateralRequirement: "0.015",
  interest: "120",
  protocolFee: "2.5",
  totalDueOrPayout: "1117.5",
  apr: "12.00",
  maturity: market.maturity,
  expiresAt: "2026-09-01T00:10:00Z",
  executionSteps: ["Review preview", "No on-chain transaction will be sent"],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

afterEach(() => vi.restoreAllMocks());

describe("LendScreen", () => {
  it("loads the market and applies its minimum, APR, and PAT coverage", async () => {
    const response = deferred<MarketDetail>();
    vi.spyOn(awakeningApi, "market").mockReturnValue(response.promise);
    render(<LendScreen marketId={marketId} side="LEND" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading market");
    response.resolve(market);

    expect(await screen.findByText("PAT coverage")).toBeInTheDocument();
    expect(screen.getByText("100.20%")).toBeInTheDocument();
    expect(screen.getByText("12.00%")).toBeInTheDocument();
    expect(screen.getByText("100.000000 USDC")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("USDC amount"), { target: { value: "99" } });
    expect(screen.getByText("Minimum amount is 100.000000.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calculate lend quote" })).toBeDisabled();
  });

  it("shows an unknown market API error and recovers on retry", async () => {
    const marketRequest = vi
      .spyOn(awakeningApi, "market")
      .mockRejectedValueOnce({ status: 404, detail: "Market not found" })
      .mockResolvedValueOnce(market);
    render(<LendScreen marketId={marketId} side="LEND" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Market not found");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("PAT coverage")).toBeInTheDocument();
    expect(marketRequest).toHaveBeenCalledTimes(2);
  });

  it("recovers from a quote endpoint error without losing market terms", async () => {
    vi.spyOn(awakeningApi, "market").mockResolvedValue(market);
    const quoteRequest = vi
      .spyOn(awakeningApi, "quote")
      .mockRejectedValueOnce({ status: 409, detail: "No lend capacity remains." })
      .mockResolvedValueOnce(quote);
    render(<LendScreen marketId={marketId} side="LEND" />);
    await screen.findByText("PAT coverage");

    fireEvent.click(screen.getByRole("button", { name: "Calculate lend quote" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No lend capacity remains.");
    expect(screen.getByText("100.20%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("1,117.5 USDC")).toBeInTheDocument();
    expect(quoteRequest).toHaveBeenCalledTimes(2);
  });

  it("quotes LEND, previews an unsigned scheme and payload, then simulates locally", async () => {
    vi.spyOn(awakeningApi, "market").mockResolvedValue(market);
    const quoteRequest = vi.spyOn(awakeningApi, "quote").mockResolvedValue(quote);
    const createOffer = vi.spyOn(awakeningApi, "createOffer");
    render(<LendScreen marketId={marketId} side="LEND" />);
    await screen.findByText("PAT coverage");

    const simulate = screen.getByRole("button", { name: "Simulate offer submission" });
    expect(simulate).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Calculate lend quote" }));

    expect(await screen.findByText("Total payout")).toBeInTheDocument();
    expect(screen.getByText("Interest").nextElementSibling).toHaveTextContent("120 USDC");
    expect(screen.getByText("Protocol fee").nextElementSibling).toHaveTextContent("2.5 USDC");
    expect(screen.getByText("Total payout").nextElementSibling).toHaveTextContent(
      "1,117.5 USDC",
    );
    expect(quoteRequest).toHaveBeenCalledWith(
      marketId,
      "LEND",
      "1000",
      expect.any(AbortSignal),
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview offer" }));
    expect(screen.getByText("Signing scheme").nextElementSibling).toHaveTextContent(
      "EIP191_MOCK",
    );
    expect(screen.getByLabelText("Unsigned offer payload")).toHaveTextContent(
      "Awakening Mock Offer",
    );
    expect(screen.getByLabelText("Unsigned offer payload")).toHaveTextContent(marketId);
    expect(screen.getByLabelText("Unsigned offer payload")).toHaveTextContent(
      `wallet:${walletState.wallet}`,
    );
    expect(simulate).toBeEnabled();

    fireEvent.click(simulate);
    expect(screen.getByText(/No signature or transaction was sent/)).toBeInTheDocument();
    expect(createOffer).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Live signature/ })).toBeDisabled();
  });

  it("clears a quote and offer preview when the amount changes", async () => {
    vi.spyOn(awakeningApi, "market").mockResolvedValue(market);
    vi.spyOn(awakeningApi, "quote").mockResolvedValue(quote);
    render(<LendScreen marketId={marketId} side="LEND" />);
    await screen.findByText("PAT coverage");
    fireEvent.click(screen.getByRole("button", { name: "Calculate lend quote" }));
    await screen.findByText("Total payout");
    fireEvent.click(screen.getByRole("button", { name: "Preview offer" }));

    fireEvent.change(screen.getByLabelText("USDC amount"), {
      target: { value: "1200" },
    });

    await waitFor(() => expect(screen.queryByText("Total payout")).not.toBeInTheDocument());
    expect(screen.queryByLabelText("Unsigned offer payload")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simulate offer submission" })).toBeDisabled();
  });
});
