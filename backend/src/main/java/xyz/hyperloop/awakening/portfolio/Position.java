package xyz.hyperloop.awakening.portfolio;

import java.time.Instant;

public record Position(String id, String marketId, String side, String principal, String collateral, Instant maturity, String settlementState) { }
