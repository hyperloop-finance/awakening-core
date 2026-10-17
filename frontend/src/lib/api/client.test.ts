import { afterEach, describe, expect, it, vi } from "vitest";
import { awakeningApi } from "./client";

const marketId = `0x${"a".repeat(64)}`;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Awakening API client", () => {
  it("sends the caller signal directly to the quote endpoint and preserves a 409 problem", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_PROFILE", "api");
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "about:blank",
          title: "Conflict",
          status: 409,
          detail: "No fillable offers remain for this amount.",
        }),
        {
          status: 409,
          headers: { "content-type": "application/problem+json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      awakeningApi.quote(marketId, "BORROW", "100", controller.signal),
    ).rejects.toEqual({
      message: "No fillable offers remain for this amount.",
      status: 409,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:8080/api/v1/markets/${marketId}/quote?side=BORROW&amount=100`,
      { signal: controller.signal },
    );
  });

  it("supports cancellation for catalog and runtime config requests", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_PROFILE", "api");
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    void awakeningApi.markets(controller.signal);
    void awakeningApi.runtimeConfig(controller.signal);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8080/api/v1/markets",
      { signal: controller.signal },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8080/api/v1/config",
      { signal: controller.signal },
    );
  });
});
