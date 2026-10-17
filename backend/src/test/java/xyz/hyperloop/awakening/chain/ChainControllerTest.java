package xyz.hyperloop.awakening.chain;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
class ChainControllerTest {
    @Test void unavailableIndexNeverReturnsSuccessfulEmptyPositions() throws Exception {
        var state=mock(ChainRuntime.class); var projection=mock(ChainProjectionService.class);
        doThrow(new IllegalStateException("RPC unavailable")).when(state).requireReady();
        var mvc=MockMvcBuilders.standaloneSetup(new ChainController(state,projection)).build();
        mvc.perform(get("/api/v1/chain/markets")).andExpect(status().isServiceUnavailable());
    }
    @Test void servesVerifiedChainSnapshot() throws Exception {
        var state=mock(ChainRuntime.class); var projection=mock(ChainProjectionService.class);
        when(projection.markets()).thenReturn(new ObjectMapper().createObjectNode().put("dataSource","BSC_TESTNET").put("observedBlock",123));
        var mvc=MockMvcBuilders.standaloneSetup(new ChainController(state,projection)).build();
        mvc.perform(get("/api/v1/chain/markets")).andExpect(status().isOk()).andExpect(jsonPath("$.dataSource").value("BSC_TESTNET"));
    }
}
