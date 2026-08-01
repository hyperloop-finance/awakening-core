# Awakening Backend

Java 21 + Spring Boot 3 + PostgreSQL + web3j.

See `../Awakening Implementation Plan.md` §Phase 2 for the full milestone
plan. This scaffold delivers Milestone 2A (skeleton + Postgres + first
migration). Chain indexer, offer relay, PAT attestation, and router are
not yet implemented.

## Prerequisites

- Java 21 LTS
- Docker (for local Postgres)

No global Maven install required — the `./mvnw` wrapper is included.

## Local development

1. Start Postgres + anvil (from repo root):
   ```bash
   docker compose -f ops/docker-compose.yml up -d
   ```

2. Build + run tests:
   ```bash
   ./mvnw verify
   ```

3. Run the app:
   ```bash
   ./mvnw spring-boot:run
   ```
   Serves on `http://localhost:8080`. Actuator health at `/actuator/health`.

## Configuration

Environment variables (with defaults for local dev in parens):

- `DATABASE_URL` (`jdbc:postgresql://localhost:5432/awakening`)
- `DATABASE_USER` (`awakening`)
- `DATABASE_PASSWORD` (`awakening`)
- `AWAKENING_RPC_URL` (`http://localhost:8545`)
- `AWAKENING_CHAIN_ID` (`31337`)
- `AWAKENING_INDEXER_START_BLOCK` (`0`)
- `AWAKENING_INDEXER_CONFIRMATIONS` (`12`)
- `PORT` (`8080`)

## Package layout (planned)

```
xyz.hyperloop.awakening
├── indexer/       Chain event → Postgres
├── offer/         Off-chain offer relay
├── attestation/   Deribit + Derive + internal PAT sources
├── router/        Best-fill computation
├── contracts/     web3j-generated bindings (Milestone 2A.3)
└── common/        DTOs, config, shared utilities
```

Currently only the top-level `AwakeningBackendApplication` exists —
packages will be created as their milestones are implemented.
