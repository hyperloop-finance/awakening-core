#!/bin/bash
# Run on Linux with Java 21, Node 22 and pnpm. Build only archived tracked Git source.
set -euo pipefail
checkout=$(realpath "$1")
staging=$(realpath -m "$2")
sha=$3
[[ "$sha" =~ ^[0-9a-f]{40}$ ]]
[[ $(uname -s) == Linux ]]
[[ $(git -C "$checkout" rev-parse HEAD) == "$sha" ]]
# The caller must fetch/verify the pushed SHA before invoking this build.
[[ -n $(git -C "$checkout" branch -r --contains "$sha") ]]
[[ ! -e "$staging" ]]
mkdir -p "$staging/source"
git -C "$checkout" archive "$sha" | tar -x -C "$staging/source"
printf '%s\n' "$sha" > "$staging/source-sha.txt"
cp -a "$staging/source/ops" "$staging/ops"
export NEXT_TELEMETRY_DISABLED=1 CI=true AWAKENING_STANDALONE=1 NEXT_PUBLIC_DATA_PROFILE=api
export NODE_OPTIONS=--max-old-space-size=1536
(
    cd "$staging/source/backend"
    ./mvnw -DskipTests package
)
cp "$staging/source/backend/target/awakening-backend-0.0.1-SNAPSHOT.jar" "$staging/backend.jar"
(
    cd "$staging/source/frontend"
    pnpm install --frozen-lockfile --ignore-scripts
    export NEXT_PUBLIC_TESTNET=arbitrum-sepolia NEXT_PUBLIC_API_BASE_URL=/arbitrum
    pnpm build
    cp -a .next/standalone "$staging/frontend-arbitrum"
    cp -a .next/static "$staging/frontend-arbitrum/.next/static"
    cp -a public "$staging/frontend-arbitrum/public"
    # Generated build output is isolated inside this staging directory.
    rm -rf .next
    export NEXT_PUBLIC_TESTNET=robinhood-testnet NEXT_PUBLIC_API_BASE_URL=/robinhood
    pnpm build
    cp -a .next/standalone "$staging/frontend-robinhood"
    cp -a .next/static "$staging/frontend-robinhood/.next/static"
    cp -a public "$staging/frontend-robinhood/public"
)
python3 - "$staging" <<'PY'
import hashlib
from pathlib import Path
import sys
root=Path(sys.argv[1])
files=[root/'backend.jar']
for directory in ('frontend-arbitrum','frontend-robinhood'):
    files.extend(path for path in (root/directory).rglob('*') if path.is_file())
(root/'artifacts.sha256').write_text(''.join(hashlib.sha256(path.read_bytes()).hexdigest()+'  '+str(path.relative_to(root))+'\n' for path in sorted(files)))
PY
python3 "$staging/ops/gcp/install-dual-release.py" "$staging" "check-$sha" "$sha" --check-only
printf 'Built validated release artifacts from %s in %s\n' "$sha" "$staging"
