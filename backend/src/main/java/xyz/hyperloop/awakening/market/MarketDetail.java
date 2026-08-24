package xyz.hyperloop.awakening.market;

import java.time.Instant;

public record MarketDetail(
		String id,
		String collateralAsset,
		String principalAsset,
		Instant maturity,
		String fixedApr,
		String utilization,
		String availableLiquidity,
		String offerDepth,
		String settlementState,
		boolean contractsReady,
		String collateralRatio,
		String patCoverage,
		String minimumAmount) {
}
