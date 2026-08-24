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
class OfferSignatureApiTest {
	@Autowired
	private MockMvc mockMvc;

	@Test
	void rejectsSignerThatDoesNotMatchWallet() throws Exception {
		var signer = MockOfferRequestFixture.signer(1);
		String payload = MockOfferRequestFixture.json(signer, MockOfferRequestFixture.wallet(MockOfferRequestFixture.signer(2)), "1000", "0.0850", Instant.parse("2030-01-01T00:00:00Z"));
		expectValidation(payload, "signature signer does not match wallet.");
	}

	@Test
	void rejectsSignatureWithInvalidRecoveryId() throws Exception {
		var signer = MockOfferRequestFixture.signer(1);
		String payload = MockOfferRequestFixture.json(signer, MockOfferRequestFixture.wallet(signer), "1000", "0.0850", Instant.parse("2030-01-01T00:00:00Z"));
		expectValidation(payload.replaceFirst("[0-9a-fA-F]{2}\"\\s*}$", "00\"}"), "signature recovery id must be 27 or 28.");
	}

	@Test
	void rejectsSignatureWithUnrecoverableRValue() throws Exception {
		var signer = MockOfferRequestFixture.signer(1);
		String payload = MockOfferRequestFixture.json(signer, MockOfferRequestFixture.wallet(signer), "1000", "0.0850", Instant.parse("2030-01-01T00:00:00Z"));
		String zeroR = payload.replaceFirst("(\\\"signature\\\":\\\"0x)[0-9a-fA-F]{64}", "$1" + "0".repeat(64));
		expectValidation(zeroR, "signature cannot be recovered.");
	}

	@Test
	void rejectsMissingMockSigningScheme() throws Exception {
		var signer = MockOfferRequestFixture.signer(1);
		String payload = MockOfferRequestFixture.json(signer, MockOfferRequestFixture.wallet(signer), "1000", "0.0850", Instant.parse("2030-01-01T00:00:00Z"))
				.replace("\"signingScheme\":\"EIP191_MOCK\",", "");
		expectValidation(payload, "signingScheme must be EIP191_MOCK while contracts are not deployed.");
	}

	@Test
	void rejectsExpiredOffer() throws Exception {
		var signer = MockOfferRequestFixture.signer(1);
		String payload = MockOfferRequestFixture.json(signer, MockOfferRequestFixture.wallet(signer), "1000", "0.0850", Instant.parse("2020-01-01T00:00:00Z"));
		expectValidation(payload, "expiry must be in the future.");
	}

	private void expectValidation(String payload, String detail) throws Exception {
		mockMvc.perform(post("/api/v1/offers").contentType(APPLICATION_JSON).content(payload))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Validation failed"))
				.andExpect(jsonPath("$.detail").value(detail))
				.andExpect(jsonPath("$.stackTrace").doesNotExist());
	}
}
