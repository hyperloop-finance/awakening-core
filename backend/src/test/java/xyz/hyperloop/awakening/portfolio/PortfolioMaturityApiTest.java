package xyz.hyperloop.awakening.portfolio;

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
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(PortfolioMaturityApiTest.FixedClockConfiguration.class)
class PortfolioMaturityApiTest {
	@TestConfiguration
	static class FixedClockConfiguration {
		@Bean
		@Primary
		Clock fixedClock() {
			return Clock.fixed(Instant.parse("2027-01-01T00:00:00Z"), ZoneOffset.UTC);
		}
	}

	@Autowired
	private MockMvc mockMvc;

	@Test
	void derivesBorrowAndLendPositionStatesFromClockAndMaturity() throws Exception {
		mockMvc.perform(get("/api/v1/portfolio/0x1111111111111111111111111111111111111111"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.borrowPositions[0].settlementState").value("MATURED"))
				.andExpect(jsonPath("$.lendPositions[0].settlementState").value("MATURED"));
	}
}
