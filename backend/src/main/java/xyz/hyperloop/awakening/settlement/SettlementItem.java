package xyz.hyperloop.awakening.settlement;

import java.time.Instant;
import java.util.List;

public record SettlementItem(String positionId, String marketId, String side, Instant maturity, SettlementPhase phase,
		String outstandingDebt, String recoverableCollateral, String claimablePayout, String claimableResidual,
		String patStatus, List<SettlementAction> availableActions, boolean simulated) { }
