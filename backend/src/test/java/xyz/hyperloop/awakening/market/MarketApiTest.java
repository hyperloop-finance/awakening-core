package xyz.hyperloop.awakening.market;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MarketApiTest {

	static final String BTC_USDC_90D = "0x8f0d4f673bd9de1d1f927cbf3abfc7b77c680f1d817e113d5603bb483fa041e6";

	@Autowired
	private MockMvc mockMvc;

	@Test
	void listsDeterministicBtcMarketsWithMetadata() throws Exception {
		mockMvc.perform(get("/api/v1/markets"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data[0].id").value(BTC_USDC_90D))
				.andExpect(jsonPath("$.data[0].collateralAsset").value("BTC"))
				.andExpect(jsonPath("$.meta.profile").value("test"))
				.andExpect(jsonPath("$.meta.chainId").value(31337));
	}

	@Test
	void returnsCompleteMarketDetail() throws Exception {
		mockMvc.perform(get("/api/v1/markets/{marketId}", BTC_USDC_90D))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(BTC_USDC_90D))
				.andExpect(jsonPath("$.strike").value("60000.00"))
				.andExpect(jsonPath("$.patStatus").value("VERIFIED_PREVIEW"))
				.andExpect(jsonPath("$.patSource").value("ATTESTED_CUSTODIAN_PREVIEW"))
				.andExpect(jsonPath("$.patCoverage").value("0.9500"))
				.andExpect(jsonPath("$.borrowLevels[0].apr").value("0.0825"))
				.andExpect(jsonPath("$.borrowLevels[0].availableAmount").value("75000.00"))
				.andExpect(jsonPath("$.lendLevels[0].apr").value("0.0875"))
				.andExpect(jsonPath("$.collateralRatio").value("1.5000"))
				.andExpect(jsonPath("$.minimumAmount").value("100.00"));
	}

	@Test
	void returnsProblemDetailsForMissingMarket() throws Exception {
		mockMvc.perform(get("/api/v1/markets/{marketId}", "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.title").value("Market not found"));
	}
}
