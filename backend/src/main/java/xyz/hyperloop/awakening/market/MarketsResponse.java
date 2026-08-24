package xyz.hyperloop.awakening.market;

import java.util.List;

public record MarketsResponse(List<MarketSummary> data, MarketMeta meta) {
}
