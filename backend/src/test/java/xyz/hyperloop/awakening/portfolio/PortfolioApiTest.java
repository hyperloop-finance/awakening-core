package xyz.hyperloop.awakening.portfolio;

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
class PortfolioApiTest {
	private static final String DEMO_WALLET = "0x1111111111111111111111111111111111111111";
	private static final String EMPTY_WALLET = "0x2222222222222222222222222222222222222222";

	@Autowired
	private MockMvc mockMvc;

	@Test
	void returnsBorrowAndLendPositionsForDemoWallet() throws Exception {
		mockMvc.perform(get("/api/v1/portfolio/{wallet}", DEMO_WALLET))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.wallet").value(DEMO_WALLET))
				.andExpect(jsonPath("$.borrowPositions[0].side").value("BORROW"))
				.andExpect(jsonPath("$.lendPositions[0].side").value("LEND"))
				.andExpect(jsonPath("$.totals.collateralLocked").value("0.03000000"));
	}

	@Test
	void returnsEmptyPortfolioForUnknownWallet() throws Exception {
		mockMvc.perform(get("/api/v1/portfolio/{wallet}", EMPTY_WALLET))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.borrowPositions").isEmpty())
				.andExpect(jsonPath("$.lendPositions").isEmpty())
				.andExpect(jsonPath("$.totals.borrowedPrincipal").value("0.00"));
	}

	@Test
	void rejectsMalformedWalletWithProblemDetails() throws Exception {
		mockMvc.perform(get("/api/v1/portfolio/not-a-wallet"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.type").value("https://awakening.xyz/problems/400"))
				.andExpect(jsonPath("$.title").value("Validation failed"));
	}
}
