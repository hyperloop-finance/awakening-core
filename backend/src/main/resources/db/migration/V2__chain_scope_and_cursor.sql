-- Separate replayable chain state from the legacy mock catalog. Amounts stay in JSON strings.
CREATE TABLE IF NOT EXISTS chain_orders (
  scope TEXT NOT NULL,
  id TEXT NOT NULL,
  maker TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, id)
);
CREATE TABLE IF NOT EXISTS chain_events (
  scope TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  PRIMARY KEY (scope, tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS chain_events_block ON chain_events(scope, block_number, log_index);
CREATE TABLE IF NOT EXISTS chain_sync_cursor (
  scope TEXT PRIMARY KEY,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL
);
