import type { ReactNode } from "react";

export function LoadingState({ label = "Loading market data…" }: { label?: string }) { return <div className="state-card" role="status"><span className="loader" />{label}</div>; }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="state-card state-error" role="alert"><strong>Could not load this view</strong><span>{message}</span>{retry && <button className="text-button" onClick={retry}>Try again</button>}</div>; }
export function EmptyState({ title, children }: { title: string; children: ReactNode }) { return <div className="state-card"><span className="empty-glyph">◇</span><strong>{title}</strong><span>{children}</span></div>; }
