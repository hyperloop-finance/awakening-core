package xyz.hyperloop.awakening.order;

import java.time.Instant;

public record CreateOrderRequest(String wallet, String marketId, String side, String amount, String apr, Instant expiry) {
}
