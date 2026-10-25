#!/usr/bin/env bash
set -euo pipefail
echo "=== EAS build scratchpad $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

npx eas-cli@latest build \
  --profile development \
  --platform android \
  --non-interactive \
  2>&1 \
| tee /tmp/eas-build-$(date +%s).log

echo "EXIT=$?"
echo "--- build artifacts ---"
ls -lR app/android 2>/dev/null || true
ls -lR .eas/ 2>/dev/null || true
