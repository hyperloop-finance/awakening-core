package xyz.hyperloop.awakening.chain;

import java.math.BigInteger;

public class DeploymentVerifier {
    private final ChainGateway rpc;
    private final DeploymentManifest manifest;
    public record Result(boolean coreVerified, boolean ratifierVerified, long observedBlock, String reason) { }
    public DeploymentVerifier(ChainGateway rpc, DeploymentManifest manifest) { this.rpc=rpc; this.manifest=manifest; }
    public Result verify() {
        try {
            if (rpc.chainId()!=manifest.chainId()) return new Result(false,false,0,"WRONG_CHAIN");
            long block=rpc.blockNumber();
            String core=manifest.address("Awakening");
            for (String name : new String[]{"Awakening","OptionVault","AttestedPAT","AwakeningSettlement"}) {
                if (!manifest.address(name).matches("0x[0-9a-fA-F]{40}") || rpc.code(manifest.address(name),block).length()<=2)
                    return new Result(false,false,block,"MISSING_CODE");
            }
            if (!BigInteger.valueOf(manifest.chainId()).equals(rpc.uintCall(core,"INITIAL_CHAIN_ID()",block))) return new Result(false,false,block,"WRONG_CORE_CHAIN");
            for (String[] p : new String[][]{{"optionVault","OptionVault"},{"pat","AttestedPAT"},{"settlement","AwakeningSettlement"}})
                if (!manifest.address(p[1]).equalsIgnoreCase(rpc.addressCall(core,p[0]+"()",block))) return new Result(false,false,block,"WRONG_LINK");
            for (String name : new String[]{"OptionVault","AwakeningSettlement"})
                if (!core.equalsIgnoreCase(rpc.addressCall(manifest.address(name),"AWAKENING()",block))) return new Result(false,false,block,"WRONG_LINK");
            if (!manifest.custodian().equalsIgnoreCase(rpc.addressCall(manifest.address("AttestedPAT"),"CUSTODIAN()",block))) return new Result(false,false,block,"WRONG_CUSTODIAN");
            String ratifier=manifest.address("EcrecoverRatifier");
            boolean ratifierReady=!ratifier.isEmpty() && rpc.code(ratifier,block).length()>2 && core.equalsIgnoreCase(rpc.addressCall(ratifier,"AWAKENING()",block));
            return new Result(true,ratifierReady,block,ratifierReady?"VERIFIED":"RATIFIER_NOT_DEPLOYED");
        } catch (RuntimeException e) { return new Result(false,false,0,"RPC_UNAVAILABLE"); }
    }
}
