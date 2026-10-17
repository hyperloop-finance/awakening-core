package xyz.hyperloop.awakening.chain;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="BSC_DB_TESTS",matches="true")
class ChainReadRepositoryTest {
    @Test void persistsOrdersAcrossRepositoryRestartAndDeduplicatesEvents() {
        var ds=new DriverManagerDataSource("jdbc:postgresql://127.0.0.1:55432/awakening_bsc","awakening","awakening-local-test-only");
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V2__chain_scope_and_cursor.sql")).execute(ds);
        var db=new JdbcTemplate(ds);
        String scope="test-"+UUID.randomUUID();
        var repo=new ChainReadRepository(db,scope);
        repo.saveOrder("root","maker","{\"amount\":\"9007199254740993\"}");
        repo.saveOrder("root","maker","{\"amount\":\"9007199254740993\"}");
        assertEquals(1,new ChainReadRepository(db,scope).orders().size());
        repo.saveLog("tx",0,100,"blockA","{}"); repo.saveLog("tx",0,100,"blockA","{}");
        assertEquals(1,repo.logs().size());
        repo.setCursor(100,"blockA");
        assertEquals(100,new ChainReadRepository(db,scope).cursor().block());
        repo.resetEvents();
        assertTrue(repo.logs().isEmpty()); assertEquals(1,repo.orders().size());
        db.update("delete from chain_orders where scope=?",scope);
        db.update("delete from chain_sync_cursor where scope=?",scope);
    }
}
