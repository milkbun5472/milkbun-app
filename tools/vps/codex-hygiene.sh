#!/usr/bin/env bash
set -euo pipefail

root="${CODEX_WORKER_ROOT:-$HOME/services/codex}"
sessions="$root/sessions"
logs="$root/logs"
max_bytes=$((2 * 1024 * 1024 * 1024))

mkdir -p "$sessions" "$logs"

# Session recordings are disposable worker traces, never the Mac primary session.
find "$sessions" -type f -mtime +7 -delete
# Delivered replies and failed letters are pickup/evidence files, not permanent storage.
for transient in replies failed processing; do
  [[ -d "$root/$transient" ]] && find "$root/$transient" -type f -mtime +7 -delete
done

size_bytes() {
  du -sk "$sessions" | awk '{print $1 * 1024}'
}

current="$(size_bytes)"
while (( current > max_bytes )); do
  oldest="$(find "$sessions" -type f -print0 \
    | xargs -0 stat -c '%Y %n' 2>/dev/null \
    | sort -n \
    | head -n 1 \
    | cut -d' ' -f2-)"
  [[ -n "$oldest" ]] || break
  rm -f -- "$oldest"
  current="$(size_bytes)"
done

printf '%s sessions_bytes=%s cap_bytes=%s\n' \
  "$(date --iso-8601=seconds)" "$current" "$max_bytes"
