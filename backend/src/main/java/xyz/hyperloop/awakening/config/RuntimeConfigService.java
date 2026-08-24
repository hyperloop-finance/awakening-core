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
		String awakening = configuredAddress(properties.contracts().awakeningAddress());
		String settlement = configuredAddress(properties.contracts().settlementAddress());
		String pat = configuredAddress(properties.contracts().patAddress());
		String optionVault = configuredAddress(properties.contracts().optionVaultAddress());
		return new RuntimeConfig(activeProfile(), properties.rpc().chainId(), nullable(properties.rpc().url()) != null,
				contractsReady(),
				awakening, settlement, pat, optionVault);
	}

	public boolean contractsReady() {
		return isValidAddress(properties.contracts().awakeningAddress()) && isValidAddress(properties.contracts().settlementAddress())
				&& isValidAddress(properties.contracts().patAddress()) && isValidAddress(properties.contracts().optionVaultAddress());
	}

	private String activeProfile() {
		return Optional.of(environment.getActiveProfiles()).filter(profiles -> profiles.length > 0)
				.map(profiles -> profiles[0]).orElse("mock");
	}

	private String nullable(String value) {
		return value == null || value.isBlank() ? null : value;
	}

	private String configuredAddress(String value) {
		return isValidAddress(value) ? value.toLowerCase() : null;
	}

	private boolean isValidAddress(String value) {
		return value != null && value.matches("0x[0-9a-fA-F]{40}") && !value.equalsIgnoreCase("0x0000000000000000000000000000000000000000");
	}
}
