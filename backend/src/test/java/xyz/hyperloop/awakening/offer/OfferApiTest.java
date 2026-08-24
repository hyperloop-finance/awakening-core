package xyz.hyperloop.awakening.offer;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OfferApiTest {
	@Autowired
	private MockMvc mockMvc;

	@Test
	void storesRecoverableMockSignedOfferWithoutChangingAprPrecision() throws Exception {
		var signer = MockOfferRequestFixture.signer(1);
		String validOffer = MockOfferRequestFixture.json(signer, MockOfferRequestFixture.wallet(signer), "1000.00", "0.0850", Instant.parse("2030-01-01T00:00:00Z"));
		mockMvc.perform(post("/api/v1/offers").contentType(APPLICATION_JSON).content(validOffer))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").isString())
				.andExpect(jsonPath("$.status").value("OPEN"))
				.andExpect(jsonPath("$.amount").value("1000"))
				.andExpect(jsonPath("$.apr").value("0.085"))
				.andExpect(jsonPath("$.signingScheme").value("EIP191_MOCK"));
	}

	@Test
	void rejectsInvalidSignedOfferWithProblemDetails() throws Exception {
		var signer = MockOfferRequestFixture.signer(1);
		String invalidOffer = MockOfferRequestFixture.json(signer, MockOfferRequestFixture.wallet(signer), "0", "0.0850", Instant.parse("2030-01-01T00:00:00Z"));
		mockMvc.perform(post("/api/v1/offers").contentType(APPLICATION_JSON).content(invalidOffer))
				.andExpect(status().isBadRequest())
				.andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().contentTypeCompatibleWith("application/problem+json"))
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.title").value("Validation failed"));
	}
}
