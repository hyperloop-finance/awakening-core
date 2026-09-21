package xyz.hyperloop.awakening.order;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import xyz.hyperloop.awakening.api.ApiException;
import xyz.hyperloop.awakening.api.DecimalStrings;
import xyz.hyperloop.awakening.market.MarketDetail;
import xyz.hyperloop.awakening.market.MarketService;

@Service
public class OrderService {
	private final MarketService markets;
	private final Clock clock;
	private final AtomicLong nextId = new AtomicLong(1);
	private final ConcurrentHashMap<String, Order> orders = new ConcurrentHashMap<>();

	public OrderService(MarketService markets, Clock clock) {
		this.markets = markets;
		this.clock = clock;
	}

	public List<Order> list(String wallet, String side) {
		String owner = wallet(wallet);
		String normalizedSide = side == null ? null : side(side);
		return orders.values().stream().map(this::withExpiry)
				.filter(order -> order.wallet().equals(owner))
				.filter(order -> normalizedSide == null || order.side().equals(normalizedSide))
				.sorted(Comparator.comparing(Order::createdAt).reversed()).toList();
	}

	public Order create(CreateOrderRequest request) {
		if (request == null) throw invalid("request body is required.");
		String owner = wallet(request.wallet());
		String normalizedSide = side(request.side());
		MarketDetail market = markets.getMarket(request.marketId());
		if (!"OPEN".equals(market.settlementState())) throw invalid("market is not open for new orders.");
		BigDecimal amount = positive(request.amount(), "amount");
		if (amount.compareTo(new BigDecimal(market.minimumAmount())) < 0) throw invalid("amount is below the market minimum.");
		BigDecimal apr = positive(request.apr(), "apr");
		if (apr.compareTo(BigDecimal.ONE) > 0) throw invalid("apr must not exceed 1.0.");
		if (request.expiry() == null || !request.expiry().isAfter(clock.instant()) || request.expiry().isAfter(market.maturity())) {
			throw invalid("expiry must be in the future and no later than market maturity.");
		}
		String id = "order-" + nextId.getAndIncrement();
		String normalizedAmount = DecimalStrings.normalize(amount);
		Order order = new Order(id, owner, request.marketId(), normalizedSide, normalizedAmount, "0", normalizedAmount,
				DecimalStrings.normalize(apr), request.expiry(), OrderStatus.OPEN, clock.instant());
		orders.put(id, order);
		return order;
	}

	public Order cancel(String id, String wallet) {
		String owner = wallet(wallet);
		Order order = orders.get(id);
		if (order == null || !order.wallet().equals(owner)) throw new ApiException(HttpStatus.NOT_FOUND, "Order not found", "No order exists for this wallet.");
		order = withExpiry(order);
		if (order.status() != OrderStatus.OPEN && order.status() != OrderStatus.PARTIALLY_FILLED) {
			throw new ApiException(HttpStatus.CONFLICT, "Order cannot be cancelled", "Only open orders can be cancelled.");
		}
		Order cancelled = copyWithStatus(order, OrderStatus.CANCELLED);
		orders.put(id, cancelled);
		return cancelled;
	}

	private Order withExpiry(Order order) {
		if ((order.status() == OrderStatus.OPEN || order.status() == OrderStatus.PARTIALLY_FILLED) && !clock.instant().isBefore(order.expiry())) {
			Order expired = copyWithStatus(order, OrderStatus.EXPIRED);
			orders.put(order.id(), expired);
			return expired;
		}
		return order;
	}

	private Order copyWithStatus(Order order, OrderStatus status) {
		return new Order(order.id(), order.wallet(), order.marketId(), order.side(), order.amount(), order.filledAmount(),
				order.remainingAmount(), order.apr(), order.expiry(), status, order.createdAt());
	}

	private String wallet(String value) {
		if (value == null || !value.matches("0x[0-9a-fA-F]{40}")) throw invalid("wallet must be 0x followed by 40 hexadecimal characters.");
		return value.toLowerCase(Locale.ROOT);
	}

	private String side(String value) {
		if (value == null || !(value.equalsIgnoreCase("BORROW") || value.equalsIgnoreCase("LEND"))) throw invalid("side must be BORROW or LEND.");
		return value.toUpperCase(Locale.ROOT);
	}

	private BigDecimal positive(String value, String field) {
		BigDecimal decimal = DecimalStrings.parse(value, field);
		if (decimal.signum() <= 0) throw invalid(field + " must be greater than zero.");
		return decimal;
	}

	private ApiException invalid(String detail) {
		return new ApiException(HttpStatus.BAD_REQUEST, "Validation failed", detail);
	}
}
