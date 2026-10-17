import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { awakeningApi } from "@/lib/api/client";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/markets" }));
vi.mock("./wallet", () => ({ WalletControls: () => <button>Wallet</button>, useWalletIdentity: () => ({wallet:undefined,chainId:undefined,openWallet:vi.fn()}) }));

afterEach(() => vi.restoreAllMocks());

describe("AppShell", () => {
  it("does not mount legacy market children before runtime identity is known", () => {
    vi.spyOn(awakeningApi,"runtimeConfig").mockReturnValue(new Promise(()=>{}));
    render(<AppShell><div>legacy market content</div></AppShell>);
    expect(screen.queryByText("legacy market content")).not.toBeInTheDocument();
    expect(screen.getByRole('status',{name:'Loading page'})).toHaveClass('runtime-loading');
    expect(screen.queryByText('Loading network configuration…')).not.toBeInTheDocument();
  });
  it("loads runtime config and requires both backend readiness and non-zero addresses", async () => {
    vi.spyOn(awakeningApi, "runtimeConfig").mockResolvedValue({
      profile: "api",
      chainId: 11155111,
      rpcUrlConfigured: true,
      contractsReady: true,
      awakeningAddress: `0x${"1".repeat(40)}`,
      settlementAddress: `0x${"2".repeat(40)}`,
      patAddress: `0x${"3".repeat(40)}`,
      optionVaultAddress: `0x${"0".repeat(40)}`,
    });
    render(<AppShell>content</AppShell>);

    expect(screen.getByRole('status',{name:'Loading page'})).toBeInTheDocument();
    expect(await screen.findByText('content')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText("Preview only")).not.toBeInTheDocument();
  });

  it("keeps navigation and wallet controls without a redundant runtime badge", async () => {
    vi.spyOn(awakeningApi, "runtimeConfig").mockResolvedValue({
      profile: "api",
      chainId: 11155111,
      rpcUrlConfigured: true,
      contractsReady: true,
      awakeningAddress: `0x${"1".repeat(40)}`,
      settlementAddress: `0x${"2".repeat(40)}`,
      patAddress: `0x${"3".repeat(40)}`,
      optionVaultAddress: `0x${"4".repeat(40)}`,
    });
    render(<AppShell>content</AppShell>);

    expect(await screen.findByText('content')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Wallet'})).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation',{name:'Primary'})).getAllByRole('link').map(link=>link.textContent)).toEqual(['Markets','Orders','Positions','Settlement','Faucet']);
    expect(screen.getByRole("link", { name: "Markets" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Awakening markets" })).toContainElement(
      screen.getByRole("img", { name: "Hyperloop" }),
    );
    expect(screen.queryByText("AWAKENING")).not.toBeInTheDocument();
    expect(screen.queryByText("v0.1")).not.toBeInTheDocument();
  });
});
