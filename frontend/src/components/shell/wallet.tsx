"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { DEMO_WALLET } from "@/lib/api/mock";

type DemoWalletContextValue = {
  demoEnabled: boolean;
  setDemoEnabled: (value: boolean) => void;
};

const DemoWalletContext = createContext<DemoWalletContextValue | undefined>(undefined);

export function DemoWalletProvider({ children }: { children: ReactNode }) {
  const [demoEnabled, setDemoEnabled] = useState(false);
  useEffect(() => {
    setDemoEnabled(window.localStorage.getItem("awakening-demo-wallet") === "true");
  }, []);

  const setPersistedDemoEnabled = (value: boolean) => {
    setDemoEnabled(value);
    window.localStorage.setItem("awakening-demo-wallet", String(value));
  };

  return (
    <DemoWalletContext.Provider
      value={{ demoEnabled, setDemoEnabled: setPersistedDemoEnabled }}
    >
      {children}
    </DemoWalletContext.Provider>
  );
}

export function useWalletIdentity() {
  const account = useAccount();
  const context = useContext(DemoWalletContext);
  if (!context) throw new Error("DemoWalletProvider is required");
  return {
    wallet: account.address ?? (context.demoEnabled ? DEMO_WALLET : undefined),
    isDemo: !account.address && context.demoEnabled,
    setDemoEnabled: context.setDemoEnabled,
  };
}

export function WalletControls() {
  const { address } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { isDemo, setDemoEnabled } = useWalletIdentity();
  const connector = connectors[0];
  const display = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : isDemo
      ? "Demo wallet"
      : undefined;

  if (display) {
    return (
      <button
        className="wallet-button wallet-button-muted"
        onClick={() => (address ? disconnect() : setDemoEnabled(false))}
      >
        {display} · disconnect
      </button>
    );
  }

  return (
    <div className="wallet-controls">
      <button
        className="wallet-button wallet-button-muted"
        onClick={() => setDemoEnabled(true)}
      >
        Use demo wallet
      </button>
      <button
        className="wallet-button"
        disabled={!connector || isPending}
        onClick={() => connector && connect({ connector })}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    </div>
  );
}
