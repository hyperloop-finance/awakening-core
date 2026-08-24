export type ResourceState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready" };

export function resourceState({ loading, error }: { loading?: boolean; error?: unknown }): ResourceState {
  if (loading) return { kind: "loading" };
  if (error) return { kind: "error", message: error instanceof Error ? error.message : "Unable to load data. Try again." };
  return { kind: "ready" };
}
