package xyz.hyperloop.awakening.offer;

import static org.springframework.http.MediaType.APPLICATION_JSON;
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
class OfferApiTest {
	private static final String VALID_OFFER = """
			{
			  "wallet":"0x1111111111111111111111111111111111111111",
			  "marketId":"0x8f0d4f673bd9de1d1f927cbf3abfc7b77c680f1d817e113d5603bb483fa041e6",
			  "amount":"1000.00",
			  "apr":"0.0850",
			  "expiry":"2030-01-01T00:00:00Z",
			  "signature":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
			}
			""";

	@Autowired
	private MockMvc mockMvc;

	@Test
	void storesValidSignedOfferInMockMode() throws Exception {
		mockMvc.perform(post("/api/v1/offers").contentType(APPLICATION_JSON).content(VALID_OFFER))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").value("offer-1"))
				.andExpect(jsonPath("$.status").value("OPEN"))
				.andExpect(jsonPath("$.amount").value("1000.00"));
	}

	@Test
	void rejectsInvalidSignedOfferWithProblemDetails() throws Exception {
		String invalidOffer = VALID_OFFER.replace("1000.00", "0").replace("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "12");
		mockMvc.perform(post("/api/v1/offers").contentType(APPLICATION_JSON).content(invalidOffer))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.title").value("Validation failed"));
	}
}
