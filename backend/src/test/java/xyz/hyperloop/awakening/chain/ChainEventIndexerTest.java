package xyz.hyperloop.awakening.chain;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="BSC_DB_TESTS",matches="true")
class ChainEventIndexerTest {
    @Test void longOfflineBacklogAdvancesInBoundedContiguousFiftyThousandBlockBatches() throws Exception {
        var ds=new DriverManagerDataSource("jdbc:postgresql://127.0.0.1:55432/awakening_bsc","awakening","awakening-local-test-only");
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V2__chain_scope_and_cursor.sql")).execute(ds);
        var repo=new ChainReadRepository(new JdbcTemplate(ds),"test-"+UUID.randomUUID());
        var rpc=mock(ChainGateway.class);var json=new ObjectMapper();
        when(rpc.chainId()).thenReturn(97L);when(rpc.blockNumber()).thenReturn(300_112L);
        when(rpc.request(eq("eth_getBlockByNumber"),any())).thenReturn(json.readTree("{\"hash\":\"stable\",\"parentHash\":\"parent\"}"));
        var ranges=new ArrayList<long[]>();
        when(rpc.request(eq("eth_getLogs"),any())).thenAnswer(call->{
            var filter=(Map<?,?>)((List<?>)call.getArgument(1)).getFirst();
            ranges.add(new long[]{ChainGateway.integer((String)filter.get("fromBlock")).longValueExact(),ChainGateway.integer((String)filter.get("toBlock")).longValueExact()});
            return json.readTree("[]");
        });
        var indexer=new ChainEventIndexer(rpc,repo,new TransactionTemplate(new DataSourceTransactionManager(ds)),100,List.of("core"),12);
        try {
            indexer.sync();
            assertEquals(250_099,repo.cursor().block());
            assertEquals(5,ranges.size());
            for(int i=0;i<5;i++) assertArrayEquals(new long[]{100+i*50_000L,50_099+i*50_000L},ranges.get(i));
            indexer.sync();
            assertEquals(300_100,repo.cursor().block());
            assertArrayEquals(new long[]{300_100,300_100},ranges.getLast());
        } finally { repo.resetEvents(); }
    }
    @Test void reorgAfterInitialCursorCheckCannotPermanentlyJoinTwoBranches() throws Exception {
        var ds=new DriverManagerDataSource("jdbc:postgresql://127.0.0.1:55432/awakening_bsc","awakening","awakening-local-test-only");
        var db=new JdbcTemplate(ds);String scope="test-"+UUID.randomUUID();
        var repo=new ChainReadRepository(db,scope);var rpc=mock(ChainGateway.class);var json=new ObjectMapper();
        repo.setCursor(100,"old");repo.saveLog("old-tx",0,100,"old","{}");repo.saveOrder("root","maker","{}");
        when(rpc.chainId()).thenReturn(97L);when(rpc.blockNumber()).thenReturn(113L);
        var reads=new java.util.concurrent.atomic.AtomicInteger();
        when(rpc.request(eq("eth_getBlockByNumber"),any())).thenAnswer(call->{
            var params=(List<?>)call.getArgument(1);
            String hash=params.getFirst().equals("0x64")&&reads.getAndIncrement()==0?"old":"replacement";
            return json.readTree("{\"hash\":\""+hash+"\",\"parentHash\":\"parent\"}");
        });
        when(rpc.request(eq("eth_getLogs"),any())).thenReturn(json.readTree("[]"));
        var indexer=new ChainEventIndexer(rpc,repo,new TransactionTemplate(new DataSourceTransactionManager(ds)),100,List.of("core"),12);
        assertThrows(IllegalStateException.class,indexer::sync);
        assertNull(repo.cursor());assertTrue(repo.logs().isEmpty());assertEquals(1,repo.orders().size());
        db.update("DELETE FROM chain_orders WHERE scope=?",scope);
    }
    @Test void reorgReplaysEventsWithoutLosingOrdersAndFailedBatchNeverAdvancesCursor() throws Exception {
        var ds=new DriverManagerDataSource("jdbc:postgresql://127.0.0.1:55432/awakening_bsc","awakening","awakening-local-test-only");
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V2__chain_scope_and_cursor.sql")).execute(ds);
        var db=new JdbcTemplate(ds);
        String scope="test-"+UUID.randomUUID();
        var repo=new ChainReadRepository(db,scope);
        var rpc=mock(ChainGateway.class);
        var mapper=new ObjectMapper();
        when(rpc.chainId()).thenReturn(97L);
        when(rpc.blockNumber()).thenReturn(112L);
        when(rpc.request(eq("eth_getBlockByNumber"),any())).thenReturn(mapper.readTree("{\"hash\":\"old\",\"parentHash\":\"parent\"}"));
        when(rpc.request(eq("eth_getLogs"),any())).thenReturn(mapper.readTree("[{\"transactionHash\":\"tx\",\"logIndex\":\"0x0\",\"blockNumber\":\"0x64\",\"blockHash\":\"old\"}]"));
        var indexer=new ChainEventIndexer(rpc,repo,new TransactionTemplate(new DataSourceTransactionManager(ds)),100,List.of("core"),12);
        indexer.sync(); indexer.sync();
        assertEquals(1,repo.logs().size()); assertEquals(100,repo.cursor().block());
        repo.saveOrder("root","maker","{}");
        when(rpc.request(eq("eth_getBlockByNumber"),any())).thenReturn(mapper.readTree("{\"hash\":\"replacement\",\"parentHash\":\"parent\"}"));
        when(rpc.request(eq("eth_getLogs"),any())).thenReturn(mapper.readTree("[{\"transactionHash\":\"new\",\"logIndex\":\"0x0\",\"blockNumber\":\"0x64\",\"blockHash\":\"replacement\"}]"));
        indexer.sync();
        assertEquals("new",repo.logs().getFirst().get("tx_hash"));
        assertEquals(1,repo.orders().size());
        when(rpc.blockNumber()).thenReturn(113L);
        when(rpc.request(eq("eth_getLogs"),any())).thenReturn(mapper.readTree("[{\"transactionHash\":\"partial\",\"logIndex\":\"0x0\",\"blockNumber\":\"0x65\",\"blockHash\":\"replacement\"},{\"logIndex\":\"invalid\"}]"));
        assertThrows(RuntimeException.class,indexer::sync);
        assertEquals(100,repo.cursor().block()); assertEquals(1,repo.logs().size());
        repo.resetEvents();
        db.update("DELETE FROM chain_orders WHERE scope=?",scope);
    }
}
