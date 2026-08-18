#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
root="${CODEX_WORKER_ROOT:-$HOME/services/codex}"

cd "$root"
printf '%s worker_started pid=%s codex=%s\n' \
  "$(date --iso-8601=seconds)" "$$" "$(codex --version)"

# Single 24/7 workstation supervisor. It performs no model call by itself;
# the dedicated lounge session is added only in migration task 2.
while true; do
  if codex login status >/dev/null 2>&1; then
    auth=ready
  else
    auth=login_required
  fi
  printf '%s worker_healthy pid=%s auth=%s\n' \
    "$(date --iso-8601=seconds)" "$$" "$auth"
  sleep 300
done
