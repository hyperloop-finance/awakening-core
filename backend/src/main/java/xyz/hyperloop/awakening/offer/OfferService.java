package xyz.hyperloop.awakening.offer;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import xyz.hyperloop.awakening.api.ApiException;
import xyz.hyperloop.awakening.market.MarketService;

@Service
public class OfferService {
	private static final Instant CREATED_AT = Instant.parse("2026-08-24T00:00:00Z");
	private static final Instant NOW = Instant.parse("2026-08-24T00:00:00Z");
	private final MarketService marketService;
	private final AtomicLong nextId = new AtomicLong(1);
	private final ConcurrentHashMap<String, Offer> offers = new ConcurrentHashMap<>();

	public OfferService(MarketService marketService) {
		this.marketService = marketService;
	}

	public Offer create(SignedOfferRequest request) {
		validate(request);
		String id = "offer-" + nextId.getAndIncrement();
		Offer offer = new Offer(id, request.wallet().toLowerCase(Locale.ROOT), request.marketId(),
				decimal(request.amount(), "amount"), decimal(request.apr(), "apr"), request.expiry(), request.signature(), "OPEN", CREATED_AT);
		offers.put(id, offer);
		return offer;
	}

	private void validate(SignedOfferRequest request) {
		if (request == null || request.wallet() == null || !request.wallet().matches("0x[0-9a-fA-F]{40}")) {
			throw invalid("wallet must be 0x followed by 40 hexadecimal characters.");
		}
		marketService.getMarket(request.marketId());
		positive(request.amount(), "amount");
		positive(request.apr(), "apr");
		if (request.expiry() == null || !request.expiry().isAfter(NOW)) {
			throw invalid("expiry must be in the future.");
		}
		if (request.signature() == null || !request.signature().matches("0x[0-9a-fA-F]{130}")) {
			throw invalid("signature must be a 65-byte hexadecimal EVM signature.");
		}
	}

	private void positive(String value, String field) {
		try {
			if (new BigDecimal(value).signum() <= 0) {
				throw invalid(field + " must be greater than zero.");
			}
		} catch (NumberFormatException | NullPointerException exception) {
			throw invalid(field + " must be a decimal string.");
		}
	}

	private String decimal(String value, String field) {
		try {
			return new BigDecimal(value).setScale(2, RoundingMode.HALF_UP).toPlainString();
		} catch (NumberFormatException | NullPointerException exception) {
			throw invalid(field + " must be a decimal string.");
		}
	}

	private ApiException invalid(String detail) {
		return new ApiException(HttpStatus.BAD_REQUEST, "Validation failed", detail);
	}
}
