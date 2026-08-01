type PageProps = {
  params: Promise<{ marketId: string }>;
};

export default async function LendPage({ params }: PageProps) {
  const { marketId } = await params;
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Lend</h1>
      <p className="mt-3 text-sm text-neutral-500">
        Market <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{marketId}</code>
      </p>
      <div className="mt-8 rounded-lg border border-neutral-200 p-8 text-center text-neutral-400">
        Lend flow (Milestone 3D). Your principal is backed by a put on the collateral, expiring at maturity.
      </div>
    </main>
  );
}
