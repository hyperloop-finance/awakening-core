package xyz.hyperloop.awakening.chain;
import org.junit.jupiter.api.Test;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class ChainOrderServiceTest {
    @Test void computesIntegerAmountsAndRejectsOverfillOrMissingMakerAllowance() throws Exception {
        var rpc=mock(ChainGateway.class);var repo=mock(ChainReadRepository.class);var verifier=mock(OfferTreeVerifier.class);
        var manifest=DeploymentManifest.load();var offer=OfferCodecTest.vector();
        offer.set("market",manifest.data().path("markets").get(0).path("market"));
        var order=new ObjectMapper().createObjectNode().put("root","root").put("marketId",manifest.data().path("markets").get(0).path("id").asText());order.set("offer",offer);
        when(repo.orders()).thenReturn(List.of(Map.of("id","root","payload",order.toString())));
        when(rpc.blockNumber()).thenReturn(100L);
        when(verifier.verify(any(),eq(100L))).thenReturn(order);
        when(rpc.request(eq("eth_getBlockByNumber"),any())).thenReturn(new ObjectMapper().readTree("{\"timestamp\":\"0x6abf1aa0\"}"));
        when(rpc.call(anyString(),anyString(),eq(100L))).thenReturn("0x"+OfferCodec.uint(0));
        String core=manifest.address("Awakening"),token=offer.path("market").path("loanToken").asText(),maker=offer.path("maker").asText();
        String allowance=ChainProjectionService.selector("allowance(address,address)")+OfferCodec.address(maker)+OfferCodec.address(core);
        String balance=ChainProjectionService.selector("balanceOf(address)")+OfferCodec.address(maker);
        when(rpc.call(token,allowance,100)).thenReturn("0x"+OfferCodec.uint("1000000000"));
        when(rpc.call(token,balance,100)).thenReturn("0x"+OfferCodec.uint("1000000000"));
        String spacing=ChainProjectionService.selector("marketState(bytes32)")+order.path("marketId").asText().substring(2);
        when(rpc.call(core,spacing,100)).thenReturn("0x"+OfferCodec.uint(0).repeat(11)+OfferCodec.uint(4));
        var service=new ChainOrderService(rpc,repo,verifier,manifest);
        var quote=service.quote("root","1000000000","2500000","0x1111111111111111111111111111111111111111");
        assertEquals("995664000",quote.path("buyerAssets").asText());
        assertEquals("995664000",quote.path("sellerAssetsBeforeProtection").asText());
        assertThrows(IllegalArgumentException.class,()->service.quote("root","1000000001","2500001","0x1111111111111111111111111111111111111111"));
        when(rpc.call(token,allowance,100)).thenReturn("0x"+OfferCodec.uint(0));
        assertThrows(IllegalArgumentException.class,()->service.quote("root","1000000000","2500000","0x1111111111111111111111111111111111111111"));
    }
}
