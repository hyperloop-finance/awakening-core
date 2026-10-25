#!/usr/bin/env python3
"""Restore the pre-rollout frontend/proxy; never rolls back database contents."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

assert os.geteuid() == 0
assert subprocess.check_output(['hostname'], text=True).strip() == 'awakening-testnet'
release = sys.argv[1]
assert re.fullmatch(r'[a-zA-Z0-9._-]+', release)
backup = Path('/opt/awakening/rollback') / release
state = json.loads((backup / 'state.json').read_text())
subprocess.run(['caddy', 'validate', '--config', str(backup / 'Caddyfile'), '--adapter', 'caddyfile'], check=True)
for name, target in state.items():
    link = Path('/opt/awakening') / name
    if target is None:
        if link.is_symlink(): link.unlink()
    else:
        temp = link.with_name(link.name + '.rollback')
        if temp.is_symlink(): temp.unlink()
        temp.symlink_to(target)
        temp.replace(link)
units = ['awakening-arbitrum-backend', 'awakening-robinhood-backend', 'awakening-frontend', 'awakening-robinhood-frontend']
restored = []
for name in units:
    source = backup / (name + '.service')
    if source.exists():
        shutil.copy2(source, Path('/etc/systemd/system') / source.name)
        restored.append(name)
    else:
        subprocess.run(['systemctl', 'disable', '--now', name], check=True)
subprocess.run(['systemctl', 'daemon-reload'], check=True)
if restored: subprocess.run(['systemctl', 'restart', *restored], check=True)
shutil.copy2(backup / 'Caddyfile', '/etc/caddy/Caddyfile')
subprocess.run(['systemctl', 'reload', 'caddy'], check=True)
print('Previous application routes restored. BSC backend and all database data retained.')
