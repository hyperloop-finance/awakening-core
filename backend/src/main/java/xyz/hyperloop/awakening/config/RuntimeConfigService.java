package xyz.hyperloop.awakening.config;

import java.util.Optional;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

@Service
public class RuntimeConfigService {
	private final AwakeningProperties properties;
	private final Environment environment;

	public RuntimeConfigService(AwakeningProperties properties, Environment environment) {
		this.properties = properties;
		this.environment = environment;
	}

	public RuntimeConfig getConfig() {
		String awakening = nullable(properties.contracts().awakeningAddress());
		String settlement = nullable(properties.contracts().settlementAddress());
		String pat = nullable(properties.contracts().patAddress());
		String optionVault = nullable(properties.contracts().optionVaultAddress());
		return new RuntimeConfig(activeProfile(), properties.rpc().chainId(), nullable(properties.rpc().url()) != null,
				awakening != null && settlement != null && pat != null && optionVault != null,
				awakening, settlement, pat, optionVault);
	}

	private String activeProfile() {
		return Optional.of(environment.getActiveProfiles()).filter(profiles -> profiles.length > 0)
				.map(profiles -> profiles[0]).orElse("mock");
	}

	private String nullable(String value) {
		return value == null || value.isBlank() ? null : value;
	}
}
