package xyz.hyperloop.awakening.order;

import java.time.Instant;

public record Order(String id, String wallet, String marketId, String side, String amount, String filledAmount,
		String remainingAmount, String apr, Instant expiry, OrderStatus status, Instant createdAt) {
}
