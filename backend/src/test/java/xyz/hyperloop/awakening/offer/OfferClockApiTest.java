package xyz.hyperloop.awakening.offer;

import static org.springframework.http.MediaType.APPLICATION_JSON;
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
@Import(OfferClockApiTest.FixedClockConfiguration.class)
class OfferClockApiTest {
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
	void usesInjectedClockForOfferExpiryAndCreatedAt() throws Exception {
		var signer = MockOfferRequestFixture.signer(1);
		String payload = MockOfferRequestFixture.json(signer, MockOfferRequestFixture.wallet(signer), "1000", "0.0850", Instant.parse("2026-08-24T12:01:00Z"));
		mockMvc.perform(post("/api/v1/offers").contentType(APPLICATION_JSON).content(payload))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.createdAt").value("2026-08-24T12:00:00Z"));
	}
}
