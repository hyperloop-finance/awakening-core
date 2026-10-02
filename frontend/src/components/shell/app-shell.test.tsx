import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { awakeningApi } from "@/lib/api/client";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/markets" }));
vi.mock("./wallet", () => ({ WalletControls: () => <button>Wallet</button>, useWalletIdentity: () => ({wallet:undefined,chainId:undefined,openWallet:vi.fn()}) }));

afterEach(() => vi.restoreAllMocks());

describe("AppShell", () => {
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

    expect(screen.getByRole("status")).toHaveTextContent("Loading runtime config");
    expect(await screen.findByText("Preview only")).toBeInTheDocument();
  });

  it("exposes ready runtime status while the navigation remains semantic", async () => {
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

    expect(await screen.findByText("Addresses configured · transactions disabled")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Markets" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Awakening markets" })).toContainElement(
      screen.getByRole("img", { name: "Hyperloop" }),
    );
    expect(screen.queryByText("AWAKENING")).not.toBeInTheDocument();
    expect(screen.queryByText("v0.1")).not.toBeInTheDocument();
  });
});
