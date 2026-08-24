package xyz.hyperloop.awakening.offer;

import java.time.Instant;

public record SignedOfferRequest(String wallet, String marketId, String amount, String apr, Instant expiry, String signature) { }
