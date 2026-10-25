#!/usr/bin/env bash
set -euo pipefail
echo "=== Expo login scratchpad $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

# Interactive OAuth flow — not suitable for non-interactive automation.
# This exists only as a documented helper for a manual run.
npx eas-cli@latest login \
  --non-interactive \
  2>&1 \
| tee /tmp/eas-login-$(date +%s).log

echo "EXIT=$?"
echo "--- diagnostics ---"
echo "node=$(node -v)"
