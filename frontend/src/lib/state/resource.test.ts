import { describe, expect, it } from "vitest";

import { resourceState } from "./resource";

describe("async resource state", () => {
  it("renders loading before a request resolves", () => {
    expect(resourceState({ loading: true })).toEqual({ kind: "loading" });
  });

  it("exposes a retryable error instead of hiding a failed API request", () => {
    expect(resourceState({ error: new Error("offline") })).toEqual({ kind: "error", message: "offline" });
  });
});
