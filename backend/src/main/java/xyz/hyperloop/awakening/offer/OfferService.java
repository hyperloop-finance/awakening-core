package xyz.hyperloop.awakening.offer;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.SignatureException;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

import xyz.hyperloop.awakening.api.ApiException;
import xyz.hyperloop.awakening.api.DecimalStrings;
import xyz.hyperloop.awakening.config.AwakeningProperties;
import xyz.hyperloop.awakening.config.RuntimeConfigService;
import xyz.hyperloop.awakening.market.MarketDetail;
import xyz.hyperloop.awakening.market.MarketService;

@Service
public class OfferService {
	private static final String EIP191_MOCK = "EIP191_MOCK";
	private final MarketService marketService;
	private final RuntimeConfigService runtimeConfigService;
	private final AwakeningProperties properties;
	private final Clock clock;
	private final AtomicLong nextId = new AtomicLong(1);
	private final ConcurrentHashMap<String, Offer> offers = new ConcurrentHashMap<>();

	public OfferService(MarketService marketService, RuntimeConfigService runtimeConfigService, AwakeningProperties properties, Clock clock) {
		this.marketService = marketService;
		this.runtimeConfigService = runtimeConfigService;
		this.properties = properties;
		this.clock = clock;
	}

	public Offer create(SignedOfferRequest request) {
		ValidatedOffer validated = validate(request);
		String id = "offer-" + nextId.getAndIncrement();
		Offer offer = new Offer(id, EIP191_MOCK, request.wallet().toLowerCase(Locale.ROOT), request.marketId(),
				validated.amount(), validated.apr(), request.expiry(), request.signature(), "OPEN", clock.instant());
		offers.put(id, offer);
		return offer;
	}

	private ValidatedOffer validate(SignedOfferRequest request) {
		if (request == null || request.wallet() == null || !request.wallet().matches("0x[0-9a-fA-F]{40}")) {
			throw invalid("wallet must be 0x followed by 40 hexadecimal characters.");
		}
		MarketDetail market = marketService.getMarket(request.marketId());
		if (!"OPEN".equals(market.settlementState())) {
			throw invalid("market is not open for new offers.");
		}
		BigDecimal amount = positive(request.amount(), "amount");
		BigDecimal apr = positive(request.apr(), "apr");
		if (request.expiry() == null || !request.expiry().isAfter(clock.instant())) {
			throw invalid("expiry must be in the future.");
		}
		if (runtimeConfigService.contractsReady()) {
			throw new ApiException(HttpStatus.CONFLICT, "Signing verifier unavailable", "EIP-712 verification is unavailable until deployed contract type hashes are configured.");
		}
		if (!EIP191_MOCK.equals(request.signingScheme())) {
			throw invalid("signingScheme must be EIP191_MOCK while contracts are not deployed.");
		}
		String normalizedAmount = DecimalStrings.normalize(amount);
		String normalizedApr = DecimalStrings.normalize(apr);
		verifyMockSignature(request, normalizedAmount, normalizedApr);
		return new ValidatedOffer(normalizedAmount, normalizedApr);
	}

	private BigDecimal positive(String value, String field) {
		BigDecimal decimal = DecimalStrings.parse(value, field);
		if (decimal.signum() <= 0) {
			throw invalid(field + " must be greater than zero.");
		}
		return decimal;
	}

	private void verifyMockSignature(SignedOfferRequest request, String amount, String apr) {
		if (request.signature() == null || !request.signature().matches("0x[0-9a-fA-F]{130}")) {
			throw invalid("signature must be a 65-byte hexadecimal EVM signature.");
		}
		byte[] signature = Numeric.hexStringToByteArray(request.signature());
		byte recoveryId = signature[64];
		if (recoveryId != 27 && recoveryId != 28) {
			throw invalid("signature recovery id must be 27 or 28.");
		}
		try {
			Sign.SignatureData data = new Sign.SignatureData(recoveryId, slice(signature, 0), slice(signature, 32));
			String recovered = "0x" + Keys.getAddress(Sign.signedPrefixedMessageToKey(mockMessage(request.wallet(), request.marketId(), amount, apr, request.expiry()).getBytes(StandardCharsets.UTF_8), data));
			if (!recovered.equalsIgnoreCase(request.wallet())) {
				throw invalid("signature signer does not match wallet.");
			}
		} catch (SignatureException | RuntimeException exception) {
			if (exception instanceof ApiException apiException) {
				throw apiException;
			}
			throw invalid("signature cannot be recovered.");
		}
	}

	private byte[] slice(byte[] bytes, int from) {
		byte[] result = new byte[32];
		System.arraycopy(bytes, from, result, 0, 32);
		return result;
	}

	private String mockMessage(String wallet, String marketId, String amount, String apr, Instant expiry) {
		return "Awakening Mock Offer\n"
				+ "chainId:" + properties.rpc().chainId() + "\n"
				+ "wallet:" + wallet.toLowerCase(Locale.ROOT) + "\n"
				+ "marketId:" + marketId + "\n"
				+ "amount:" + amount + "\n"
				+ "apr:" + apr + "\n"
				+ "expiry:" + expiry;
	}

	private ApiException invalid(String detail) {
		return new ApiException(HttpStatus.BAD_REQUEST, "Validation failed", detail);
	}

	private record ValidatedOffer(String amount, String apr) { }
}
