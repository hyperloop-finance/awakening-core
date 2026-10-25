package xyz.hyperloop.awakening.chain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.env.Environment;
import java.util.Arrays;
import java.util.List;

public record DeploymentManifest(JsonNode data) {
    public static final List<String> LIVE_PROFILES=List.of("bsc-testnet","arbitrum-sepolia","robinhood-testnet");
    public static String selectedProfile(Environment environment) {
        var profiles=Arrays.asList(environment.getActiveProfiles());
        var live=profiles.stream().filter(LIVE_PROFILES::contains).toList();
        if(live.size()>1 || (!live.isEmpty() && (profiles.contains("mock") || profiles.contains("test"))))
            throw new IllegalStateException("Live profiles must be isolated from other live and mock/test profiles");
        return live.isEmpty()?null:live.getFirst();
    }
    public static DeploymentManifest load() { return load("bsc-testnet"); }
    public static DeploymentManifest load(String profile) {
        long chain=switch(profile) {case "bsc-testnet"->97;case "arbitrum-sepolia"->421614;case "robinhood-testnet"->46630;
            default->throw new IllegalArgumentException("Unknown live profile: "+profile);};
        try(var stream=DeploymentManifest.class.getResourceAsStream("/contracts/"+profile+"-"+chain+".json")) {
            if(stream==null)throw new IllegalStateException("Missing deployment manifest for "+profile);
            var data=new ObjectMapper().readTree(stream);
            if(data.path("chainId").asLong()!=chain)throw new IllegalStateException("Wrong deployment chain");
            return new DeploymentManifest(data);
        }catch(Exception e){throw new IllegalStateException("Invalid deployment manifest for "+profile,e);}
    }
    public long chainId() { return data.path("chainId").asLong(); }
    public String profile() {return switch((int)chainId()) {case 97->"bsc-testnet";case 421614->"arbitrum-sepolia";case 46630->"robinhood-testnet";
        default->throw new IllegalStateException("Unsupported deployment chain");};}
    public String dataSource() {return profile().toUpperCase(java.util.Locale.ROOT).replace('-','_');}
    public String address(String name) { return data.path("contracts").path(name).asText(""); }
    public String custodian() { return data.path("roles").path("custodian").asText(); }
    public long startBlock() { return data.path("firstBlock").asLong(); }
}
