import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { awakeningApi } from "@/lib/api/client";
import type { MarketDetail, Quote } from "@/lib/api/types";
import { LendScreen } from "./lend-screen";

const walletState = vi.hoisted(() => ({
  wallet: "0xdddddddddddddddddddddddddddddddddddddddd",
}));

vi.mock("@/components/shell/wallet", () => ({
  useWalletIdentity: () => ({ wallet: walletState.wallet, openWallet: vi.fn() }),
}));

const marketId = `0x${"a".repeat(64)}`;
const market: MarketDetail = {
  id: marketId,
  collateralAsset: "BTC",
  principalAsset: "USDC",
  maturity: "2027-09-01T00:00:00Z",
  fixedApr: "0.12",
  utilization: "0.42",
  availableLiquidity: "2500000.000000",
  offerDepth: "18",
  settlementState: "OPEN",
  contractsReady: false,
  collateralRatio: "1.500000",
  patCoverage: "0.95",
  minimumAmount: "100.000000",
  strike: "50000", patStatus: "VERIFIED_PREVIEW", patSource: "ATTESTED_CUSTODIAN_PREVIEW", borrowLevels: [], lendLevels: [],
};

const quote: Quote = {
  marketId,
  side: "LEND",
  principal: "1000",
  collateralRequirement: "0.00000000",
  interest: "29.589041",
  protocolFee: "3.000000",
  totalDueOrPayout: "1026.589041",
  apr: "0.12",
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
  it("uses the selected market's USDT unit throughout the lend ticket", async () => {
    const usdtMarket = {
      ...market,
      collateralAsset: "SPCXB",
      principalAsset: "USDT",
      availableLiquidity: "95000.00",
    };
    vi.spyOn(awakeningApi, "market").mockResolvedValue(usdtMarket);
    render(<LendScreen marketId={marketId} side="LEND" />);

    expect(await screen.findByText("95,000 USDT")).toBeInTheDocument();
    expect(screen.getByText("100.000000 USDT")).toBeInTheDocument();
    expect(screen.getByLabelText("USDT amount")).toBeInTheDocument();
    expect(screen.getByText("MOCK · LEND / USDT")).toBeInTheDocument();
  });

  it("loads the market and applies its minimum, APR, and PAT coverage", async () => {
    const response = deferred<MarketDetail>();
    vi.spyOn(awakeningApi, "market").mockReturnValue(response.promise);
    render(<LendScreen marketId={marketId} side="LEND" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading market");
    response.resolve(market);

    expect(await screen.findByText("PAT coverage")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Put-attributed lender protection" })).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
    expect(screen.getByText("12%")).toBeInTheDocument();
    expect(screen.getByText("100.000000 USDC")).toBeInTheDocument();
    expect(screen.getByLabelText("Offer APR (%)")).toHaveValue("12");
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
    expect(screen.getByText("95%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("1,026.589041 USDC")).toBeInTheDocument();
    expect(quoteRequest).toHaveBeenCalledTimes(2);
  });

  it("keeps the market quote indicative while a custom offer APR drives the payload", async () => {
    vi.spyOn(awakeningApi, "market").mockResolvedValue(market);
    const quoteRequest = vi.spyOn(awakeningApi, "quote").mockResolvedValue(quote);
    const createOffer = vi.spyOn(awakeningApi, "createOffer");
    render(<LendScreen marketId={marketId} side="LEND" />);
    await screen.findByText("PAT coverage");

    const simulate = screen.getByRole("button", { name: "Simulate offer submission" });
    expect(simulate).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Calculate lend quote" }));

    expect(await screen.findByText("Total payout")).toBeInTheDocument();
    expect(screen.getByText("Market indicative quote")).toBeInTheDocument();
    expect(screen.getByText("Interest").nextElementSibling).toHaveTextContent(
      "29.589041 USDC",
    );
    expect(screen.getByText("Protocol fee").nextElementSibling).toHaveTextContent("3 USDC");
    expect(screen.getByText("Total payout").nextElementSibling).toHaveTextContent(
      "1,026.589041 USDC",
    );
    expect(quoteRequest).toHaveBeenCalledWith(
      marketId,
      "LEND",
      "1000",
      expect.any(AbortSignal),
    );

    fireEvent.change(screen.getByLabelText("Offer APR (%)"), {
      target: { value: "15.5" },
    });
    expect(screen.getByText("Total payout")).toBeInTheDocument();

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
    expect(screen.getByLabelText("Unsigned offer payload")).toHaveTextContent("apr:0.155");
    expect(simulate).toBeEnabled();

    fireEvent.click(simulate);
    expect(screen.getByText(/No signature or transaction was sent/)).toBeInTheDocument();
    expect(createOffer).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Live signature/ })).toBeDisabled();
  });

  it("rejects non-plain, over-precision, and out-of-range offer APRs", async () => {
    vi.spyOn(awakeningApi, "market").mockResolvedValue(market);
    vi.spyOn(awakeningApi, "quote").mockResolvedValue(quote);
    render(<LendScreen marketId={marketId} side="LEND" />);
    await screen.findByText("PAT coverage");
    fireEvent.click(screen.getByRole("button", { name: "Calculate lend quote" }));
    await screen.findByText("Total payout");

    const offerApr = screen.getByLabelText("Offer APR (%)");
    fireEvent.change(offerApr, { target: { value: "1e1" } });
    expect(screen.getByText("Use a plain decimal APR.")).toBeInTheDocument();

    fireEvent.change(offerApr, { target: { value: "12.1234567" } });
    expect(screen.getByText("Use at most 6 decimal places.")).toBeInTheDocument();

    fireEvent.change(offerApr, {
      target: { value: "101" },
    });

    expect(screen.getByText("Offer APR must be at most 100.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview offer" })).toBeDisabled();
    expect(screen.queryByLabelText("Unsigned offer payload")).not.toBeInTheDocument();
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
