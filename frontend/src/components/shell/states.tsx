import type { ReactNode } from "react";

export function LoadingState({ label = "Loading market data…" }: { label?: string }) {
  return (
    <div className="state-card" role="status">
      <span className="loader" />
      {label}
    </div>
  );
}

export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="state-card state-error" role="alert">
      <strong>Could not load this view</strong>
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="state-card">
      <svg className="empty-glyph" viewBox="0 0 48 48" aria-hidden="true" fill="none">
        <circle cx="24" cy="24" r="15" />
        <path d="M14 24h20M24 14v20M18.5 18.5l11 11M29.5 18.5l-11 11" />
      </svg>
      <strong>{title}</strong>
      <span>{children}</span>
    </div>
  );
}
