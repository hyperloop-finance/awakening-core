package xyz.hyperloop.awakening.quote;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@org.springframework.context.annotation.Profile("!bsc-testnet & !arbitrum-sepolia & !robinhood-testnet")
@RequestMapping("/api/v1/markets/{marketId}/quote")
public class QuoteController {
	private final QuoteService quoteService;

	public QuoteController(QuoteService quoteService) {
		this.quoteService = quoteService;
	}

	@GetMapping
	public Quote getQuote(@PathVariable String marketId, @RequestParam(required = false) String side,
			@RequestParam(required = false) String amount) {
		return quoteService.quote(marketId, side, amount);
	}
}
