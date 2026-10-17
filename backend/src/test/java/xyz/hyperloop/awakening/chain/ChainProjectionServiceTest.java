package xyz.hyperloop.awakening.chain;

import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChainProjectionServiceTest {
    @Test void projectsExactIntegerCreditWithoutFabricatingLiquidity() {
        var rpc=mock(ChainGateway.class);
        var repo=mock(ChainReadRepository.class);
        when(repo.cursor()).thenReturn(new ChainReadRepository.Cursor(134460000,"hash"));
        when(repo.logs()).thenReturn(List.of());
        var manifest=DeploymentManifest.load();
        when(rpc.call(anyString(),anyString(),eq(134460000L))).thenReturn("0x"+"0".repeat(64*12));
        String account="0x1111111111111111111111111111111111111111";
        String pos=ChainProjectionService.selector("position(bytes32,address)")+manifest.data().path("markets").get(0).path("id").asText().substring(2)+"0".repeat(24)+account.substring(2);
        when(rpc.call(manifest.address("Awakening"),pos,134460000L)).thenReturn("0x"+"0".repeat(50)+"20000000000001"+"0".repeat(64*4));
        var service=new ChainProjectionService(rpc,repo,manifest);
        var positions=service.account(account);
        assertEquals("9007199254740993",positions.path("positions").get(0).path("credit").asText());
        assertEquals("BSC_TESTNET",positions.path("dataSource").asText());
        assertEquals(0,positions.path("loans").size());
        assertThrows(IllegalArgumentException.class,()->service.account("bad-wallet"));
    }
    @Test void noCursorIsUnavailableRatherThanEmptySuccess() {
        var service=new ChainProjectionService(mock(ChainGateway.class),mock(ChainReadRepository.class),DeploymentManifest.load());
        assertThrows(IllegalStateException.class,()->service.account("0x1111111111111111111111111111111111111111"));
    }
    @Test void ignoresEventsNewerThanCapturedProjectionBlock() {
        var rpc=mock(ChainGateway.class); var repo=mock(ChainReadRepository.class);
        when(repo.cursor()).thenReturn(new ChainReadRepository.Cursor(100,"hash"));
        when(repo.logs()).thenReturn(List.of(Map.of("block_number",101L,"payload","invalid-future-payload")));
        when(rpc.call(anyString(),anyString(),eq(100L))).thenReturn("0x"+"0".repeat(64*12));
        assertDoesNotThrow(()->new ChainProjectionService(rpc,repo,DeploymentManifest.load()).account("0x1111111111111111111111111111111111111111"));
    }
}
