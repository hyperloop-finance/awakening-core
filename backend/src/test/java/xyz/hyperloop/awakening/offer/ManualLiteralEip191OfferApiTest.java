package xyz.hyperloop.awakening.offer;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.web3j.crypto.ECKeyPair;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ManualLiteralEip191OfferApiTest {
	private static final String MARKET_ID = "0x8f0d4f673bd9de1d1f927cbf3abfc7b77c680f1d817e113d5603bb483fa041e6";

	@Autowired
	private MockMvc mockMvc;

	@Test
	void acceptsSignatureOverManualUtf8LfCanonicalPayload() throws Exception {
		ECKeyPair signer = ECKeyPair.create(BigInteger.ONE);
		String wallet = "0x" + Keys.getAddress(signer);
		String literalPayload = ("Awakening Mock Offer\n"
				+ "chainId:31337\n"
				+ "wallet:" + wallet + "\n"
				+ "marketId:" + MARKET_ID + "\n"
				+ "amount:1000\n"
				+ "apr:0.085\n"
				+ "expiry:2030-01-01T00:00:00Z");
		Sign.SignatureData signature = Sign.signPrefixedMessage(literalPayload.getBytes(StandardCharsets.UTF_8), signer);
		String encodedSignature = "0x" + Numeric.toHexStringNoPrefix(signature.getR()) + Numeric.toHexStringNoPrefix(signature.getS())
				+ Numeric.toHexStringNoPrefix(signature.getV());
		String request = """
			{
			  "signingScheme":"EIP191_MOCK",
			  "wallet":"%s",
			  "marketId":"%s",
			  "amount":"1000.00",
			  "apr":"0.0850",
			  "expiry":"2030-01-01T00:00:00Z",
			  "signature":"%s"
			}
			""".formatted(wallet, MARKET_ID, encodedSignature);

		mockMvc.perform(post("/api/v1/offers").contentType(APPLICATION_JSON).content(request))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.amount").value("1000"))
				.andExpect(jsonPath("$.apr").value("0.085"));
	}
}
