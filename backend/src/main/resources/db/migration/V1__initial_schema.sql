-- Awakening v0.1 initial schema
-- Multi-collateral markets, tiered PAT sources (Deribit / Derive / internal)

-- =============================================================
-- markets — one row per Awakening market
-- =============================================================
CREATE TABLE markets (
    id                  BYTEA PRIMARY KEY,           -- market id (keccak256 of Market struct)
    loan_token          BYTEA NOT NULL,              -- ERC-20 address (20 bytes)
    maturity            BIGINT NOT NULL,             -- unix timestamp
    settlement_contract BYTEA NOT NULL,              -- AwakeningSettlement address
    enter_gate          BYTEA,                       -- optional gate contract
    created_block       BIGINT NOT NULL,
    created_tx          BYTEA NOT NULL,              -- 32-byte tx hash
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX markets_maturity_idx ON markets(maturity);
CREATE INDEX markets_loan_token_idx ON markets(loan_token);

-- =============================================================
-- market_collaterals — collateral parameters per market
-- (Midnight allows up to 128 per market; each has own strike/oracle)
-- =============================================================
CREATE TABLE market_collaterals (
    market_id           BYTEA NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    collateral_index    SMALLINT NOT NULL,           -- 0..127
    token               BYTEA NOT NULL,
    oracle              BYTEA NOT NULL,
    strike              NUMERIC(78, 0) NOT NULL,     -- uint256, scaled by 1e36
    PRIMARY KEY (market_id, collateral_index)
);

CREATE INDEX market_collaterals_token_idx ON market_collaterals(token);

-- =============================================================
-- offers — off-chain published maker offers (relay-stored)
-- =============================================================
CREATE TABLE offers (
    id                  BIGSERIAL PRIMARY KEY,
    market_id           BYTEA NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    maker               BYTEA NOT NULL,
    side                SMALLINT NOT NULL,           -- 0=buy, 1=sell
    tick                INTEGER NOT NULL,            -- 0..5820
    group_key           BYTEA NOT NULL,              -- 32 bytes consumption group
    ratifier            BYTEA NOT NULL,
    start_ts            BIGINT NOT NULL,
    expiry_ts           BIGINT NOT NULL,
    max_units           NUMERIC(78, 0),
    max_assets          NUMERIC(78, 0),
    reduce_only         BOOLEAN NOT NULL DEFAULT FALSE,
    callback            BYTEA,
    callback_data       BYTEA,
    receiver            BYTEA,
    signature           BYTEA NOT NULL,
    merkle_root         BYTEA,                       -- non-null if part of a bundle
    merkle_leaf_index   INTEGER,
    status              TEXT NOT NULL DEFAULT 'active',   -- active | filled | cancelled | expired
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX offers_market_side_tick_idx ON offers(market_id, side, tick) WHERE status = 'active';
CREATE INDEX offers_maker_idx ON offers(maker);
CREATE INDEX offers_expiry_idx ON offers(expiry_ts) WHERE status = 'active';

-- =============================================================
-- takes — on-chain fills (indexed from Take events)
-- =============================================================
CREATE TABLE takes (
    id                  BIGSERIAL PRIMARY KEY,
    market_id           BYTEA NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    block_number        BIGINT NOT NULL,
    tx_hash             BYTEA NOT NULL,
    log_index           INTEGER NOT NULL,
    maker               BYTEA NOT NULL,
    taker               BYTEA NOT NULL,
    side                SMALLINT NOT NULL,
    tick                INTEGER NOT NULL,
    units               NUMERIC(78, 0) NOT NULL,
    buyer_assets        NUMERIC(78, 0) NOT NULL,
    seller_assets       NUMERIC(78, 0) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tx_hash, log_index)
);

CREATE INDEX takes_market_block_idx ON takes(market_id, block_number DESC);
CREATE INDEX takes_taker_idx ON takes(taker);
CREATE INDEX takes_maker_idx ON takes(maker);

-- =============================================================
-- pat_attributions — per-collateral PAT attributions from take events
-- =============================================================
CREATE TABLE pat_attributions (
    id                  BIGSERIAL PRIMARY KEY,
    take_id             BIGINT NOT NULL REFERENCES takes(id) ON DELETE CASCADE,
    market_id           BYTEA NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    collateral_index    SMALLINT NOT NULL,
    pat_contract        BYTEA NOT NULL,
    pat_token_id        NUMERIC(78, 0) NOT NULL,
    notional            NUMERIC(78, 0) NOT NULL,
    source              TEXT NOT NULL,              -- 'deribit' | 'derive' | 'internal'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pat_contract, pat_token_id)
);

