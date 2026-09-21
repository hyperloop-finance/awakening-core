package xyz.hyperloop.awakening.order;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {
	private final OrderService orders;
	public OrderController(OrderService orders) { this.orders = orders; }

	@GetMapping
	public List<Order> list(@RequestParam String wallet, @RequestParam(required = false) String side) {
		return orders.list(wallet, side);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public Order create(@RequestBody CreateOrderRequest request) { return orders.create(request); }

	@DeleteMapping("/{orderId}")
	public Order cancel(@PathVariable String orderId, @RequestParam String wallet) { return orders.cancel(orderId, wallet); }
}
