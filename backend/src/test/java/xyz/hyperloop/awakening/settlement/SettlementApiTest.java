package xyz.hyperloop.awakening.settlement;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(SettlementApiTest.ClockConfig.class)
class SettlementApiTest {
	static final String WALLET = "0xde00000000000000000000000000000000000001";
	@TestConfiguration static class ClockConfig {
		@Bean @Primary Clock fixedClock() { return Clock.fixed(Instant.parse("2027-01-01T00:00:00Z"), ZoneOffset.UTC); }
	}
	@Autowired MockMvc mockMvc;

	@Test
	void listsAndAdvancesBorrowSettlementPreview() throws Exception {
		mockMvc.perform(get("/api/v1/settlements/{wallet}", WALLET)).andExpect(status().isOk())
				.andExpect(jsonPath("$[0].positionId").value("borrow-demo-1"))
				.andExpect(jsonPath("$[0].phase").value("REPAYMENT_AVAILABLE"))
				.andExpect(jsonPath("$[0].availableActions[0]").value("SIMULATE_REPAY_DEBT"));
		String repay = "{\"wallet\":\"" + WALLET + "\",\"action\":\"SIMULATE_REPAY_DEBT\"}";
		mockMvc.perform(post("/api/v1/settlements/borrow-demo-1/actions").contentType(APPLICATION_JSON).content(repay))
				.andExpect(status().isOk()).andExpect(jsonPath("$.simulated").value(true))
				.andExpect(jsonPath("$.availableActions[0]").value("SIMULATE_RECOVER_COLLATERAL"));
		String recover = "{\"wallet\":\"" + WALLET + "\",\"action\":\"SIMULATE_RECOVER_COLLATERAL\"}";
		mockMvc.perform(post("/api/v1/settlements/borrow-demo-1/actions").contentType(APPLICATION_JSON).content(recover))
				.andExpect(status().isOk()).andExpect(jsonPath("$.phase").value("FINALIZED"));
	}
}
