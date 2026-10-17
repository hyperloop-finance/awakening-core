package xyz.hyperloop.awakening.quote;

import java.time.Instant;
import java.util.List;

public record Quote(
		String marketId,
		String side,
		String principal,
		String collateralRequirement,
		String interest,
		String protocolFee,
		String totalDueOrPayout,
		String apr,
		Instant maturity,
		Instant expiresAt,
		List<String> executionSteps) {
}
