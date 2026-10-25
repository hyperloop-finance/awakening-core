package xyz.hyperloop.awakening.market;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@org.springframework.context.annotation.Profile("!bsc-testnet & !arbitrum-sepolia & !robinhood-testnet")
@RequestMapping("/api/v1/markets")
public class MarketController {
	private final MarketService marketService;

	public MarketController(MarketService marketService) {
		this.marketService = marketService;
	}

	@GetMapping
	public MarketsResponse listMarkets() {
		return marketService.listMarkets();
	}

	@GetMapping("/{marketId}")
	public MarketDetail getMarket(@PathVariable String marketId) {
		return marketService.getMarket(marketId);
	}
}
