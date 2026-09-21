package xyz.hyperloop.awakening.market;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import xyz.hyperloop.awakening.api.ApiException;
import xyz.hyperloop.awakening.config.AwakeningProperties;
import xyz.hyperloop.awakening.config.RuntimeConfigService;
import org.springframework.http.HttpStatus;

@Service
public class MarketService {
	public static final String BTC_USDC_90D = "0x8f0d4f673bd9de1d1f927cbf3abfc7b77c680f1d817e113d5603bb483fa041e6";
	private static final Instant MATURITY = Instant.parse("2026-12-31T00:00:00Z");
	private final Environment environment;
	private final AwakeningProperties properties;
	private final RuntimeConfigService runtimeConfigService;
	private final Clock clock;

	public MarketService(Environment environment, AwakeningProperties properties, RuntimeConfigService runtimeConfigService, Clock clock) {
		this.environment = environment;
		this.properties = properties;
		this.runtimeConfigService = runtimeConfigService;
		this.clock = clock;
	}

	public MarketsResponse listMarkets() {
		if (!mockCatalogAvailable()) {
			return new MarketsResponse(List.of(), new MarketMeta(activeProfile(), properties.rpc().chainId(), clock.instant(), "UNAVAILABLE"));
		}
		return new MarketsResponse(List.of(summary()), new MarketMeta(activeProfile(), properties.rpc().chainId(), clock.instant(), "MOCK_CATALOG"));
	}

	public MarketDetail getMarket(String marketId) {
		if (!mockCatalogAvailable()) {
			throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Market catalog unavailable", "Mock catalog is available only in mock and test profiles.");
		}
		if (!BTC_USDC_90D.equals(marketId)) {
			throw new ApiException(HttpStatus.NOT_FOUND, "Market not found", "No market exists for id " + marketId + ".");
		}
		MarketSummary market = summary();
		return new MarketDetail(market.id(), market.collateralAsset(), market.principalAsset(), market.maturity(),
				market.fixedApr(), market.utilization(), market.availableLiquidity(), market.offerDepth(), market.settlementState(),
				market.contractsReady(), "1.5000", "0.9500", "60000.00", "VERIFIED_PREVIEW",
				"ATTESTED_CUSTODIAN_PREVIEW",
				List.of(new OrderBookLevel("0.0825", "75000.00"), new OrderBookLevel("0.0850", "100000.00")),
				List.of(new OrderBookLevel("0.0875", "80000.00"), new OrderBookLevel("0.0900", "95000.00")),
				"100.00");
	}

	public BigDecimal apr() {
		return new BigDecimal("0.0850");
	}

	public Instant maturity() {
		return MATURITY;
	}

	private MarketSummary summary() {
		return new MarketSummary(BTC_USDC_90D, "BTC", "USDC", MATURITY, "0.0850", "0.4200", "250000.00", "175000.00", settlementState(), runtimeConfigService.contractsReady());
	}

	private String settlementState() {
		return clock.instant().isBefore(MATURITY) ? "OPEN" : "MATURED";
	}

	private boolean mockCatalogAvailable() {
		String profile = activeProfile();
		return "mock".equals(profile) || "test".equals(profile);
	}

	private String activeProfile() {
		return Optional.ofNullable(environment.getActiveProfiles()).filter(profiles -> profiles.length > 0)
				.map(profiles -> profiles[0]).orElse("mock");
	}
}
