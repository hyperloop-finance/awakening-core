package xyz.hyperloop.awakening.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class OpenApiContractTest {
	@Test
	void documentsTheUserProductLoop() throws Exception {
		String yaml = Files.readString(Path.of("../docs/api/openapi.yaml"));
		assertThat(yaml).contains("/api/v1/orders:", "/api/v1/orders/{orderId}:", "/api/v1/positions/{wallet}:",
				"/api/v1/settlements/{wallet}:", "/api/v1/settlements/{positionId}/actions:",
				"Order:", "PositionPayload:", "PositionSummary:", "SettlementItem:", "SettlementActionRequest:");
	}
}
