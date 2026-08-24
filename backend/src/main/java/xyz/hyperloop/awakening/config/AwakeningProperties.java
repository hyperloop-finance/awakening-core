package xyz.hyperloop.awakening.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "awakening")
public record AwakeningProperties(Rpc rpc, Contracts contracts, Cors cors) {
	public record Rpc(String url, long chainId) { }
	public record Contracts(String awakeningAddress, String settlementAddress, String patAddress, String optionVaultAddress) { }
	public record Cors(String allowedOrigins) { }
}
