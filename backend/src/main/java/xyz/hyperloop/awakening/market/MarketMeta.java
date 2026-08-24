package xyz.hyperloop.awakening.market;

import java.time.Instant;

public record MarketMeta(String profile, long chainId, Instant generatedAt) {
}
