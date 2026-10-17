package xyz.hyperloop.awakening.chain;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class OfferCodecTest {
    static ObjectNode vector() throws Exception {
        return (ObjectNode)new ObjectMapper().readTree("""
          {"market":{"loanToken":"0x0000000000000000000000000000000000000011","collateralParams":[{"token":"0x0000000000000000000000000000000000000022","oracle":"0x0000000000000000000000000000000000000033"}],"maturity":"1793534400","maxStrike":"400000000000000000000000000000000000000","penaltyPct":"50000000000000000","enterGate":"0x0000000000000000000000000000000000000000"},"buy":true,"maker":"0x0000000000000000000000000000000000000044","start":"1790900000","expiry":"1791000000","tick":"4000","group":"0x0000000000000000000000000000000000000000000000000000000000000001","callback":"0x0000000000000000000000000000000000000000","callbackData":"0x","receiverIfMakerIsSeller":"0x0000000000000000000000000000000000000044","ratifier":"0x0000000000000000000000000000000000000055","reduceOnly":false,"maxUnits":"1000000000","maxAssets":"0"}
        """);
    }
    @Test void hashMatchesSolidityAndTypescript() throws Exception {
        assertEquals("0xba59009c7191768c5729d78dfcee90a25d9c5cdc7c93aa3d1e71a114b21964cd",OfferCodec.hashOffer(vector()));
        assertNotEquals(OfferCodec.hashOffer(vector()),OfferCodec.hashOffer(vector().put("tick","4001")));
    }
    @Test void rejectsNegativeFractionalAndOverflowingAmounts() {
        for(String invalid:new String[]{"-1","1.2","1e6","01",java.math.BigInteger.TWO.pow(256).toString()})
            assertThrows(IllegalArgumentException.class,()->OfferCodec.uint(invalid));
    }
    @Test void calldataMatchesIndependentViemEncoding() throws Exception {
        var offer=vector();
        var data=OfferCodec.ratifierData(offer,"0x"+"11".repeat(32)+"22".repeat(32)+"1b");
        assertEquals("0x4f5feb9c95bcaee7fc2b27ab6789386ab36486326aef5036d21f51f40a06986e",org.web3j.crypto.Hash.sha3(data));
        assertEquals("0x3018712e770a559741b8d881359a481b48641f17c3562bbc6b829e636c07ae86",org.web3j.crypto.Hash.sha3(OfferCodec.ratifyCall(offer,data)));
    }
}
