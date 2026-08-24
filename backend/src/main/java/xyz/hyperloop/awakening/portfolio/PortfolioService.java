package xyz.hyperloop.awakening.portfolio;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import xyz.hyperloop.awakening.api.ApiException;
import xyz.hyperloop.awakening.market.MarketService;

@Service
public class PortfolioService {
	private static final String DEMO_WALLET = "0x1111111111111111111111111111111111111111";
	private final MarketService marketService;

	public PortfolioService(MarketService marketService) {
		this.marketService = marketService;
	}

	public Portfolio getPortfolio(String wallet) {
		if (!wallet.matches("0x[0-9a-fA-F]{40}")) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "Validation failed", "wallet must be 0x followed by 40 hexadecimal characters.");
		}
		String normalizedWallet = wallet.toLowerCase(Locale.ROOT);
		if (!DEMO_WALLET.equals(normalizedWallet)) {
			return new Portfolio(normalizedWallet, new PortfolioTotals("0.00", "0.00", "0.00000000"), List.of(), List.of());
		}
		Position borrow = new Position("borrow-demo-1", MarketService.BTC_USDC_90D, "BORROW", "1200.00", "0.03000000",
				marketService.maturity(), "OPEN");
		Position lend = new Position("lend-demo-1", MarketService.BTC_USDC_90D, "LEND", "800.00", "0.00000000",
				Instant.parse("2026-05-01T00:00:00Z"), "MATURED");
		return new Portfolio(normalizedWallet, new PortfolioTotals("1200.00", "800.00", "0.03000000"), List.of(borrow), List.of(lend));
	}
}
