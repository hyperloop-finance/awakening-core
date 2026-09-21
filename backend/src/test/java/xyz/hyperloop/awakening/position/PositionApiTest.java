package xyz.hyperloop.awakening.position;

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
class PositionApiTest {
	static final String WALLET = "0xde00000000000000000000000000000000000001";
	@Autowired MockMvc mockMvc;

	@Test
	void returnsWhitepaperAlignedBorrowAndLendPositions() throws Exception {
		mockMvc.perform(get("/api/v1/positions/{wallet}", WALLET)).andExpect(status().isOk())
				.andExpect(jsonPath("$.wallet").value(WALLET))
				.andExpect(jsonPath("$.borrowPositions[0].debtUnits").value("1200.00"))
				.andExpect(jsonPath("$.borrowPositions[0].strike").value("60000.00"))
				.andExpect(jsonPath("$.borrowPositions[0].patStatus").value("ATTRIBUTED_PREVIEW"))
				.andExpect(jsonPath("$.lendPositions[0].creditUnits").value("800.00"))
				.andExpect(jsonPath("$.lendPositions[0].faceValue").value("800.00"));
	}
}
