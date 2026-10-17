package xyz.hyperloop.awakening.portfolio;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@org.springframework.context.annotation.Profile("!bsc-testnet")
@RequestMapping("/api/v1/portfolio")
public class PortfolioController {
	private final PortfolioService portfolioService;

	public PortfolioController(PortfolioService portfolioService) {
		this.portfolioService = portfolioService;
	}

	@GetMapping("/{wallet}")
	public Portfolio getPortfolio(@PathVariable String wallet) {
		return portfolioService.getPortfolio(wallet);
	}
}
