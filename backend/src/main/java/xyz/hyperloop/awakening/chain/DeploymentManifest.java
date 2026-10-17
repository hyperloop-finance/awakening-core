package xyz.hyperloop.awakening.chain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public record DeploymentManifest(JsonNode data) {
    public static DeploymentManifest load() {
        try (var stream = DeploymentManifest.class.getResourceAsStream("/contracts/bsc-testnet-97.json")) {
            if (stream == null) throw new IllegalStateException("Missing deployment manifest");
            var data = new ObjectMapper().readTree(stream);
            if (data.path("chainId").asLong() != 97) throw new IllegalStateException("Wrong deployment chain");
            return new DeploymentManifest(data);
        } catch (Exception e) { throw new IllegalStateException("Invalid deployment manifest", e); }
    }
    public String address(String name) { return data.path("contracts").path(name).asText(""); }
    public String custodian() { return data.path("roles").path("custodian").asText(); }
    public long startBlock() { return data.path("firstBlock").asLong(); }
}
