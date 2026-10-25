package xyz.hyperloop.awakening.config;

import java.util.Optional;
import xyz.hyperloop.awakening.chain.*;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

@Service
public class RuntimeConfigService {
	private final AwakeningProperties properties;
	private final Environment environment;
    private volatile DeploymentVerifier.Result verified;
    private volatile long checkedAt;

	public RuntimeConfigService(AwakeningProperties properties, Environment environment) {
        DeploymentManifest.selectedProfile(environment);
		this.properties = properties;
		this.environment = environment;
	}

	public RuntimeConfig getConfig() {
        if (DeploymentManifest.LIVE_PROFILES.contains(activeProfile())) {
            var manifest = DeploymentManifest.load(activeProfile());
            var state = chainVerification();
            return new RuntimeConfig(manifest.profile(),manifest.chainId(),nullable(properties.rpc().url())!=null,state.coreVerified(),
                manifest.address("Awakening"),manifest.address("AwakeningSettlement"),manifest.address("AttestedPAT"),manifest.address("OptionVault"),
                nullable(manifest.address("EcrecoverRatifier")),manifest.startBlock(),state.observedBlock(),state.reason(),
                canTransact(environment.getProperty("awakening.transactions-enabled",Boolean.class,false),state));
        }
		String awakening = configuredAddress(properties.contracts().awakeningAddress());
		String settlement = configuredAddress(properties.contracts().settlementAddress());
		String pat = configuredAddress(properties.contracts().patAddress());
		String optionVault = configuredAddress(properties.contracts().optionVaultAddress());
		return new RuntimeConfig(activeProfile(), properties.rpc().chainId(), nullable(properties.rpc().url()) != null,
				contractsReady(),
				awakening, settlement, pat, optionVault);
	}

	public boolean contractsReady() {
        if (DeploymentManifest.LIVE_PROFILES.contains(activeProfile())) return chainVerification().coreVerified();
		return isValidAddress(properties.contracts().awakeningAddress()) && isValidAddress(properties.contracts().settlementAddress())
				&& isValidAddress(properties.contracts().patAddress()) && isValidAddress(properties.contracts().optionVaultAddress());
	}

    private synchronized DeploymentVerifier.Result chainVerification() {
        long now=System.nanoTime();
        if (verified!=null && now-checkedAt<5_000_000_000L) return verified;
        try { verified=new DeploymentVerifier(new ChainGateway(properties.rpc().url()),DeploymentManifest.load(activeProfile())).verify(); }
        catch (RuntimeException e) { verified=new DeploymentVerifier.Result(false,false,0,"RPC_UNAVAILABLE"); }
        checkedAt=System.nanoTime();
        return verified;
    }
    static boolean canTransact(boolean enabled,DeploymentVerifier.Result state) {
        return enabled && state.coreVerified() && state.ratifierVerified() && "VERIFIED".equals(state.reason());
    }

	private String activeProfile() {
		String live=DeploymentManifest.selectedProfile(environment);
        if(live!=null)return live;
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
