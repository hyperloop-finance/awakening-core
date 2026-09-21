import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { awakeningApi } from "@/lib/api/client";
import type { MarketDetail, MarketSummary } from "@/lib/api/types";
import { MarketsScreen } from "./markets-screen";

const market: MarketSummary = {
  id: `0x${"a".repeat(64)}`,
  collateralAsset: "BTC",
  principalAsset: "USDC",
  maturity: "2026-12-15T00:00:00Z",
  fixedApr: "0.12",
  utilization: "0.412",
  availableLiquidity: "9007199254740993.000000",
  offerDepth: "18",
  settlementState: "OPEN",
  contractsReady: false,
};

const nextMarket: MarketSummary = {
  ...market,
  id: `0x${"b".repeat(64)}`,
  maturity: "2026-10-01T00:00:00Z",
  fixedApr: "0.18",
  availableLiquidity: "7.250000",
};
const stockMarket: MarketSummary = {
  ...market,
  id: `0x${"c".repeat(64)}`,
  collateralAsset: "SPCXB",
  principalAsset: "USDT",
  maturity: "2027-03-26T00:00:00Z",
  availableLiquidity: "95000.00",
};
const detail = (value: MarketSummary): MarketDetail => ({ ...value, collateralRatio: "1.5000", patCoverage: "0.9500", strike: "60000.00", patStatus: "VERIFIED_PREVIEW", patSource: "ATTESTED_CUSTODIAN_PREVIEW", borrowLevels: [], lendLevels: [], minimumAmount: "100.00" });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

afterEach(() => vi.restoreAllMocks());

describe("MarketsScreen", () => {
  it("renders loading, then a semantic API-success table without losing integer precision", async () => {
    const response = deferred<MarketSummary[]>();
    vi.spyOn(awakeningApi, "markets").mockReturnValue(response.promise);
    vi.spyOn(awakeningApi, "market").mockImplementation(async (id) => detail(id === market.id ? market : nextMarket));

    render(<MarketsScreen />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading market data");

    response.resolve([market]);

    expect(await screen.findByRole("table", { name: "Available markets" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "MARKET" })).toBeInTheDocument();
    expect(screen.getByText("min(S, K)")).toBeInTheDocument();
    expect(screen.getByText("DETERMINISTIC PREVIEW · NO LIVE TVL")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("12%")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("41.2%")).toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).getByText("9,007,199,254,740,993 USDC"),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Bitcoin" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "USD Coin" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lend now" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Place borrow order" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Place lend order" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Borrow now" }));
    expect(await screen.findByRole("region", { name: "Borrow execution" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Transaction ticket" })).toBeInTheDocument();
  });

  it("renders an empty filter result and can clear it", async () => {
    vi.spyOn(awakeningApi, "markets").mockResolvedValue([market]);
    vi.spyOn(awakeningApi, "market").mockResolvedValue(detail(market));
    render(<MarketsScreen />);
    await screen.findByRole("table");

    fireEvent.change(screen.getByRole("textbox", { name: "Filter markets" }), {
      target: { value: "ETH" },
    });

    expect(screen.getByText("No markets match this filter")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("renders tokenized-stock markets and their actual settlement asset", async () => {
    const stockMarkets = [
      { ...stockMarket, id: `0x${"d".repeat(64)}`, collateralAsset: "QQQB" },
      stockMarket,
      { ...stockMarket, id: `0x${"e".repeat(64)}`, collateralAsset: "NVDAB" },
      { ...stockMarket, id: `0x${"f".repeat(64)}`, collateralAsset: "BNCB" },
    ];
    vi.spyOn(awakeningApi, "markets").mockResolvedValue([market, ...stockMarkets]);
    vi.spyOn(awakeningApi, "market").mockImplementation(async (id) =>
      detail(id === market.id ? market : stockMarkets.find((item) => item.id === id) ?? stockMarket),
    );
    render(<MarketsScreen />);

    const table = await screen.findByRole("table", { name: "Available markets" });
    expect(within(table).getByText("SPCXB / USDT")).toBeInTheDocument();
    expect(within(table).getAllByText("95,000 USDT")).toHaveLength(4);
    expect(screen.getByRole("img", { name: "SpaceX" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Invesco QQQ" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "NVIDIA" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "CEA Industries" })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Tether" })).toHaveLength(4);
    expect(within(table).getAllByText(/PREVIEW PAT/).length).toBeGreaterThan(0);
  });

  it("derives overview metrics from the full API catalog", async () => {
    vi.spyOn(awakeningApi, "markets").mockResolvedValue([market, nextMarket]);
    vi.spyOn(awakeningApi, "market").mockImplementation(async (id) => detail(id === market.id ? market : nextMarket));
    render(<MarketsScreen />);

    await screen.findByRole("table");
    expect(screen.getByText("Total available").nextElementSibling).toHaveTextContent(
      "9,007,199,254,741,000.25 USD",
    );
    expect(screen.getByText("Market count").nextElementSibling).toHaveTextContent("2");
    expect(screen.getByText("Average fixed APR").nextElementSibling).toHaveTextContent("15%");
    expect(screen.getByText("Next maturity").nextElementSibling).toHaveTextContent(
      "2026-10-01 UTC",
    );
  });

  it("renders the API empty state when the catalog has no markets", async () => {
    vi.spyOn(awakeningApi, "markets").mockResolvedValue([]);
    render(<MarketsScreen />);

    expect(await screen.findByText("No markets available")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Total available").nextElementSibling).toHaveTextContent(
      "0 USD",
    );
    expect(screen.getByText("Market count").nextElementSibling).toHaveTextContent("0");
    expect(screen.getByText("Average fixed APR").nextElementSibling).toHaveTextContent("—");
  });

  it("renders an API error and retries the catalog request", async () => {
    const markets = vi
      .spyOn(awakeningApi, "markets")
      .mockRejectedValueOnce(new Error("catalog offline"))
      .mockResolvedValueOnce([market]);
    vi.spyOn(awakeningApi, "market").mockResolvedValue(detail(market));
    render(<MarketsScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("catalog offline");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(markets).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });
});
