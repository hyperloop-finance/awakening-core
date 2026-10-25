"""Artifact gate tests; no server or service mutation."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('installer', Path(__file__).with_name('install-dual-release.py'))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class ArtifactGateTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.sha = 'a' * 40
        (self.root / 'source-sha.txt').write_text(self.sha)
        self.jar()
        for name in ('frontend-arbitrum', 'frontend-robinhood'):
            root = self.root / name
            (root / '.next/static').mkdir(parents=True)
            (root / 'public').mkdir()
            (root / 'server.js').write_text('test fixture')
        self.hashes()

    def jar(self, zero=False):
        with zipfile.ZipFile(self.root / 'backend.jar', 'w') as jar:
            for profile, chain in (('arbitrum-sepolia', 421614), ('robinhood-testnet', 46630)):
                data = {'chainId': chain, 'contracts': {name: '0x' + ('0' if zero else '1') * 40 for name in ('Awakening', 'OptionVault', 'AttestedPAT', 'AwakeningSettlement', 'EcrecoverRatifier')}}
                jar.writestr(f'BOOT-INF/classes/contracts/{profile}-{chain}.json', json.dumps(data))

    def hashes(self):
        files = [self.root / 'backend.jar']
        files += list(self.root.glob('frontend-*/server.js'))
        (self.root / 'artifacts.sha256').write_text(''.join(hashlib.sha256(path.read_bytes()).hexdigest() + '  ' + str(path.relative_to(self.root)) + '\n' for path in files))

    def test_valid_package(self):
        self.assertIn('backend.jar', installer.validate(self.root, self.sha))

    def test_wrong_source_commit(self):
        with self.assertRaises(AssertionError): installer.validate(self.root, 'b' * 40)

    def test_changed_artifact(self):
        (self.root / 'frontend-arbitrum/server.js').write_text('modified')
        with self.assertRaises(AssertionError): installer.validate(self.root, self.sha)

    def test_unhashed_artifact(self):
        (self.root / 'frontend-robinhood/public/extra.js').write_text('extra')
        with self.assertRaises(AssertionError): installer.validate(self.root, self.sha)

    def test_zero_deployment(self):
        self.jar(zero=True)
        self.hashes()
        with self.assertRaises(AssertionError): installer.validate(self.root, self.sha)

    def test_external_artifact_link(self):
        (self.root / 'frontend-arbitrum/public/external').symlink_to('/etc/hosts')
        with self.assertRaises(AssertionError): installer.validate(self.root, self.sha)


if __name__ == '__main__':
    unittest.main()
