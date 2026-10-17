package xyz.hyperloop.awakening.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
class ConfigApiTest {
	@Autowired
	private MockMvc mockMvc;

	@Test
	void exposesNullableUnconfiguredDeploymentAddresses() throws Exception {
		mockMvc.perform(get("/api/v1/config"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.profile").value("test"))
				.andExpect(jsonPath("$.chainId").value(31337))
				.andExpect(jsonPath("$.rpcUrlConfigured").value(false))
				.andExpect(jsonPath("$.contractsReady").value(false))
				.andExpect(jsonPath("$.awakeningAddress").doesNotExist())
				.andExpect(jsonPath("$.settlementAddress").doesNotExist());
	}
}
