#!/usr/bin/env python3
"""First deployment ONLY to the dedicated awakening-testnet Debian VM.

Run as root with: install-first-release.py STAGING_DIR RELEASE_ID JAR_SHA256
Staging must contain backend.jar, seed.dump, and the ops/gcp files.
Never reads a wallet key; creates only a local database password.
"""
import hashlib
import os
import pathlib
import re
import secrets
import shutil
import subprocess
import sys


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def sql(query):
    return subprocess.check_output(
        ['runuser', '-u', 'postgres', '--', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-d', 'postgres'],
        input=query, text=True,
    ).strip()


assert os.geteuid() == 0, 'Run as root'
assert subprocess.check_output(['hostname'], text=True).strip() == 'awakening-testnet', 'Wrong VM'
staging = pathlib.Path(sys.argv[1]).resolve()
release_id = sys.argv[2]
expected_hash = sys.argv[3]
assert re.fullmatch(r'[a-zA-Z0-9._-]+', release_id), 'Invalid release identifier'
assert re.fullmatch(r'[0-9a-f]{64}', expected_hash), 'Invalid checksum'
jar = staging / 'backend.jar'
assert hashlib.sha256(jar.read_bytes()).hexdigest() == expected_hash, 'Artifact checksum mismatch'
assert (staging / 'seed.dump').is_file(), 'Missing database snapshot'
assert not pathlib.Path('/etc/awakening/backend.env').exists(), 'Already configured: use a release update, not this bootstrap'
assert not pathlib.Path('/opt/awakening/current').exists(), 'Existing deployment must not be overwritten'
assert sql("SELECT count(*) FROM pg_database WHERE datname='awakening_bsc';") == '0', 'Database already exists'
assert sql("SELECT count(*) FROM pg_roles WHERE rolname='awakening';") == '0', 'Database role already exists'
os.umask(0o077)
if subprocess.run(['id', '-u', 'awakening'], capture_output=True).returncode != 0:
    run('useradd', '--system', '--user-group', '--home-dir', '/opt/awakening', '--no-create-home', '--shell', '/usr/sbin/nologin', 'awakening')
config_dir = pathlib.Path('/etc/awakening')
config_dir.mkdir(mode=0o700, exist_ok=True)
password = secrets.token_hex(32)
config = {
    'SPRING_PROFILES_ACTIVE': 'bsc-testnet',
    'PORT': '8082',
    'SERVER_ADDRESS': '127.0.0.1',
    'AWAKENING_DATABASE_URL': 'jdbc:postgresql://127.0.0.1:5432/awakening_bsc',
    'AWAKENING_DATABASE_USER': 'awakening',
    'AWAKENING_DATABASE_PASSWORD': password,
    'AWAKENING_RPC_URL': 'https://bsc-testnet-rpc.publicnode.com',
    'AWAKENING_CORS_ALLOWED_ORIGINS': 'https://app.hyperloop-fi.xyz',
    'AWAKENING_TRANSACTIONS_ENABLED': 'true',
    'MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE': 'health,info',
    'MANAGEMENT_ENDPOINT_HEALTH_SHOW_DETAILS': 'never',
    'SERVER_ERROR_INCLUDE_MESSAGE': 'never',
    'SERVER_ERROR_INCLUDE_STACKTRACE': 'never',
    'SERVER_SHUTDOWN': 'graceful',
    'SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE': '5',
}
env_path = config_dir / 'backend.env'
env_path.write_text(''.join(f'{k}={v}\n' for k, v in config.items()))
env_path.chmod(0o600)
sql("CREATE ROLE awakening LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '" + password + "';")
sql('CREATE DATABASE awakening_bsc OWNER awakening;')
restore_env = dict(os.environ, PGPASSWORD=password)
run('pg_restore', '--host=127.0.0.1', '--username=awakening', '--dbname=awakening_bsc', '--no-owner', '--no-acl', '--exit-on-error', str(staging / 'seed.dump'), env=restore_env)
release_dir = pathlib.Path('/opt/awakening/releases') / release_id
release_dir.mkdir(parents=True, mode=0o755)
release_dir.chmod(0o755)
pathlib.Path('/opt/awakening').chmod(0o755)
pathlib.Path('/opt/awakening/releases').chmod(0o755)
shutil.copyfile(jar, release_dir / 'backend.jar')
(release_dir / 'backend.jar').chmod(0o644)
(release_dir / 'release.txt').write_text(f'release={release_id}\njar_sha256={expected_hash}\n')
pathlib.Path('/opt/awakening/current').symlink_to(release_dir)
for name in ['awakening-backend.service', 'awakening-db-backup.service', 'awakening-db-backup.timer']:
    run('install', '-o', 'root', '-g', 'root', '-m', '644', str(staging / name), '/etc/systemd/system/' + name)
run('install', '-o', 'root', '-g', 'root', '-m', '755', str(staging / 'awakening-db-backup'), '/usr/local/sbin/awakening-db-backup')
run('systemctl', 'daemon-reload')
run('systemctl', 'enable', '--now', 'postgresql', 'awakening-backend', 'awakening-db-backup.timer')
run('systemctl', 'start', 'awakening-db-backup.service')
print('Release installed. Secrets remain root-readable on VM. Check health and chain readiness next.')
