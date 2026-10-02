import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { awakeningApi } from "@/lib/api/client";
import type { MarketDetail, Quote } from "@/lib/api/types";
import { CreditFlow } from "./borrow-screen";

const marketId = `0x${"a".repeat(64)}`;
const market: MarketDetail = {
  id: marketId,
  collateralAsset: "BTC",
  principalAsset: "USDC",
  maturity: "2026-12-15T00:00:00Z",
  fixedApr: "0.12",
  utilization: "0.42",
  availableLiquidity: "2500000.000000",
  offerDepth: "18",
  settlementState: "OPEN",
  contractsReady: false,
  collateralRatio: "1.5000",
  patCoverage: "0.95",
  minimumAmount: "100.000000",
  strike: "50000", patStatus: "VERIFIED_PREVIEW", patSource: "ATTESTED_CUSTODIAN_PREVIEW", borrowLevels: [], lendLevels: [],
};

const quote = (principal: string): Quote => ({
  marketId,
  side: "BORROW",
  principal,
  collateralRequirement: "0.02500000",
  interest: "29.589041",
  protocolFee: "3.000000",
  totalDueOrPayout: "1032.589041",
  apr: "0.12",
  maturity: market.maturity,
  expiresAt: "2026-08-24T04:00:00Z",
  executionSteps: ["Review preview", "No on-chain transaction will be sent"],
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

afterEach(() => vi.restoreAllMocks());

describe("CreditFlow", () => {
  it("renders a market API error and retries market loading", async () => {
    const marketRequest = vi
      .spyOn(awakeningApi, "market")
      .mockRejectedValueOnce(new Error("market offline"))
      .mockResolvedValueOnce(market);
    render(<CreditFlow marketId={marketId} side="BORROW" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("market offline");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("PAT coverage")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why PAT removes interim liquidation" })).toBeInTheDocument();
    expect(marketRequest).toHaveBeenCalledTimes(2);
  });

  it("renders market loading, API success details, and minimum validation", async () => {
    const response = deferred<MarketDetail>();
    vi.spyOn(awakeningApi, "market").mockReturnValue(response.promise);
    render(<CreditFlow marketId={marketId} side="BORROW" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading market");
    response.resolve(market);

    expect(await screen.findByText("PAT coverage")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
    expect(screen.getByText("1.5000x")).toBeInTheDocument();
    expect(screen.getByText("100.000000 USDC")).toBeInTheDocument();
    expect(screen.getByText(/expire after five minutes/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("USDC amount"), { target: { value: "99" } });
    expect(screen.getByText("Minimum amount is 100.000000.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calculate quote" })).toBeDisabled();
  });

  it("shows a quote 409 and Retry repeats the quote request", async () => {
    vi.spyOn(awakeningApi, "market").mockResolvedValue(market);
    const quoteRequest = vi
      .spyOn(awakeningApi, "quote")
      .mockRejectedValueOnce({ status: 409, detail: "No fillable offers remain." })
      .mockResolvedValueOnce(quote("1000"));
    render(<CreditFlow marketId={marketId} side="BORROW" />);
    await screen.findByText("PAT coverage");

    fireEvent.click(screen.getByRole("button", { name: "Calculate quote" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No fillable offers remain.");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("1,000 USDC")).toBeInTheDocument();
    expect(screen.getByText("12%")).toBeInTheDocument();
    expect(screen.getByText("Interest").nextElementSibling).toHaveTextContent(
      "29.589041 USDC",
    );
    expect(screen.getByText("Protocol fee").nextElementSibling).toHaveTextContent("3 USDC");
    expect(quoteRequest).toHaveBeenCalledTimes(2);
  });

  it("aborts and ignores an old quote when the amount changes", async () => {
    vi.spyOn(awakeningApi, "market").mockResolvedValue(market);
    const oldQuote = deferred<Quote>();
    const currentQuote = deferred<Quote>();
    const signals: AbortSignal[] = [];
    vi.spyOn(awakeningApi, "quote").mockImplementation((_id, _side, amount, signal) => {
      if (signal) signals.push(signal);
      return amount === "1000" ? oldQuote.promise : currentQuote.promise;
    });
    render(<CreditFlow marketId={marketId} side="BORROW" />);
    await screen.findByText("PAT coverage");

    fireEvent.click(screen.getByRole("button", { name: "Calculate quote" }));
    fireEvent.change(screen.getByLabelText("USDC amount"), { target: { value: "1200" } });
    expect(signals[0].aborted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Calculate quote" }));

    currentQuote.resolve(quote("1200"));
    expect(await screen.findByText("1,200 USDC")).toBeInTheDocument();
    oldQuote.resolve(quote("1000"));

    await waitFor(() => expect(screen.queryByText("1,000 USDC")).not.toBeInTheDocument());
    expect(screen.getByText("1,200 USDC")).toBeInTheDocument();
  });

  it("clears quote and preview gating when the input changes", async () => {
    vi.spyOn(awakeningApi, "market").mockResolvedValue(market);
    vi.spyOn(awakeningApi, "quote").mockResolvedValue(quote("1000"));
    render(<CreditFlow marketId={marketId} side="BORROW" />);
    await screen.findByText("PAT coverage");

    fireEvent.click(screen.getByRole("button", { name: "Calculate quote" }));
    await screen.findByText("1,000 USDC");
    fireEvent.click(screen.getByRole("button", { name: "Confirm preview" }));
    expect(screen.getByRole("button", { name: "Simulate borrow" })).toBeEnabled();

    fireEvent.change(screen.getByLabelText("USDC amount"), { target: { value: "1200" } });
    expect(screen.queryByText("1,000 USDC")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Simulate borrow" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Live borrow/ })).toBeDisabled();
  });

  it("clears the quote and preview when the market changes", async () => {
    const nextMarketId = `0x${"b".repeat(64)}`;
    vi.spyOn(awakeningApi, "market").mockImplementation(async (id) => ({
      ...market,
      id,
      fixedApr: id === nextMarketId ? "0.145" : "0.12",
    }));
    vi.spyOn(awakeningApi, "quote").mockResolvedValue(quote("1000"));
    const { rerender } = render(<CreditFlow marketId={marketId} side="BORROW" />);
    await screen.findByText("PAT coverage");
    fireEvent.click(screen.getByRole("button", { name: "Calculate quote" }));
    await screen.findByText("1,000 USDC");
    fireEvent.click(screen.getByRole("button", { name: "Confirm preview" }));

    rerender(<CreditFlow marketId={nextMarketId} side="BORROW" />);

    await waitFor(() => expect(screen.queryByText("1,000 USDC")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Simulate borrow" })).not.toBeInTheDocument();
  });

  it("renders tokenized-stock and USDT terms from the selected market", async () => {
    const stockMarket = { ...market, collateralAsset: "SPCXB", principalAsset: "USDT", strike: "425.00" };
    vi.spyOn(awakeningApi, "market").mockResolvedValue(stockMarket);
    vi.spyOn(awakeningApi, "quote").mockResolvedValue({ ...quote("1000"), collateralRequirement: "3.76470588" });

    render(<CreditFlow marketId={marketId} side="BORROW" />);

    expect(await screen.findByLabelText("USDT amount")).toBeInTheDocument();
    expect(screen.getByText("MOCK · BORROW / USDT")).toBeInTheDocument();
    expect(screen.getByText("100.000000 USDT")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Calculate quote" }));
    expect(await screen.findByText("3.76470588 SPCXB")).toBeInTheDocument();
  });
});
