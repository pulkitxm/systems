#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODULES=(
  notification-service
  kafka
  custom-protocol
  cron-jobs
  consistent-hashing
  bloom-filters
  rate-limiter
  mcp-server
)
status=0
for name in "${MODULES[@]}"; do
  dir="$ROOT/$name"
  if [[ ! -f "$dir/tsconfig.json" ]]; then
    echo "skip $name (no tsconfig.json)"
    continue
  fi
  echo "=== $name ==="
  (cd "$dir" && pnpm run type-check) || status=1
done
exit "$status"
