package xyz.hyperloop.awakening.chain;

import org.springframework.transaction.support.TransactionTemplate;
import java.util.List;
import java.util.Map;

/** Bounded, confirmed log ingestion. A reorg invalidates derived events, never signed orders. */
public class ChainEventIndexer {
    private final ChainGateway rpc;
    private final ChainReadRepository repo;
    private final TransactionTemplate tx;
    private final long start;
    private final List<String> addresses;
    private final int confirmations;
    private final long chainId;
    private final int blockRange;
    public ChainEventIndexer(ChainGateway rpc, ChainReadRepository repo, TransactionTemplate tx,
                             long start, List<String> addresses, int confirmations) {
        this(rpc,repo,tx,start,addresses,confirmations,97,50_000);
    }
    public ChainEventIndexer(ChainGateway rpc, ChainReadRepository repo, TransactionTemplate tx,
                             long start, List<String> addresses, int confirmations, long chainId, int blockRange) {
        if(blockRange<=0 || confirmations<0)throw new IllegalArgumentException("Invalid indexing bounds");
        this.chainId=chainId;this.blockRange=blockRange;
        this.rpc=rpc; this.repo=repo; this.tx=tx; this.start=start;
        this.addresses=List.copyOf(addresses); this.confirmations=confirmations;
    }
    private String blockHash(long block) {
        var header=rpc.request("eth_getBlockByNumber",List.of(ChainGateway.hex(block),false));
        String hash=header.path("hash").asText();
        if (hash.isEmpty() || header.path("parentHash").asText().isEmpty()) throw new IllegalStateException("Missing block header");
        return hash;
    }
    public synchronized void sync() {
        if (rpc.chainId()!=chainId) throw new IllegalStateException("Wrong chain");
        long head=rpc.blockNumber()-confirmations;
        var cursor=repo.cursor();
        if (cursor!=null && (cursor.block()>head || !cursor.hash().equals(blockHash(cursor.block())))) {
            tx.executeWithoutResult(status -> repo.resetEvents());
            cursor=null;
        }
        long from=cursor==null ? start : cursor.block()+1;
        // Bound each run to five configured ranges (smaller on L2 public RPCs)
        // so an offline restart catches up without skipping events or confirmations.
        for (int batch=0; batch<5 && from<=head; batch++) {
            var checkpoint=repo.cursor();
            verifyCheckpoint(checkpoint);
            long to=Math.min(from+blockRange-1,head);
            String hash=blockHash(to);
            var logs=rpc.request("eth_getLogs",List.of(Map.of("fromBlock",ChainGateway.hex(from),"toBlock",ChainGateway.hex(to),"address",addresses)));
            if (!logs.isArray()) throw new IllegalStateException("Malformed log response");
            if (!hash.equals(blockHash(to))) throw new IllegalStateException("Chain changed during read");
            verifyCheckpoint(checkpoint);
            long first=from;
            tx.executeWithoutResult(status -> {
                for (var log : logs) {
                    String txHash=log.path("transactionHash").asText();
                    String eventHash=log.path("blockHash").asText();
                    long block=ChainGateway.integer(log.path("blockNumber").asText()).longValueExact();
                    int index=ChainGateway.integer(log.path("logIndex").asText()).intValueExact();
                    if (txHash.isEmpty() || eventHash.isEmpty() || block<first || block>to || log.path("removed").asBoolean())
                        throw new IllegalStateException("Invalid log");
                    if (block==to && !eventHash.equals(hash)) throw new IllegalStateException("Log block hash mismatch");
                    repo.saveLog(txHash,index,block,eventHash,log.toString());
                }
                repo.setCursor(to,hash);
            });
            from=to+1;
        }
    }
    private void verifyCheckpoint(ChainReadRepository.Cursor checkpoint) {
        if(checkpoint!=null && !checkpoint.hash().equals(blockHash(checkpoint.block()))) {
            tx.executeWithoutResult(status->repo.resetEvents());
            throw new IllegalStateException("Chain checkpoint changed; replay required");
        }
    }
}
