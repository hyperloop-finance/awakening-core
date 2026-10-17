import type { SettlementAction, SettlementPhase } from "../api/types";
export function settlementActionLabel(action: SettlementAction): string {
  switch (action) {
    case "SIMULATE_REPAY_DEBT": return "Simulate repayment";
    case "SIMULATE_RECOVER_COLLATERAL": return "Simulate collateral recovery";
    case "SIMULATE_CLAIM_LENDER_PAYOUT": return "Simulate lender payout claim";
    case "SIMULATE_CLAIM_RESIDUAL_PROCEEDS": return "Simulate residual proceeds claim";
    default: { const neverAction: never = action; return neverAction; }
  }
}
export function settlementPhaseLabel(phase: SettlementPhase): string {
  return ({ PRE_MATURITY: "Before maturity", REPAYMENT_AVAILABLE: "Repayment available", READY_TO_CLAIM: "Ready to claim", FINALIZED: "Finalized preview" })[phase];
}
