package xyz.hyperloop.awakening.order;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
class OrderApiTest {
	private static final String WALLET = "0xde00000000000000000000000000000000000001";
	private static final String MARKET = "0x8f0d4f673bd9de1d1f927cbf3abfc7b77c680f1d817e113d5603bb483fa041e6";
	@Autowired MockMvc mockMvc;

	@Test
	void createsListsAndCancelsAnOrder() throws Exception {
		String body = """
				{"wallet":"%s","marketId":"%s","side":"BORROW","amount":"5000.00","apr":"0.0810","expiry":"2026-12-01T00:00:00Z"}
				""".formatted(WALLET, MARKET);
		mockMvc.perform(post("/api/v1/orders").contentType(APPLICATION_JSON).content(body))
				.andExpect(status().isCreated()).andExpect(jsonPath("$.id").value("order-1"))
				.andExpect(jsonPath("$.amount").value("5000")).andExpect(jsonPath("$.filledAmount").value("0"))
				.andExpect(jsonPath("$.remainingAmount").value("5000")).andExpect(jsonPath("$.status").value("OPEN"));
		mockMvc.perform(get("/api/v1/orders").param("wallet", WALLET).param("side", "BORROW"))
				.andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value("order-1"));
		mockMvc.perform(delete("/api/v1/orders/order-1").param("wallet", WALLET))
				.andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
	}

	@Test
	void rejectsInvalidOrder() throws Exception {
		mockMvc.perform(post("/api/v1/orders").contentType(APPLICATION_JSON).content("{}"))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.title").value("Validation failed"));
	}
}
