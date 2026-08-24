package xyz.hyperloop.awakening.offer;

import java.time.Instant;

public record Offer(String id, String wallet, String marketId, String amount, String apr, Instant expiry, String signature, String status, Instant createdAt) { }
