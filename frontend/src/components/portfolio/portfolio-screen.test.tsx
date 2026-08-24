import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { awakeningApi } from "@/lib/api/client";
import type { PortfolioPayload } from "@/lib/api/types";
import { PortfolioScreen } from "./portfolio-screen";

const walletState = vi.hoisted(() => ({ wallet: undefined as string | undefined }));

vi.mock("@/components/shell/wallet", () => ({
  useWalletIdentity: () => ({
    wallet: walletState.wallet,
    setDemoEnabled: vi.fn(),
  }),
}));

const walletA = "0x1111111111111111111111111111111111111111";
const walletB = "0x2222222222222222222222222222222222222222";

function payload(wallet: string, principal?: string): PortfolioPayload {
  return {
    wallet,
    meta: {
      profile: "mock",
      generatedAt: "2026-08-24T00:00:00Z",
      dataSource: "MOCK_CATALOG",
    },
    totals: {
      borrowedPrincipal: principal ?? "0",
      lentPrincipal: "0",
      collateralLocked: principal ? "0.5" : "0",
    },
    borrowPositions: principal
      ? [
          {
            id: `0x${wallet.slice(2).padEnd(64, "0")}`,
            marketId: `0x${"a".repeat(64)}`,
            side: "BORROW",
            principal,
            collateral: "0.5",
            maturity: "2026-01-01T00:30:00Z",
            settlementState: "OPEN",
          },
        ]
      : [],
    lendPositions: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

afterEach(() => {
  walletState.wallet = undefined;
  vi.restoreAllMocks();
});

describe("PortfolioScreen", () => {
  it("renders the disconnected state without requesting a portfolio", () => {
    const portfolio = vi.spyOn(awakeningApi, "portfolio");
    render(<PortfolioScreen />);
    expect(screen.getByText("Connect a wallet to view positions")).toBeInTheDocument();
    expect(portfolio).not.toHaveBeenCalled();
  });

  it("renders loading exclusively, then the empty state", async () => {
    walletState.wallet = walletA;
    const response = deferred<PortfolioPayload>();
    vi.spyOn(awakeningApi, "portfolio").mockReturnValue(response.promise);
    render(<PortfolioScreen />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading portfolio");
    expect(screen.queryByText("No active positions")).not.toBeInTheDocument();
    response.resolve(payload(walletA));

    expect(await screen.findByText("No active positions")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders an error exclusively", async () => {
    walletState.wallet = walletA;
    vi.spyOn(awakeningApi, "portfolio").mockRejectedValue(new Error("portfolio offline"));
    render(<PortfolioScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent("portfolio offline");
    expect(screen.queryByText("No active positions")).not.toBeInTheDocument();
    expect(screen.queryByText("BORROWED")).not.toBeInTheDocument();
  });

  it("renders exact large amounts and UTC maturity in the populated state", async () => {
    walletState.wallet = walletA;
    vi.spyOn(awakeningApi, "portfolio").mockResolvedValue(
      payload(walletA, "9007199254740993.000000"),
    );
    render(<PortfolioScreen />);

    expect(await screen.findAllByText("9,007,199,254,740,993 USDC")).toHaveLength(2);
    expect(screen.getByText("Matures Jan 1, 2026 UTC")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("aborts and ignores the old wallet response", async () => {
    walletState.wallet = walletA;
    const oldWallet = deferred<PortfolioPayload>();
    const currentWallet = deferred<PortfolioPayload>();
    const signals: AbortSignal[] = [];
    vi.spyOn(awakeningApi, "portfolio").mockImplementation((wallet, signal) => {
      if (signal) signals.push(signal);
      return wallet === walletA ? oldWallet.promise : currentWallet.promise;
    });
    const { rerender } = render(<PortfolioScreen />);

    walletState.wallet = walletB;
    rerender(<PortfolioScreen />);
    expect(signals[0].aborted).toBe(true);
    currentWallet.resolve(payload(walletB, "222"));
    expect(await screen.findAllByText("222 USDC")).toHaveLength(2);
    oldWallet.resolve(payload(walletA, "111"));

    await waitFor(() => expect(screen.queryByText("111 USDC")).not.toBeInTheDocument());
    expect(screen.getAllByText("222 USDC")).toHaveLength(2);
  });
});
