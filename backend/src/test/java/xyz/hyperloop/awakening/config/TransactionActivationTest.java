package xyz.hyperloop.awakening.config;
import org.junit.jupiter.api.Test;
import xyz.hyperloop.awakening.chain.DeploymentVerifier;
import static org.junit.jupiter.api.Assertions.*;
class TransactionActivationTest {
    @Test void activationRequiresExplicitOptInAndBothContractsVerified() {
        var ok=new DeploymentVerifier.Result(true,true,123,"VERIFIED");
        assertFalse(RuntimeConfigService.canTransact(false,ok));
        assertTrue(RuntimeConfigService.canTransact(true,ok));
        assertFalse(RuntimeConfigService.canTransact(true,new DeploymentVerifier.Result(true,false,123,"RATIFIER_NOT_DEPLOYED")));
        assertFalse(RuntimeConfigService.canTransact(true,new DeploymentVerifier.Result(false,false,0,"RPC_UNAVAILABLE")));
    }
}
