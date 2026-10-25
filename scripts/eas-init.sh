#!/usr/bin/env bash
set -euo pipefail
echo "=== EAS init scratchpad $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
export NODE_ENV=production

npx eas-cli@latest init \
  --account "patrikorpelainen" \
  --non-interactive \
  --json \
| tee /tmp/eas-init-$(date +%s).log

echo "EXIT=$?"

echo "--- files changed ---"
ls -lR .eas/ 2>/dev/null || true
git status --short 2>/dev/null || true

echo "--- diagnostics ---"
echo "node=$(node -v)"
echo "npx=$(npx --version 2>/dev/null || true)"
echo "hour=$(date +%H) tz=$(date +%Z)"
