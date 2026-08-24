package xyz.hyperloop.awakening.market;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
		"awakening.rpc.chain-id=11155111",
		"awakening.contracts.awakening-address=0x0000000000000000000000000000000000000000",
		"awakening.contracts.settlement-address=0x0000000000000000000000000000000000000000",
		"awakening.contracts.pat-address=0x0000000000000000000000000000000000000000",
		"awakening.contracts.option-vault-address=0x0000000000000000000000000000000000000000"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MarketRuntimeConfigApiTest {
	@Autowired
	private MockMvc mockMvc;

	@Test
	void exposesConfiguredChainAndExplicitMockDataSourceWithoutPretendingContractsReady() throws Exception {
		mockMvc.perform(get("/api/v1/markets"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.meta.chainId").value(11155111))
				.andExpect(jsonPath("$.meta.dataSource").value("MOCK_CATALOG"))
				.andExpect(jsonPath("$.data[0].contractsReady").value(false));
		mockMvc.perform(get("/api/v1/config"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.contractsReady").value(false));
	}
}
