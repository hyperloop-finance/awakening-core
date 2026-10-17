package xyz.hyperloop.awakening.chain;

import org.springframework.jdbc.core.JdbcTemplate;
import java.util.List;
import java.util.Map;

/** Chain/deployment-scoped durable storage. Signed orders survive event replay. */
public class ChainReadRepository {
    public record Cursor(long block, String hash) {}
    private final JdbcTemplate db;
    private final String scope;
    public ChainReadRepository(JdbcTemplate db, String scope) {
        this.db = db;
        this.scope = scope;
    }
    public void saveOrder(String id, String maker, String payload) {
        db.update("INSERT INTO chain_orders(scope,id,maker,payload) VALUES (?,?,?,?::jsonb) ON CONFLICT DO NOTHING",
            scope, id, maker, payload);
    }
    public List<Map<String,Object>> orders() {
        return db.queryForList("SELECT id,maker,payload::text AS payload FROM chain_orders WHERE scope=? ORDER BY created_at,id", scope);
    }
    public void saveLog(String tx, int index, long block, String hash, String payload) {
        db.update("INSERT INTO chain_events(scope,tx_hash,log_index,block_number,block_hash,payload) VALUES (?,?,?,?,?,?::jsonb) ON CONFLICT DO NOTHING",
            scope, tx, index, block, hash, payload);
    }
    public List<Map<String,Object>> logs() {
        return db.queryForList("SELECT tx_hash,log_index,block_number,block_hash,payload::text AS payload FROM chain_events WHERE scope=? ORDER BY block_number,log_index", scope);
    }
    public Cursor cursor() {
        var rows = db.query("SELECT block_number,block_hash FROM chain_sync_cursor WHERE scope=?",
            (rs, n) -> new Cursor(rs.getLong(1),rs.getString(2)), scope);
        return rows.isEmpty() ? null : rows.getFirst();
    }
    public void setCursor(long block, String hash) {
        db.update("INSERT INTO chain_sync_cursor(scope,block_number,block_hash) VALUES (?,?,?) ON CONFLICT(scope) DO UPDATE SET block_number=EXCLUDED.block_number,block_hash=EXCLUDED.block_hash", scope,block,hash);
    }
    public void resetEvents() {
        db.update("DELETE FROM chain_events WHERE scope=?", scope);
        db.update("DELETE FROM chain_sync_cursor WHERE scope=?", scope);
    }
}