CREATE INDEX pat_attributions_market_collateral_idx
    ON pat_attributions(market_id, collateral_index);

-- =============================================================
-- positions — materialized user positions per market
-- =============================================================
CREATE TABLE positions (
    market_id           BYTEA NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    account             BYTEA NOT NULL,
    credit              NUMERIC(78, 0) NOT NULL DEFAULT 0,
    debt                NUMERIC(78, 0) NOT NULL DEFAULT 0,
    collateral_bitmap   NUMERIC(78, 0) NOT NULL DEFAULT 0,   -- uint128
    last_accrual        BIGINT NOT NULL DEFAULT 0,
    pending_fee         NUMERIC(78, 0) NOT NULL DEFAULT 0,
    updated_block       BIGINT NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (market_id, account)
);

CREATE INDEX positions_account_idx ON positions(account);

-- =============================================================
-- position_collaterals — per-collateral amounts within a position
-- =============================================================
CREATE TABLE position_collaterals (
    market_id           BYTEA NOT NULL,
    account             BYTEA NOT NULL,
    collateral_index    SMALLINT NOT NULL,
    amount              NUMERIC(78, 0) NOT NULL,
    PRIMARY KEY (market_id, account, collateral_index),
    FOREIGN KEY (market_id, account) REFERENCES positions(market_id, account) ON DELETE CASCADE
);

-- =============================================================
-- settlements — per-market settlement state after maturity
-- =============================================================
CREATE TABLE settlements (
    market_id           BYTEA PRIMARY KEY REFERENCES markets(id) ON DELETE CASCADE,
    state               TEXT NOT NULL,              -- PRE_MATURITY | ORACLE_READ | PAT_REDEEMED | REPAY_WINDOW_OPEN | REPAY_WINDOW_CLOSED | FINAL | SHORTFALL
    terminal_prices     JSONB,                      -- {collateralIndex: price}
    repay_window_ends   BIGINT,                     -- unix timestamp
    pat_recovered       NUMERIC(78, 0),             -- total loan tokens received from PAT settlement
    shortfall_amount    NUMERIC(78, 0),             -- non-zero only in SHORTFALL state
    updated_block       BIGINT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- events — raw event log (source of truth; materialized views derive from this)
-- =============================================================
CREATE TABLE events (
    id                  BIGSERIAL PRIMARY KEY,
    block_number        BIGINT NOT NULL,
    tx_hash             BYTEA NOT NULL,
    log_index           INTEGER NOT NULL,
    contract_address    BYTEA NOT NULL,
    event_name          TEXT NOT NULL,              -- MarketCreated | Take | PATAttributed | Repay | ...
    payload             JSONB NOT NULL,             -- decoded fields
    confirmations       INTEGER NOT NULL DEFAULT 0,
    is_final            BOOLEAN NOT NULL DEFAULT FALSE,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tx_hash, log_index)
);

CREATE INDEX events_block_idx ON events(block_number DESC);
CREATE INDEX events_name_idx ON events(event_name);
CREATE INDEX events_final_idx ON events(is_final) WHERE NOT is_final;

-- =============================================================
-- indexer_cursor — bookmark for chain indexer
-- =============================================================
CREATE TABLE indexer_cursor (
    id                  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_block          BIGINT NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO indexer_cursor (id, last_block) VALUES (1, 0) ON CONFLICT DO NOTHING;
