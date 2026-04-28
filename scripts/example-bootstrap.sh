#!/usr/bin/env bash
# Re-pack the lib, sync example/package.json's tarball ref to the current version,
# wipe stale install state, run bun install + expo prebuild --clean.
# Run from any cwd inside the repo.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

VERSION=$(node -p "require('./package.json').version")
TARBALL="expo-splash-full-screen-${VERSION}.tgz"

echo "[example] building lib"
bun run build

echo "[example] packing lib → $TARBALL"
bun pm pack >/dev/null

echo "[example] syncing example/package.json → file:../${TARBALL}"
# Edit in place via node so bun add does not duplicate the dep entry with mismatched specifiers.
node -e "
const fs = require('fs');
const p = './example/package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.dependencies['expo-splash-full-screen'] = 'file:../${TARBALL}';
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
"

cd example

# Bun's tarball cache can serve stale content when version is unchanged; nuke install state to force fresh resolve.
if [ -d node_modules ]; then
  STAMP=$(date +%s)
  mv node_modules "/tmp/esfs-example-nm-$STAMP"
  echo "[example] moved stale node_modules → /tmp/esfs-example-nm-$STAMP"
fi
if [ -f bun.lock ]; then
  STAMP=$(date +%s)
  mv bun.lock "/tmp/esfs-example-lock-$STAMP"
  echo "[example] moved stale bun.lock → /tmp/esfs-example-lock-$STAMP"
fi

echo "[example] installing"
bun install

PREBUILD_ARGS=(--clean)
if [ -n "${EXPO_PLATFORM:-}" ]; then
  PREBUILD_ARGS+=(--platform "$EXPO_PLATFORM")
fi
echo "[example] running expo prebuild ${PREBUILD_ARGS[*]}"
bunx expo prebuild "${PREBUILD_ARGS[@]}"

echo "[example] done. Run 'bun run ios' or 'bun run android' from example/."
