package xyz.hyperloop.awakening.config;

public record RuntimeConfig(
		String profile,
		long chainId,
		boolean rpcUrlConfigured,
		boolean contractsReady,
		String awakeningAddress,
		String settlementAddress,
		String patAddress,
		String optionVaultAddress) {
}
