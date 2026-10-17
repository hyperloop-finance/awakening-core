import { describe, expect, it } from "vitest";
import { settlementActionLabel, settlementPhaseLabel } from "./settlement";
describe("settlement labels", () => {
  it("makes every simulated action and lifecycle phase explicit", () => {
    expect(settlementActionLabel("SIMULATE_REPAY_DEBT")).toBe("Simulate repayment");
    expect(settlementActionLabel("SIMULATE_RECOVER_COLLATERAL")).toBe("Simulate collateral recovery");
    expect(settlementPhaseLabel("PRE_MATURITY")).toBe("Before maturity");
  });
});
