package xyz.hyperloop.awakening.quote;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import xyz.hyperloop.awakening.market.MarketService;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(QuoteClockApiTest.FixedClockConfiguration.class)
class QuoteClockApiTest {
	@TestConfiguration
	static class FixedClockConfiguration {
		@Bean
		@Primary
		Clock fixedClock() {
			return Clock.fixed(Instant.parse("2026-08-24T12:00:00Z"), ZoneOffset.UTC);
		}
	}

	@Autowired
	private MockMvc mockMvc;

	@Test
	void calculatesQuoteExpiryFromInjectedClock() throws Exception {
		mockMvc.perform(get("/api/v1/markets/{marketId}/quote", MarketService.BTC_USDC_90D)
				.queryParam("side", "BORROW").queryParam("amount", "1000"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.expiresAt").value("2026-08-24T12:05:00Z"));
	}
}
