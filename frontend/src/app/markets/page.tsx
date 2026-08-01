export default function MarketsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Markets</h1>
      <p className="mt-3 text-sm text-neutral-500">
        Awakening markets — non-liquidative fixed-rate credit backed by put attribution.
      </p>
      <div className="mt-8 rounded-lg border border-neutral-200 p-8 text-center text-neutral-400">
        No markets yet. Milestone 3B will render live markets from the backend API.
      </div>
    </main>
  );
}
