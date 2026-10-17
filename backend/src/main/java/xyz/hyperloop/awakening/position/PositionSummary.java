package xyz.hyperloop.awakening.position;

import java.time.Instant;

public record PositionSummary(String id, String marketId, String side, String principal, String collateral,
		String creditUnits, String debtUnits, String faceValue, String fixedApr, String strike, String patStatus,
		String patCoverage, Instant maturity, String settlementState) {
}
