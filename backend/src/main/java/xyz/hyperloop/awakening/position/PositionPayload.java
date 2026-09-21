package xyz.hyperloop.awakening.position;

import java.time.Instant;
import java.util.List;

public record PositionPayload(String wallet, PositionTotals totals, List<PositionSummary> borrowPositions,
		List<PositionSummary> lendPositions, String profile, Instant asOf, String source) {
}
