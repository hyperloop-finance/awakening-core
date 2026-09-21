import { describe, expect, it } from "vitest";
import { parseOrder, parsePositionPayload, parseSettlementItem } from "./wire";

const wallet = "0xde00000000000000000000000000000000000001";
const marketId = `0x${"a".repeat(64)}`;

describe("user product wire contract", () => {
  it("parses exact order, position, and settlement payloads", () => {
    expect(parseOrder({ id: "order-1", wallet, marketId, side: "BORROW", amount: "5000", filledAmount: "0", remainingAmount: "5000", apr: "0.081", expiry: "2026-12-01T00:00:00Z", status: "OPEN", createdAt: "2026-09-21T00:00:00Z" }).status).toBe("OPEN");
    expect(parsePositionPayload({ wallet, totals: { borrowedPrincipal: "1200.00", lentPrincipal: "800.00", collateralLocked: "0.03", creditFaceValue: "800.00", debtOutstanding: "1200.00" }, borrowPositions: [], lendPositions: [], profile: "mock", asOf: "2026-09-21T00:00:00Z", source: "MOCK_CATALOG" }).wallet).toBe(wallet);
    expect(parseSettlementItem({ positionId: "borrow-demo-1", marketId, side: "BORROW", maturity: "2026-12-31T00:00:00Z", phase: "PRE_MATURITY", outstandingDebt: "1200.00", recoverableCollateral: "0.03", claimablePayout: "0", claimableResidual: "0", patStatus: "ATTRIBUTED_PREVIEW", availableActions: [], simulated: false }).phase).toBe("PRE_MATURITY");
  });

  it("rejects invalid enum values and numeric decimal fields", () => {
    expect(() => parseOrder({ id: "x", wallet, marketId, side: "BORROW", amount: 5, filledAmount: "0", remainingAmount: "5", apr: "0.1", expiry: "x", status: "BAD", createdAt: "x" })).toThrow();
  });
});
