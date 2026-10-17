package xyz.hyperloop.awakening.chain;

import org.springframework.context.annotation.*;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import xyz.hyperloop.awakening.config.AwakeningProperties;
import java.util.List;

@Configuration
@Profile("bsc-testnet")
@EnableScheduling
public class ChainConfiguration {
    @Bean DeploymentManifest deploymentManifest() { return DeploymentManifest.load(); }
    @Bean ChainGateway chainGateway(AwakeningProperties p) { return new ChainGateway(p.rpc().url()); }
    @Bean ChainReadRepository chainReadRepository(JdbcTemplate db,DeploymentManifest m) {
        return new ChainReadRepository(db,"97:"+m.address("Awakening").toLowerCase(java.util.Locale.ROOT));
    }
    @Bean ChainEventIndexer chainEventIndexer(ChainGateway rpc,ChainReadRepository repo,PlatformTransactionManager manager,DeploymentManifest m) {
        return new ChainEventIndexer(rpc,repo,new TransactionTemplate(manager),m.startBlock(),
            List.of(m.address("Awakening"),m.address("AwakeningSettlement"),m.address("AttestedPAT"),m.address("EcrecoverRatifier")),12);
    }
    @Bean ChainRuntime chainRuntime(ChainGateway rpc,ChainReadRepository repo,ChainEventIndexer indexer,DeploymentManifest m) {
        return new ChainRuntime(rpc,new DeploymentVerifier(rpc,m),indexer,repo);
    }
    @Bean ChainProjectionService chainProjectionService(ChainGateway rpc,ChainReadRepository repo,DeploymentManifest m) {
        return new ChainProjectionService(rpc,repo,m);
    }
    @Bean OfferTreeVerifier offerTreeVerifier(ChainGateway rpc,DeploymentManifest m) {return new OfferTreeVerifier(rpc,m);}
    @Bean ChainOrderService chainOrderService(ChainGateway rpc,ChainReadRepository repo,OfferTreeVerifier verifier,DeploymentManifest m) {
        return new ChainOrderService(rpc,repo,verifier,m);
    }
}
