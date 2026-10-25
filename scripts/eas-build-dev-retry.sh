#!/usr/bin/env bash
set -euo pipefail
echo "=== EAS build retry scratchpad $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

for attempt in 1 2 3; do
  if [ "$attempt" -gt 1 ]; then
    backoff=$(( attempt * 10 ))
    echo "backing off ${backoff}s before retry $attempt"
    sleep "$backoff"
  fi
  echo "=== attempt $attempt ==="
  npx eas-cli@latest build \
    --profile development \
    --platform android \
    --non-interactive \
    2>&1 \
    | tee /tmp/eas-build-dev-${attempt}-$(date +%s).log
  rc=${PIPESTATUS[0]}
  echo "attempt $attempt exit=$rc"
  if [ "$rc" -eq 0 ]; then
    break
  fi
  echo "retry $attempt failed; continuing"
done

echo "=== final artifacts ==="
ls -lR app/android 2>/dev/null || true
ls -lR .eas/ 2>/dev/null || true
