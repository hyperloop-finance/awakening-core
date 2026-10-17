package xyz.hyperloop.awakening.chain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import xyz.hyperloop.awakening.config.RuntimeConfigService;
import static org.junit.jupiter.api.Assertions.*;
class LiveProfileIsolationTest {
    @Test void refusesMixedMockAndLiveProfilesInEitherOrder() {
        for(String[] profiles: new String[][]{{"mock","bsc-testnet"},{"bsc-testnet","mock"}}) {
            var env=new MockEnvironment(); env.setActiveProfiles(profiles);
            assertThrows(IllegalStateException.class,()->new RuntimeConfigService(null,env));
        }
    }
}
