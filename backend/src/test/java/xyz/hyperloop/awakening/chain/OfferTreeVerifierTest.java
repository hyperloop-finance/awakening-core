package xyz.hyperloop.awakening.chain;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.web3j.crypto.Hash;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class OfferTreeVerifierTest {
    private final DeploymentManifest manifest=DeploymentManifest.load();
    private final ChainGateway rpc=mock(ChainGateway.class);
    private ObjectNode submission() throws Exception {
        var offer=OfferCodecTest.vector();
        offer.set("market",manifest.data().path("markets").get(0).path("market"));
        offer.put("ratifier",manifest.address("EcrecoverRatifier"));
        var body=new ObjectMapper().createObjectNode().put("chainId",97).put("awakeningAddress",manifest.address("Awakening"))
            .put("root",OfferCodec.hashOffer(offer)).put("signature","0x"+"11".repeat(32)+"22".repeat(32)+"1b");
        body.set("offer",offer);return body;
    }
    private void chain(ObjectNode body) throws Exception {
        when(rpc.chainId()).thenReturn(97L);
        when(rpc.request("eth_getBlockByNumber",List.of("0x64",false))).thenReturn(new ObjectMapper().readTree("{\"timestamp\":\"0x6abf1aa0\"}"));
        // 1790900000 <= timestamp <= 1791000000
        when(rpc.call(eq(manifest.address("Awakening")),anyString(),eq(100L))).thenReturn("0x"+OfferCodec.uint(1));
        var data=OfferCodec.ratifierData(body.path("offer"),body.path("signature").asText());
        when(rpc.call(manifest.address("EcrecoverRatifier"),OfferCodec.ratifyCall(body.path("offer"),data),100L))
            .thenReturn(Hash.sha3String("hyperloop.awakening.callbackSuccess"));
    }
    @Test void acceptsOnlyOnchainRatifiedUnmodifiedOffer() throws Exception {
        var body=submission(); chain(body);
        assertEquals(body.path("root").asText(),new OfferTreeVerifier(rpc,manifest).verify(body,100).path("root").asText());
        ((ObjectNode)body.path("offer")).put("tick","4001");
        assertThrows(IllegalArgumentException.class,()->new OfferTreeVerifier(rpc,manifest).verify(body,100));
    }
    @Test void rejectsWrongChainDomainCallbacksAndExpiredOrders() throws Exception {
        var verifier=new OfferTreeVerifier(rpc,manifest);
        var body=submission();chain(body);body.put("chainId",56);
        assertThrows(IllegalArgumentException.class,()->verifier.verify(body,100));
        body.put("chainId",97);((ObjectNode)body.path("offer")).put("ratifier","0x0000000000000000000000000000000000000055");
        assertThrows(IllegalArgumentException.class,()->verifier.verify(body,100));
        var callback=submission();((ObjectNode)callback.path("offer")).put("callback","0x0000000000000000000000000000000000000055");
        assertThrows(IllegalArgumentException.class,()->verifier.verify(callback,100));
        var expired=submission();((ObjectNode)expired.path("offer")).put("expiry","1");
        expired.put("root",OfferCodec.hashOffer(expired.path("offer")));
        assertThrows(IllegalArgumentException.class,()->verifier.verify(expired,100));
    }
    @Test void canceledRootCannotBeAcceptedEvenWithAValidStoredSignature() throws Exception {
        var body=submission();chain(body);
        when(rpc.call(eq(manifest.address("EcrecoverRatifier")),anyString(),eq(100L))).thenThrow(new IllegalStateException("execution reverted"));
        assertThrows(IllegalStateException.class,()->new OfferTreeVerifier(rpc,manifest).verify(body,100));
    }
}
