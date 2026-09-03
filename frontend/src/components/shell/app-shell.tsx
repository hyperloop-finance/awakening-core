"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { awakeningApi } from "@/lib/api/client";
import type { RuntimeConfig } from "@/lib/api/types";
import { contractsAreReady } from "@/lib/contracts/config";
import { WalletControls } from "./wallet";

const navigation = [
  { href: "/markets", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
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

  const runtimeLabel = useMemo(() => {
    if (runtime.kind === "loading") return "Loading runtime config";
    if (runtime.kind === "error") return "Runtime unavailable · simulation only";
    return runtime.liveContractsReady
      ? "Contracts ready · simulation only"
      : "Preview only";
  }, [runtime]);

  return (
    <RuntimeContext.Provider value={runtime}>
      <div className="ambient" aria-hidden="true">
        <span className="ambient-glow ambient-glow-one" />
        <span className="ambient-glow ambient-glow-two" />
      </div>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/markets" aria-label="Awakening markets">
            <svg
              className="brand-mark"
              viewBox="0 0 32 32"
              aria-hidden="true"
              fill="none"
            >
              <path d="M4 16h7M21 16h7M16 4v7M16 21v7" />
              <circle cx="16" cy="16" r="6.5" />
              <path d="M12.5 16c1.4-2.8 5.6-2.8 7 0-1.4 2.8-5.6 2.8-7 0Z" />
            </svg>
            <span>AWAKENING</span>
            <small>v0.1</small>
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
            <span className="network-badge" role="status">
              <i className={runtime.kind === "ready" && runtime.liveContractsReady ? "" : "muted"} />
              {runtimeLabel}
            </span>
            <WalletControls />
          </div>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </RuntimeContext.Provider>
  );
}
