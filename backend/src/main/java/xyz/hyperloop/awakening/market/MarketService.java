package xyz.hyperloop.awakening.market;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import xyz.hyperloop.awakening.api.ApiException;
import xyz.hyperloop.awakening.config.AwakeningProperties;
import xyz.hyperloop.awakening.config.RuntimeConfigService;

@Service
public class MarketService {
	public static final String BTC_USDC_90D = "0x8f0d4f673bd9de1d1f927cbf3abfc7b77c680f1d817e113d5603bb483fa041e6";
	public static final String QQQB_USDC_90D = "0x71fb86324753ee2148c04b87911e1aa7d46df0781eb25b3248f1d9be4d734101";
	public static final String SPCXB_USDT_90D = "0x72fb86324753ee2148c04b87911e1aa7d46df0781eb25b3248f1d9be4d734102";
	public static final String NVDAB_USDC_90D = "0x73fb86324753ee2148c04b87911e1aa7d46df0781eb25b3248f1d9be4d734103";
	public static final String BNCB_USDT_90D = "0x74fb86324753ee2148c04b87911e1aa7d46df0781eb25b3248f1d9be4d734104";

	private static final Instant BTC_MATURITY = Instant.parse("2026-12-31T00:00:00Z");
	private static final List<MarketDefinition> CATALOG = List.of(
			new MarketDefinition(BTC_USDC_90D, "BTC", "USDC", BTC_MATURITY, "0.0850", "0.4200", "250000.00", "175000.00", "1.5000", "0.9500", "60000.00", "100.00"),
			new MarketDefinition(QQQB_USDC_90D, "QQQB", "USDC", Instant.parse("2027-01-29T00:00:00Z"), "0.0720", "0.3600", "180000.00", "120000.00", "1.3500", "0.9400", "600.00", "100.00"),
			new MarketDefinition(SPCXB_USDT_90D, "SPCXB", "USDT", Instant.parse("2027-03-26T00:00:00Z"), "0.1180", "0.5800", "95000.00", "72000.00", "1.6000", "0.9200", "425.00", "100.00"),
			new MarketDefinition(NVDAB_USDC_90D, "NVDAB", "USDC", Instant.parse("2026-12-19T00:00:00Z"), "0.0950", "0.4700", "210000.00", "145000.00", "1.4500", "0.9400", "180.00", "100.00"),
			new MarketDefinition(BNCB_USDT_90D, "BNCB", "USDT", Instant.parse("2027-02-26T00:00:00Z"), "0.1350", "0.6300", "65000.00", "48000.00", "1.7000", "0.9000", "15.00", "100.00"));

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
		return new MarketsResponse(CATALOG.stream().map(this::summary).toList(),
				new MarketMeta(activeProfile(), properties.rpc().chainId(), clock.instant(), "MOCK_CATALOG"));
	}

	public MarketDetail getMarket(String marketId) {
		if (!mockCatalogAvailable()) {
			throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Market catalog unavailable", "Mock catalog is available only in mock and test profiles.");
		}
		MarketDefinition definition = CATALOG.stream().filter(item -> item.id().equals(marketId)).findFirst()
				.orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Market not found", "No market exists for id " + marketId + "."));
		MarketSummary market = summary(definition);
		List<OrderBookLevel> borrowLevels = BTC_USDC_90D.equals(marketId)
				? List.of(new OrderBookLevel("0.0825", "75000.00"), new OrderBookLevel("0.0850", "100000.00"))
				: levels(definition.fixedApr(), definition.availableLiquidity(), "-0.0025");
		List<OrderBookLevel> lendLevels = BTC_USDC_90D.equals(marketId)
				? List.of(new OrderBookLevel("0.0875", "80000.00"), new OrderBookLevel("0.0900", "95000.00"))
				: levels(definition.fixedApr(), definition.offerDepth(), "0.0025");
		return new MarketDetail(market.id(), market.collateralAsset(), market.principalAsset(), market.maturity(),
				market.fixedApr(), market.utilization(), market.availableLiquidity(), market.offerDepth(), market.settlementState(),
				market.contractsReady(), definition.collateralRatio(), definition.patCoverage(), definition.strike(), "VERIFIED_PREVIEW",
				"ATTESTED_CUSTODIAN_PREVIEW", borrowLevels, lendLevels, definition.minimumAmount());
	}

	public Instant maturity() {
		return BTC_MATURITY;
	}

	private MarketSummary summary(MarketDefinition definition) {
		return new MarketSummary(definition.id(), definition.collateralAsset(), definition.principalAsset(), definition.maturity(),
				definition.fixedApr(), definition.utilization(), definition.availableLiquidity(), definition.offerDepth(),
				settlementState(definition.maturity()), runtimeConfigService.contractsReady());
	}

	private List<OrderBookLevel> levels(String fixedApr, String amount, String delta) {
		BigDecimal apr = new BigDecimal(fixedApr);
		BigDecimal available = new BigDecimal(amount);
		return List.of(
				new OrderBookLevel(apr.add(new BigDecimal(delta)).toPlainString(), available.multiply(new BigDecimal("0.45")).setScale(2).toPlainString()),
				new OrderBookLevel(apr.toPlainString(), available.multiply(new BigDecimal("0.55")).setScale(2).toPlainString()));
	}

	private String settlementState(Instant maturity) {
		return clock.instant().isBefore(maturity) ? "OPEN" : "MATURED";
	}

	private boolean mockCatalogAvailable() {
		String profile = activeProfile();
		return "mock".equals(profile) || "test".equals(profile);
	}

	private String activeProfile() {
		return Optional.ofNullable(environment.getActiveProfiles()).filter(profiles -> profiles.length > 0)
				.map(profiles -> profiles[0]).orElse("mock");
	}

	private record MarketDefinition(String id, String collateralAsset, String principalAsset, Instant maturity,
			String fixedApr, String utilization, String availableLiquidity, String offerDepth,
			String collateralRatio, String patCoverage, String strike, String minimumAmount) { }
}
