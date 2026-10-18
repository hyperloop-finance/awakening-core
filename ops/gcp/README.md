# Awakening testnet backend on Google Compute Engine

## Deployment target

- Project: `level-poetry-395302`
- Instance: `awakening-testnet`, zone `us-central1-a`
- Static external IP: `34.28.152.248`
- Debian 13, e2-medium (4 GB RAM), 40 GB balanced persistent disk
- Backend artifact source: `ce0b09ce20c2e4bdc8b5d0596f86ac3ff731b5ae`
- Backend JAR SHA-256: `04c10816fe98831c9768974db9fa54cbc3c0301feaa0803b3742544e56470eb6`

This is BNB testnet (chain 97), not mainnet. No wallet private key is required or
installed on the server. Transactions remain signed by users' wallets.

## Runtime and exposure

| Component | Location / binding |
| --- | --- |
| Java 21 backend | systemd `awakening-backend`, `127.0.0.1:8082` |
| PostgreSQL 17 | systemd `postgresql@17-main`, localhost port 5432 |
| Database | `awakening_bsc`, schema `awakening_live`, role `awakening` |
| Application releases | `/opt/awakening/releases/ce0b09c/backend.jar` |
| Active release | `/opt/awakening/current` symlink |
| Configuration / DB password | `/etc/awakening/backend.env`, root-only mode 0600 |
| Daily logical backups | `/var/backups/awakening`, root-only |

The backend runs as the non-login `awakening` OS user, with an unprivileged
database role, 768 MB Java heap, and a 1400 MB systemd memory limit. Services and
the backup timer are enabled at boot. Backend automatic restart applies to
process failures; it does not remediate RPC downtime.

**No public API or frontend is published by this deployment.** The next stage is
an HTTPS reverse proxy and frontend at `app.hyperloop-fi.xyz`; do not open 5432
or 8082 to the Internet. CORS is prepared for that HTTPS origin. Only health/info
Actuator endpoints are enabled, without health details or error stack traces.

## Initial installation

`install-first-release.py` is a **first-install-only** script. It refuses to
overwrite an existing database, application configuration, or active release.
Install Java 21 and PostgreSQL 17 from Debian's packages first. Upload:

- a locally tested Spring Boot JAR as `backend.jar`;
- a consistent `pg_dump --format=custom --no-owner --no-acl` as `seed.dump`;
- the service, timer, backup script, and installer in this directory.

Run as root on the named VM:

```bash
python3 install-first-release.py STAGING_DIRECTORY RELEASE_ID JAR_SHA256
```

The installer checks the artifact checksum, creates the database password on
the VM, restores the snapshot without source ownership/ACLs, and starts services.
The initial cloud database is a snapshot of the local test database. The two
databases are **not replicas**; subsequent off-chain orders are not synchronized.
Each indexer independently follows the same deployed contracts.

## Verification and operations

```bash
sudo systemctl status awakening-backend postgresql@17-main
curl -fsS http://127.0.0.1:8082/actuator/health
curl -fsS http://127.0.0.1:8082/api/v1/config
curl -fsS http://127.0.0.1:8082/api/v1/chain/markets
sudo journalctl -u awakening-backend -n 100 --no-pager
sudo systemctl list-timers awakening-db-backup.timer
```

`sudo python3 verify-backend.py` checks API readiness, chain 97, contract
verification, migrations, and database role permissions. Add `--restart` only
when a brief interruption is acceptable; it checks signed order persistence
across a backend restart. The script makes no on-chain writes.

For subsequent releases, back up the database first, install a new immutable
release directory, update `/opt/awakening/current`, then restart and verify.
Keep the previous release for rollback. If a new release changes the database
schema, assess backward compatibility before rolling back code; do not blindly
restore an old database over new orders. Never rerun the first-install script
to perform an update.

## Backup limitations

The timer runs daily at 04:15 UTC with up to 15 minutes of jitter, and completed
logical backups are retained for approximately seven days. A backup is also
taken during initial installation. Backups are written atomically after archive
listing validation; this is not a substitute for a full restore drill.

These backups are **on the same VM disk**, not an off-site backup. Existing GCP
disk snapshot policy was not modified. The VM's boot disk currently has
`autoDelete=true`; disable it and establish verified off-site backups before
using this setup for valuable data. No new paid cloud resources were created.

## Deployment access

The initial deployment used a dedicated instance-level SSH public key expiring
after 24 hours. Other users' SSH keys were preserved, and project-wide SSH
metadata was not changed. Local deployment keys, known-host records, and the
database snapshot live in ignored `.local-runtime/`; none belong in Git.
