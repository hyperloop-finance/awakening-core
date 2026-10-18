#!/usr/bin/env python3
"""Run on the VM with sudo; --restart also checks persistence across service restart."""
import json
import subprocess
import sys
import time
import urllib.request


def db(query):
    return subprocess.check_output(['runuser', '-u', 'postgres', '--', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-d', 'awakening_bsc', '-c', query], text=True).strip()


def get(path):
    with urllib.request.urlopen('http://127.0.0.1:8082' + path, timeout=45) as response:
        return json.load(response)


order_query = "SELECT count(*) || ':' || COALESCE(md5(string_agg(id || payload::text, '' ORDER BY scope,id)), '') FROM awakening_live.chain_orders"
before = db(order_query)
if '--restart' in sys.argv:
    subprocess.run(['systemctl', 'restart', 'awakening-backend'], check=True)
deadline = time.monotonic() + 120
while True:
    try:
        assert get('/actuator/health')['status'] == 'UP'
        markets = get('/api/v1/chain/markets')
        assert markets['chainId'] == 97 and len(markets['markets']) >= 1
        break
    except Exception:
        if time.monotonic() > deadline:
            raise
        time.sleep(5)
config = get('/api/v1/config')
assert config['profile'] == 'bsc-testnet' and config['chainId'] == 97
assert config['contractsReady'] and config['verificationStatus'] == 'VERIFIED'
assert config['transactionsEnabled']
wallet = '0x7E406D8d82a7Cf4139d1d6e84EA085A7f60F1591'
account = get('/api/v1/chain/accounts/' + wallet)
orders = get('/api/v1/chain/orders?maker=' + wallet)
assert account['chainId'] == 97
assert db(order_query) == before, 'Signed order records changed unexpectedly'
assert db("SELECT string_agg(version, ',' ORDER BY installed_rank) FROM awakening_live.flyway_schema_history WHERE success AND type='SQL'") == '1,2'
assert db("SELECT rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication FROM pg_roles WHERE rolname='awakening'") == 'f'
print(json.dumps({
    'health': 'UP', 'chainId': config['chainId'], 'verification': config['verificationStatus'],
    'markets': len(markets['markets']), 'accountFields': list(account),
    'orderResponseFields': list(orders), 'signedOrdersPreserved': True,
    'databaseOrders': before.split(':')[0], 'databaseEvents': db('SELECT count(*) FROM awakening_live.chain_events'),
    'positions': account.get('positions'), 'restartChecked': '--restart' in sys.argv,
}, indent=2))
