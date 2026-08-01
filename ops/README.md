# Ops — Local Development

## Start local Postgres + anvil

```bash
docker compose -f ops/docker-compose.yml up -d
```

## Stop and remove

```bash
docker compose -f ops/docker-compose.yml down
```

## Reset Postgres data

```bash
docker compose -f ops/docker-compose.yml down -v
```

## Endpoints

- Postgres: `postgresql://awakening:awakening@localhost:5432/awakening`
- Anvil RPC: `http://localhost:8545` (chain id 31337)

## Baseline test report

`baseline-test-report.txt` captures the Midnight test-suite output at
the point of forking. Regenerate with:

```bash
cd contracts && forge test --gas-report | tee ../ops/baseline-test-report.txt
```
