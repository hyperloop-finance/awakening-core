package xyz.hyperloop.awakening.portfolio;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
		"spring.profiles.active=sepolia",
		"spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration"
})
@AutoConfigureMockMvc
class PortfolioProfileApiTest {
	private static final String DEMO_WALLET = "0x1111111111111111111111111111111111111111";

	@Autowired
	private MockMvc mockMvc;

	@Test
	void doesNotExposeDemoPortfolioOutsideMockProfiles() throws Exception {
		mockMvc.perform(get("/api/v1/portfolio/{wallet}", DEMO_WALLET))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.type").value("https://awakening.xyz/problems/503"));
	}
}
