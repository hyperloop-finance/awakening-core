package xyz.hyperloop.awakening.market;

import java.time.Instant;

public record MarketSummary(
		String id,
		String collateralAsset,
		String principalAsset,
		Instant maturity,
		String fixedApr,
		String utilization,
		String availableLiquidity,
		String offerDepth,
		String settlementState,
		boolean contractsReady) {
}
