import { describe, expect, it } from "vitest";
import { validateOrderDraft } from "./order-form";

describe("order validation", () => {
  const draft = { wallet: "0xde00000000000000000000000000000000000001", marketId: `0x${"a".repeat(64)}`, side: "BORROW" as const, amount: "5000", aprPercent: "8.1", expiry: "2026-12-01T00:00" };
  it("accepts a valid order and rejects invalid financial inputs", () => {
    expect(validateOrderDraft(draft, new Date("2026-09-21T00:00:00Z"))).toEqual({});
    expect(validateOrderDraft({ ...draft, amount: "0" }, new Date("2026-09-21T00:00:00Z"))).toHaveProperty("amount");
    expect(validateOrderDraft({ ...draft, aprPercent: "101" }, new Date("2026-09-21T00:00:00Z"))).toHaveProperty("aprPercent");
    expect(validateOrderDraft({ ...draft, expiry: "2020-01-01T00:00" }, new Date("2026-09-21T00:00:00Z"))).toHaveProperty("expiry");
  });
});
