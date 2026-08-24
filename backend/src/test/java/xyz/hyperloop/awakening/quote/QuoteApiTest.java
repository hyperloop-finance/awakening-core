package xyz.hyperloop.awakening.quote;

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
class QuoteApiTest {

	private static final String MARKET_ID = "0x8f0d4f673bd9de1d1f927cbf3abfc7b77c680f1d817e113d5603bb483fa041e6";

	@Autowired
	private MockMvc mockMvc;

	@Test
	void returnsBorrowQuoteWithExplicitDecimalRounding() throws Exception {
		mockMvc.perform(get("/api/v1/markets/{marketId}/quote", MARKET_ID)
				.queryParam("side", "BORROW").queryParam("amount", "1000"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.side").value("BORROW"))
				.andExpect(jsonPath("$.principal").value("1000"))
				.andExpect(jsonPath("$.collateralRequirement").value("0.02500000"))
				.andExpect(jsonPath("$.interest").value("20.958904"))
				.andExpect(jsonPath("$.totalDueOrPayout").value("1023.958904"));
	}

	@Test
	void returnsLendQuoteWithPayoutAfterFee() throws Exception {
		mockMvc.perform(get("/api/v1/markets/{marketId}/quote", MARKET_ID)
				.queryParam("side", "LEND").queryParam("amount", "1000"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.side").value("LEND"))
				.andExpect(jsonPath("$.collateralRequirement").value("0.00000000"))
				.andExpect(jsonPath("$.totalDueOrPayout").value("1017.958904"));
	}

	@Test
	void rejectsZeroAndNegativeAmountsWithProblemDetails() throws Exception {
		for (String amount : new String[] { "0", "-1" }) {
			mockMvc.perform(get("/api/v1/markets/{marketId}/quote", MARKET_ID)
					.queryParam("side", "BORROW").queryParam("amount", amount))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.status").value(400))
					.andExpect(jsonPath("$.title").value("Validation failed"));
		}
	}

	@Test
	void rejectsUnsupportedQuoteSideWithProblemDetails() throws Exception {
		mockMvc.perform(get("/api/v1/markets/{marketId}/quote", MARKET_ID)
				.queryParam("side", "SWAP").queryParam("amount", "1000"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.title").value("Validation failed"));
	}
}
