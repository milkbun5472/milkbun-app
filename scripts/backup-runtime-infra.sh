#!/bin/zsh
set -euo pipefail

# Code/config only. Runtime data, .env files, tokens and logs are intentionally excluded.
readonly support_root="$HOME/Library/Application Support/LisaPhone"
readonly backup_root="$support_root/backups/runtime-infra"
readonly stamp="$(date -u +%Y%m%dT%H%M%SZ)"
readonly snapshot="$backup_root/$stamp"

mkdir -p "$snapshot/stackchan-relay" "$snapshot/fable-bridge" "$snapshot/launch-agents" \
  "$snapshot/claude/rules" "$snapshot/codex-watchdog"

for name in server.py relay_ctl.py watch_api.py wake_queue.py voice_prosody.py; do
  source_path="$support_root/stackchan-relay/$name"
  [[ -f "$source_path" ]] && install -m 600 "$source_path" "$snapshot/stackchan-relay/$name"
done

# Private config backup: stored under Application Support with mode 600, never added to Git.
[[ -f "$support_root/runtime-maintenance/private-config/settings.local.json" ]] && \
  install -m 600 "$support_root/runtime-maintenance/private-config/settings.local.json" "$snapshot/claude/settings.local.json"
[[ -f "$support_root/runtime-maintenance/private-config/cc-ledger-marker.md" ]] && \
  install -m 600 "$support_root/runtime-maintenance/private-config/cc-ledger-marker.md" "$snapshot/claude/rules/cc-ledger-marker.md"

for name in README.md codex_watchdog.py com.lisa.codex-watchdog.plist test_codex_watchdog.py; do
  source_path="$support_root/runtime-maintenance/codex-watchdog/$name"
  [[ -f "$source_path" ]] && install -m 600 "$source_path" "$snapshot/codex-watchdog/$name"
done

for name in bridge.py; do
  source_path="$support_root/fable-bridge/$name"
  [[ -f "$source_path" ]] && install -m 600 "$source_path" "$snapshot/fable-bridge/$name"
done

for name in com.lisa.fable-bridge.plist com.lisa.yanqiu-wake.plist; do
  source_path="$HOME/Library/LaunchAgents/$name"
  [[ -f "$source_path" ]] && install -m 600 "$source_path" "$snapshot/launch-agents/$name"
done

print -r -- "$snapshot"
