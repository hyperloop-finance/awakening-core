package xyz.hyperloop.awakening.offer;

import java.math.BigInteger;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

import org.web3j.crypto.ECKeyPair;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

final class MockOfferRequestFixture {
	static final String MARKET_ID = "0x8f0d4f673bd9de1d1f927cbf3abfc7b77c680f1d817e113d5603bb483fa041e6";

	private MockOfferRequestFixture() { }

	static ECKeyPair signer(long privateKey) {
		return ECKeyPair.create(BigInteger.valueOf(privateKey));
	}

	static String wallet(ECKeyPair keyPair) {
		return "0x" + Keys.getAddress(keyPair);
	}

	static String json(ECKeyPair signer, String wallet, String amount, String apr, Instant expiry) {
		return """
			{
			  "signingScheme":"EIP191_MOCK",
			  "wallet":"%s",
			  "marketId":"%s",
			  "amount":"%s",
			  "apr":"%s",
			  "expiry":"%s",
			  "signature":"%s"
			}
			""".formatted(wallet, MARKET_ID, amount, apr, expiry, signature(signer, wallet, amount, apr, expiry));
	}

	static String signature(ECKeyPair signer, String wallet, String amount, String apr, Instant expiry) {
		Sign.SignatureData signature = Sign.signPrefixedMessage(message(wallet, amount, apr, expiry).getBytes(StandardCharsets.UTF_8), signer);
		return "0x" + Numeric.toHexStringNoPrefix(signature.getR()) + Numeric.toHexStringNoPrefix(signature.getS())
				+ Numeric.toHexStringNoPrefix(signature.getV());
	}

	static String message(String wallet, String amount, String apr, Instant expiry) {
		return "Awakening Mock Offer\n"
				+ "chainId:31337\n"
				+ "wallet:" + wallet.toLowerCase() + "\n"
				+ "marketId:" + MARKET_ID + "\n"
				+ "amount:" + canonicalDecimal(amount) + "\n"
				+ "apr:" + canonicalDecimal(apr) + "\n"
				+ "expiry:" + expiry;
	}

	private static String canonicalDecimal(String value) {
		return new BigDecimal(value).stripTrailingZeros().toPlainString();
	}
}
