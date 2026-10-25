#!/usr/bin/env python3
"""Install prebuilt artifacts from an exact pushed Git SHA; never builds/mutates source."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import urllib.request
import zipfile


def run(*args):
    return subprocess.run(args, check=True)


def validate(staging, sha):
    staging = staging.resolve()
    assert re.fullmatch(r'[0-9a-f]{40}', sha), 'Full Git SHA required'
    assert (staging / 'source-sha.txt').read_text().strip() == sha, 'Source SHA mismatch'
    entries = {}
    for line in (staging / 'artifacts.sha256').read_text().splitlines():
        digest, name = line.split(None, 1)
        name = name.lstrip('*')
        assert re.fullmatch(r'[0-9a-f]{64}', digest)
        assert not Path(name).is_absolute() and '..' not in Path(name).parts
        path = staging / name
        assert path.is_file(), 'Missing artifact: ' + name
        assert hashlib.sha256(path.read_bytes()).hexdigest() == digest, 'Artifact mismatch: ' + name
        entries[name] = digest
    assert 'backend.jar' in entries
    for directory in ('frontend-arbitrum', 'frontend-robinhood'):
        assert directory + '/server.js' in entries
        assert (staging / directory / '.next/static').is_dir()
        assert (staging / directory / 'public').is_dir()
        for path in (staging / directory).rglob('*'):
            if path.is_file():
                assert path.resolve().is_relative_to(staging / directory), 'External artifact symlink'
                assert str(path.relative_to(staging)) in entries, 'Unhashed artifact: ' + str(path)
    with zipfile.ZipFile(staging / 'backend.jar') as jar:
        for profile, chain in (('arbitrum-sepolia', 421614), ('robinhood-testnet', 46630)):
            m = json.loads(jar.read(f'BOOT-INF/classes/contracts/{profile}-{chain}.json'))
            assert m['chainId'] == chain
            for name in ('Awakening', 'OptionVault', 'AttestedPAT', 'AwakeningSettlement', 'EcrecoverRatifier'):
                address = m['contracts'][name]
                assert re.fullmatch('0x[0-9a-fA-F]{40}', address) and int(address, 16) != 0
    return entries


def atomic_link(link, target):
    temp = link.with_name(link.name + '.pending')
    if temp.is_symlink(): temp.unlink()
    assert not temp.exists()
    temp.symlink_to(target)
    temp.replace(link)


def backend_unit(profile):
    return f'''[Unit]
Description=Awakening {profile} backend
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service
[Service]
Type=simple
User=awakening
Group=awakening
WorkingDirectory=/opt/awakening
EnvironmentFile=/etc/awakening/{profile}.env
ExecStart=/usr/bin/java -Xms64m -Xmx384m -XX:MaxMetaspaceSize=192m -XX:+ExitOnOutOfMemoryError -jar /opt/awakening/multichain-current/backend.jar
Restart=on-failure
RestartSec=5
TimeoutStopSec=60
SuccessExitStatus=143
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
CapabilityBoundingSet=
MemoryMax=800M
TasksMax=128
[Install]
WantedBy=multi-user.target
'''


def frontend_unit(directory, port):
    root = f'/opt/awakening/{directory}'
    return f'''[Unit]
Description=Awakening frontend on {port}
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=awakening-web
Group=awakening-web
WorkingDirectory={root}
Environment=NODE_ENV=production
Environment=HOSTNAME=127.0.0.1
Environment=PORT={port}
Environment=NEXT_TELEMETRY_DISABLED=1
Environment=NODE_OPTIONS=--max-old-space-size=256
ExecStart=/opt/awakening-node/bin/node {root}/server.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
ReadWritePaths={root}/.next/cache
CapabilityBoundingSet=
MemoryMax=450M
TasksMax=64
[Install]
WantedBy=multi-user.target
'''


def healthy(port, chain):
    for _ in range(90):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/v1/config', timeout=5) as r:
                config = json.load(r)
            if config.get('chainId') == chain and config.get('verificationStatus') == 'VERIFIED':
                with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/v1/chain/markets', timeout=5) as r:
                    markets = json.load(r)
                if markets.get('chainId') == chain and markets.get('markets'): return
        except Exception:
            pass
        time.sleep(2)
    raise RuntimeError(f'Backend {port} did not reach verified indexed state; previous proxy remains active')


def main():
    staging = Path(sys.argv[1]).resolve()
    release = sys.argv[2]
    sha = sys.argv[3]
    assert re.fullmatch(r'[a-zA-Z0-9._-]+', release)
    hashes = validate(staging, sha)
    if '--check-only' in sys.argv[4:]:
        print('Artifacts and packaged chain manifests validated for ' + sha)
        return
    assert os.geteuid() == 0, 'Run as root'
    assert subprocess.check_output(['hostname'], text=True).strip() == 'awakening-testnet', 'Wrong VM'
    os.umask(0o077)
    destination = Path('/opt/awakening/multichain-releases') / release
    previous = Path('/opt/awakening/multichain-current')
    backup = Path('/opt/awakening/rollback') / release
    record = {'source_sha': sha, 'release': release, 'artifact_hashes': hashes}
    if destination.exists():
        assert json.loads((destination / 'release.json').read_text())['source_sha'] == sha
        for name, digest in hashes.items():
            assert hashlib.sha256((destination / name).read_bytes()).hexdigest() == digest, 'Existing release differs'
    else:
        destination.mkdir(parents=True, mode=0o755)
        destination.parent.chmod(0o755)
        for name in ('backend.jar', 'source-sha.txt', 'artifacts.sha256'):
            shutil.copy2(staging / name, destination / name)
        for name in ('frontend-arbitrum', 'frontend-robinhood'):
            shutil.copytree(staging / name, destination / name, symlinks=True)
        (destination / 'release.json').write_text(json.dumps(record, indent=2) + '\n')
        run('chown', '-R', 'root:root', str(destination))
        run('chmod', '-R', 'u=rwX,go=rX', str(destination))
        for name in ('frontend-arbitrum', 'frontend-robinhood'):
            cache = destination / name / '.next/cache'
            cache.mkdir(mode=0o750, exist_ok=True)
            run('chown', '-R', 'awakening-web:awakening-web', str(cache))
    backup.mkdir(parents=True, exist_ok=True, mode=0o700)
    # Snapshot once so retrying the same install preserves the original rollback.
    state = backup / 'state.json'
    units = ['awakening-arbitrum-backend', 'awakening-robinhood-backend', 'awakening-frontend', 'awakening-robinhood-frontend']
    links = ['multichain-current', 'frontend-current', 'robinhood-frontend-current']
    if not state.exists():
        state.write_text(json.dumps({name: str((Path('/opt/awakening') / name).readlink()) if (Path('/opt/awakening') / name).is_symlink() else None for name in links}, indent=2))
        for unit in units:
            source = Path('/etc/systemd/system') / (unit + '.service')
            if source.exists(): shutil.copy2(source, backup / source.name)
        shutil.copy2('/etc/caddy/Caddyfile', backup / 'Caddyfile')
    existing = {}
    for line in Path('/etc/awakening/backend.env').read_text().splitlines():
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            existing[key] = value
    for key in ('AWAKENING_DATABASE_URL', 'AWAKENING_DATABASE_USER', 'AWAKENING_DATABASE_PASSWORD'):
        assert existing.get(key), 'Missing existing database configuration'
    for profile, port, rpc in (('arbitrum-sepolia', 8083, 'https://sepolia-rollup.arbitrum.io/rpc'), ('robinhood-testnet', 8084, 'https://robinhood-sepolia-rpc.publicnode.com')):
        config = {key: value for key, value in existing.items() if key.startswith('AWAKENING_DATABASE_')}
        config.update(SPRING_PROFILES_ACTIVE=profile, PORT=str(port), SERVER_ADDRESS='127.0.0.1', AWAKENING_RPC_URL=rpc,
                      AWAKENING_CORS_ALLOWED_ORIGINS='https://app.hyperloop-fi.xyz', AWAKENING_TRANSACTIONS_ENABLED='true',
                      SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE='3', MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE='health,info',
                      SERVER_ERROR_INCLUDE_MESSAGE='never', SERVER_ERROR_INCLUDE_STACKTRACE='never')
        path = Path('/etc/awakening') / (profile + '.env')
        path.write_text(''.join(f'{key}={value}\n' for key, value in config.items()))
        path.chmod(0o600)
    definitions = {
        'awakening-arbitrum-backend': backend_unit('arbitrum-sepolia'),
        'awakening-robinhood-backend': backend_unit('robinhood-testnet'),
        'awakening-frontend': frontend_unit('frontend-current', 3000),
        'awakening-robinhood-frontend': frontend_unit('robinhood-frontend-current', 3001),
    }
    for unit, contents in definitions.items():
        path = Path('/etc/systemd/system') / (unit + '.service')
        path.write_text(contents)
        path.chmod(0o644)
    proxy = staging / 'ops/gcp/Caddyfile.multichain'
    run('caddy', 'validate', '--config', str(proxy), '--adapter', 'caddyfile')
    atomic_link(previous, destination)
    run('systemctl', 'daemon-reload')
    run('systemctl', 'enable', *units)
    run('systemctl', 'restart', 'awakening-arbitrum-backend', 'awakening-robinhood-backend')
    healthy(8083, 421614)
    healthy(8084, 46630)
    atomic_link(Path('/opt/awakening/frontend-current'), destination / 'frontend-arbitrum')
    atomic_link(Path('/opt/awakening/robinhood-frontend-current'), destination / 'frontend-robinhood')
    run('systemctl', 'restart', 'awakening-frontend', 'awakening-robinhood-frontend')
    shutil.copy2(proxy, '/etc/caddy/Caddyfile')
    run('systemctl', 'reload', 'caddy')
    record['installed_at_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    (destination / 'release.json').write_text(json.dumps(record, indent=2) + '\n')
    print('Installed Git SHA ' + sha + '; BSC backend retained; rollback state: ' + str(backup))


if __name__ == '__main__':
    main()
