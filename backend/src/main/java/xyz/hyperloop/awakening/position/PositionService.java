package xyz.hyperloop.awakening.position;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import xyz.hyperloop.awakening.api.ApiException;
import xyz.hyperloop.awakening.market.MarketService;

@Service
public class PositionService {
	public static final String DEMO_WALLET = "0xde00000000000000000000000000000000000001";
	private final MarketService markets;
	private final Environment environment;
	private final Clock clock;

	public PositionService(MarketService markets, Environment environment, Clock clock) {
		this.markets = markets; this.environment = environment; this.clock = clock;
	}

	public PositionPayload getPositions(String wallet) {
		String normalized = normalizeWallet(wallet);
		if (!mockAvailable()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Positions unavailable", "Preview positions are available only in mock and test profiles.");
		if (!DEMO_WALLET.equals(normalized)) return new PositionPayload(normalized,
				new PositionTotals("0.00", "0.00", "0.00000000", "0.00", "0.00"), List.of(), List.of(), profile(), clock.instant(), "MOCK_CATALOG");
		Instant maturity = markets.maturity();
		PositionSummary borrow = new PositionSummary("borrow-demo-1", MarketService.BTC_USDC_90D, "BORROW", "1200.00", "0.03000000",
				"0.00", "1200.00", "0.00", "0.0850", "60000.00", "ATTRIBUTED_PREVIEW", "0.9500", maturity, state(maturity));
		PositionSummary lend = new PositionSummary("lend-demo-1", MarketService.BTC_USDC_90D, "LEND", "800.00", "0.00000000",
				"800.00", "0.00", "800.00", "0.0850", "60000.00", "ATTRIBUTED_PREVIEW", "0.9500", maturity, state(maturity));
		return new PositionPayload(normalized, new PositionTotals("1200.00", "800.00", "0.03000000", "800.00", "1200.00"),
				List.of(borrow), List.of(lend), profile(), clock.instant(), "MOCK_CATALOG");
	}

	public PositionSummary findOwned(String wallet, String positionId) {
		PositionPayload payload = getPositions(wallet);
		return java.util.stream.Stream.concat(payload.borrowPositions().stream(), payload.lendPositions().stream())
				.filter(item -> item.id().equals(positionId)).findFirst()
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Position not found", "No position exists for this wallet."));
	}

	private String normalizeWallet(String wallet) {
		if (wallet == null || !wallet.matches("0x[0-9a-fA-F]{40}")) throw new ApiException(HttpStatus.BAD_REQUEST, "Validation failed", "wallet must be 0x followed by 40 hexadecimal characters.");
		return wallet.toLowerCase(Locale.ROOT);
	}
	private String state(Instant maturity) { return clock.instant().isBefore(maturity) ? "OPEN" : "MATURED"; }
	private boolean mockAvailable() { return "mock".equals(profile()) || "test".equals(profile()); }
	private String profile() { return Optional.of(environment.getActiveProfiles()).filter(p -> p.length > 0).map(p -> p[0]).orElse("mock"); }
}
