package xyz.hyperloop.awakening.chain;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.math.BigInteger;

class DeploymentVerifierTest {
    private final ChainGateway rpc = mock(ChainGateway.class);
    private final DeploymentManifest manifest = DeploymentManifest.load();

    private void valid() {
        when(rpc.chainId()).thenReturn(97L);
        when(rpc.blockNumber()).thenReturn(134430000L);
        when(rpc.code(anyString(), anyLong())).thenReturn("0x60006000");
        when(rpc.uintCall(manifest.address("Awakening"), "INITIAL_CHAIN_ID()", 134430000L)).thenReturn(BigInteger.valueOf(97));
        for (String[] p : new String[][]{{"optionVault", "OptionVault"}, {"pat", "AttestedPAT"}, {"settlement", "AwakeningSettlement"}})
            when(rpc.addressCall(manifest.address("Awakening"), p[0] + "()", 134430000L)).thenReturn(manifest.address(p[1]));
        for (String name : new String[]{"OptionVault", "AwakeningSettlement"})
            when(rpc.addressCall(manifest.address(name), "AWAKENING()", 134430000L)).thenReturn(manifest.address("Awakening"));
        when(rpc.addressCall(manifest.address("AttestedPAT"), "CUSTODIAN()", 134430000L)).thenReturn(manifest.custodian());
    }

    @Test void verifiesCodeAndLinksAtOneBlock() { valid(); assertTrue(new DeploymentVerifier(rpc, manifest).verify().coreVerified()); }
    @Test void rejectsMainnetEvenWithConfiguredAddresses() {
        valid(); when(rpc.chainId()).thenReturn(56L);
        assertFalse(new DeploymentVerifier(rpc, manifest).verify().coreVerified());
    }
    @Test void rejectsMissingCode() {
        valid(); when(rpc.code(manifest.address("OptionVault"), 134430000L)).thenReturn("0x");
        assertFalse(new DeploymentVerifier(rpc, manifest).verify().coreVerified());
    }
    @Test void rejectsWrongVaultLink() {
        valid(); when(rpc.addressCall(manifest.address("OptionVault"), "AWAKENING()", 134430000L)).thenReturn("0x" + "0".repeat(40));
        assertFalse(new DeploymentVerifier(rpc, manifest).verify().coreVerified());
    }
    @Test void timeoutIsUnavailableNotMockSuccess() {
        when(rpc.chainId()).thenThrow(new IllegalStateException("RPC timeout"));
        var state = new DeploymentVerifier(rpc, manifest).verify();
        assertFalse(state.coreVerified()); assertEquals("RPC_UNAVAILABLE", state.reason());
    }
}
