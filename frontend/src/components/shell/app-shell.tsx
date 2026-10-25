"use client";
import {assetPath} from '@/lib/networks';

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { awakeningApi } from "@/lib/api/client";
import type { RuntimeConfig } from "@/lib/api/types";
import { contractsAreReady } from "@/lib/contracts/config";
import { WalletControls } from "./wallet";
import { AccountBoundary } from "./account-boundary";

const navigation = [
  { href: "/markets", label: "Markets" },
  { href: "/orders", label: "Orders" },
  { href: "/positions", label: "Positions" },
  { href: "/settlement", label: "Settlement" },
  { href: "/faucet", label: "Faucet" },
];

type RuntimeState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; config: RuntimeConfig; liveContractsReady: boolean };

const RuntimeContext = createContext<RuntimeState>({ kind: "loading" });

export function useRuntimeReadiness() {
  return useContext(RuntimeContext);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [runtime, setRuntime] = useState<RuntimeState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setRuntime({ kind: "loading" });
    awakeningApi
      .runtimeConfig(controller.signal)
      .then((config) => {
        if (!controller.signal.aborted) {
          setRuntime({
            kind: "ready",
            config,
            liveContractsReady: config.contractsReady && contractsAreReady(config),
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setRuntime({ kind: "error" });
      });
    return () => controller.abort();
  }, []);

  return (
    <RuntimeContext.Provider value={runtime}>
      <div className="ambient" aria-hidden="true">
        <span className="ambient-glow ambient-glow-one" />
        <span className="ambient-glow ambient-glow-two" />
      </div>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/markets" aria-label="Awakening markets">
            <Image
              className="brand-logo"
              src={assetPath('/hyperloop-logo.svg')}
              alt="Hyperloop"
              width={180}
              height={19}
              priority
            />
          </Link>
          <nav aria-label="Primary">
            {navigation.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "nav-link nav-link-active" : "nav-link"}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="header-actions">
            <WalletControls />
          </div>
        </div>
      </header>
      <main className="app-main">{runtime.kind==='ready'
        ? <AccountBoundary pathname={pathname} config={runtime.config}>{children}</AccountBoundary>
        : runtime.kind==='loading'
          ? <div className="runtime-loading" role="status" aria-label="Loading page"><span className="runtime-spinner" aria-hidden="true"/></div>
          : <p>Network configuration unavailable. Reload to retry; no transactions are enabled.</p>}</main>
    </RuntimeContext.Provider>
  );
}
