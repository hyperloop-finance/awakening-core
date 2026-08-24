package xyz.hyperloop.awakening.portfolio;

import java.time.Instant;

public record PortfolioMeta(String profile, Instant generatedAt, String dataSource) { }
