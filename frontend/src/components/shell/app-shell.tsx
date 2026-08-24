"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { resolveDataProfile } from "@/lib/api/profile";
import { WalletControls } from "./wallet";

const navigation = [{ href: "/markets", label: "Markets" }, { href: "/portfolio", label: "Portfolio" }];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <><div className="ambient" aria-hidden="true" /><header className="site-header"><Link className="brand" href="/markets"><span className="brand-mark">◇</span> AWAKENING</Link><nav>{navigation.map((item) => <Link key={item.href} href={item.href} className={pathname.startsWith(item.href) ? "nav-link nav-link-active" : "nav-link"}>{item.label}</Link>)}</nav><div className="header-actions"><span className="network-badge"><i /> {resolveDataProfile() === "mock" ? "Mock profile" : "API profile"}</span><WalletControls /></div></header><main className="app-main">{children}</main></>;
}
