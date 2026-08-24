package xyz.hyperloop.awakening.quote;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import xyz.hyperloop.awakening.api.ApiException;
import xyz.hyperloop.awakening.market.MarketDetail;
import xyz.hyperloop.awakening.market.MarketService;

@Service
public class QuoteService {
	private static final BigDecimal BTC_PRICE_USDC = new BigDecimal("60000");
	private static final BigDecimal COLLATERAL_RATIO = new BigDecimal("1.5");
	private static final BigDecimal PROTOCOL_FEE_RATE = new BigDecimal("0.003");
	private static final BigDecimal TERM_DAYS = new BigDecimal("90");
	private static final BigDecimal DAYS_PER_YEAR = new BigDecimal("365");
	private static final Instant EXPIRES_AT = Instant.parse("2026-08-24T00:05:00Z");
	private final MarketService marketService;

	public QuoteService(MarketService marketService) {
		this.marketService = marketService;
	}

	public Quote quote(String marketId, String rawSide, String rawAmount) {
		MarketDetail market = marketService.getMarket(marketId);
		Side side = parseSide(rawSide);
		BigDecimal amount = parsePositiveAmount(rawAmount);
		BigDecimal principal = amount.setScale(2, RoundingMode.HALF_UP);
		BigDecimal interest = amount.multiply(marketService.apr()).multiply(TERM_DAYS).divide(DAYS_PER_YEAR, 6, RoundingMode.HALF_UP);
		BigDecimal fee = amount.multiply(PROTOCOL_FEE_RATE).setScale(6, RoundingMode.HALF_UP);
		BigDecimal collateral = side == Side.BORROW
				? amount.multiply(COLLATERAL_RATIO).divide(BTC_PRICE_USDC, 8, RoundingMode.HALF_UP)
				: BigDecimal.ZERO.setScale(8);
		BigDecimal total = side == Side.BORROW ? amount.add(interest).add(fee) : amount.add(interest).subtract(fee);
		return new Quote(market.id(), side.name(), decimal(principal, 2), decimal(collateral, 8), decimal(interest, 6), decimal(fee, 6),
				decimal(total, 6), market.fixedApr(), market.maturity(), EXPIRES_AT, steps(side));
	}

	private Side parseSide(String rawSide) {
		try {
			return Side.valueOf(rawSide);
		} catch (IllegalArgumentException | NullPointerException exception) {
			throw validation("side must be BORROW or LEND.");
		}
	}

	private BigDecimal parsePositiveAmount(String rawAmount) {
		try {
			BigDecimal amount = new BigDecimal(rawAmount);
			if (amount.signum() <= 0) {
				throw validation("amount must be greater than zero.");
			}
			return amount;
		} catch (NumberFormatException | NullPointerException exception) {
			throw validation("amount must be a decimal string.");
		}
	}

	private ApiException validation(String detail) {
		return new ApiException(HttpStatus.BAD_REQUEST, "Validation failed", detail);
	}

	private String decimal(BigDecimal value, int scale) {
		return value.setScale(scale, RoundingMode.HALF_UP).toPlainString();
	}

	private List<String> steps(Side side) {
		return side == Side.BORROW
				? List.of("Review BTC collateral requirement", "Sign simulated borrow intent", "Receive USDC principal")
				: List.of("Review fixed-rate offer", "Sign simulated lend offer", "Reserve USDC liquidity");
	}

	private enum Side { BORROW, LEND }
}
