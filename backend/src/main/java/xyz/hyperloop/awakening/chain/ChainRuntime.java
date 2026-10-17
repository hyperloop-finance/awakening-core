package xyz.hyperloop.awakening.chain;

import org.springframework.scheduling.annotation.Scheduled;

public class ChainRuntime {
    private static final org.slf4j.Logger LOG=org.slf4j.LoggerFactory.getLogger(ChainRuntime.class);
    private final ChainGateway rpc;
    private final DeploymentVerifier verifier;
    private final ChainEventIndexer indexer;
    private final ChainReadRepository repo;
    private volatile String error="Chain index initializing";
    private volatile long lastSuccess;
    public ChainRuntime(ChainGateway rpc,DeploymentVerifier verifier,ChainEventIndexer indexer,ChainReadRepository repo) {
        this.rpc=rpc; this.verifier=verifier; this.indexer=indexer; this.repo=repo;
    }
    @Scheduled(fixedDelay=5000)
    public void refresh() {
        try {
            var state=verifier.verify();
            if(!state.coreVerified() || !state.ratifierVerified()) throw new IllegalStateException(state.reason());
            indexer.sync();
            var cursor=repo.cursor();
            if(cursor==null || rpc.blockNumber()-cursor.block()>60) throw new IllegalStateException("Chain index catching up");
            lastSuccess=System.nanoTime(); error=null;
        } catch(RuntimeException e) {
            LOG.warn("Chain refresh unavailable: {}",e.getMessage());
            error="Chain data temporarily unavailable or index catching up";
        }
    }
    public void requireReady() {
        if(error!=null || System.nanoTime()-lastSuccess>30_000_000_000L)
            throw new IllegalStateException(error==null?"Chain snapshot is stale":error);
    }
}
