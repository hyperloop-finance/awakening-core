package xyz.hyperloop.awakening.config;

public record RuntimeConfig(
		String profile,
		long chainId,
		boolean rpcUrlConfigured,
		boolean contractsReady,
		String awakeningAddress,
		String settlementAddress,
		String patAddress,
		String optionVaultAddress,
        String ratifierAddress, long deploymentBlock, long observedBlock,
        String verificationStatus, boolean transactionsEnabled) {
    public RuntimeConfig(String profile, long chainId, boolean rpcUrlConfigured, boolean contractsReady,
                         String awakeningAddress, String settlementAddress, String patAddress, String optionVaultAddress) {
        this(profile,chainId,rpcUrlConfigured,contractsReady,awakeningAddress,settlementAddress,patAddress,optionVaultAddress,
             null,0,0,"NOT_VERIFIED",false);
    }
}
