import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { awakeningApi } from "@/lib/api/client";
import type { MarketSummary } from "@/lib/api/types";
import { MarketsScreen } from "./markets-screen";

const market: MarketSummary = {
  id: `0x${"a".repeat(64)}`,
  collateralAsset: "BTC",
  principalAsset: "USDC",
  maturity: "2026-12-15T00:00:00Z",
  fixedApr: "12.00",
  utilization: "41.20",
  availableLiquidity: "9007199254740993.000000",
  offerDepth: "18",
  settlementState: "OPEN",
  contractsReady: false,
};

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

    render(<MarketsScreen />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading market data");

    response.resolve([market]);

    expect(await screen.findByRole("table", { name: "Available markets" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "MARKET" })).toBeInTheDocument();
    expect(screen.getByText("9,007,199,254,740,993 USDC")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Borrow" })).toHaveAttribute(
      "href",
      `/borrow/${market.id}`,
    );
  });

  it("renders an empty filter result and can clear it", async () => {
    vi.spyOn(awakeningApi, "markets").mockResolvedValue([market]);
    render(<MarketsScreen />);
    await screen.findByRole("table");

    fireEvent.change(screen.getByRole("textbox", { name: "Filter markets" }), {
      target: { value: "ETH" },
    });

    expect(screen.getByText("No BTC markets match this filter")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("renders the API empty state when the catalog has no markets", async () => {
    vi.spyOn(awakeningApi, "markets").mockResolvedValue([]);
    render(<MarketsScreen />);

    expect(await screen.findByText("No markets available")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders an API error and retries the catalog request", async () => {
    const markets = vi
      .spyOn(awakeningApi, "markets")
      .mockRejectedValueOnce(new Error("catalog offline"))
      .mockResolvedValueOnce([market]);
    render(<MarketsScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("catalog offline");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(markets).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });
});
