package xyz.hyperloop.awakening.market;

import java.time.Instant;
import java.util.List;

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
		String strike,
		String patStatus,
		String patSource,
		List<OrderBookLevel> borrowLevels,
		List<OrderBookLevel> lendLevels,
		String minimumAmount) {
}
