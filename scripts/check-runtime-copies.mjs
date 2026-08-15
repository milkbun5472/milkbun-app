#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const home = homedir();
const pairs = [
  ["scripts/backup-runtime-infra.sh", join(home, "Library/Application Support/LisaPhone/runtime-maintenance/backup-runtime-infra.sh")],
  ["tools/codex-watchdog/codex_watchdog.py", join(home, "Library/Application Support/LisaPhone/runtime-maintenance/codex-watchdog/codex_watchdog.py")],
  ["tools/codex-watchdog/com.lisa.codex-watchdog.plist", join(home, "Library/Application Support/LisaPhone/runtime-maintenance/codex-watchdog/com.lisa.codex-watchdog.plist")],
  ["tools/yanqiu-wake/wake_queue.py", join(home, "Library/Application Support/LisaPhone/yanqiu-wake/wake_queue.py")],
  ["tools/yanqiu-wake/wake_queue.py", join(home, "Library/Application Support/LisaPhone/stackchan-relay/wake_queue.py")],
  ["tools/yanqiu-cc-bridge/bridge.py", join(home, "Library/Application Support/LisaPhone/yanqiu-cc-bridge/bridge.py")],
  ["tools/voice-prosody/voice_prosody.py", join(home, "Library/Application Support/LisaPhone/stackchan-relay/voice_prosody.py")],
  // Stop hook 运行时拷贝(2026-08-14 断流案):脚本住 iCloud 会被读锁卡到静默死,搬进 App Support,闸门保同步
  ["scripts/cc-ledger-stop.mjs", join(home, "Library/Application Support/LisaPhone/cc-ledger-runtime/scripts/cc-ledger-stop.mjs")],
  ["scripts/cc-ledger-nature.cjs", join(home, "Library/Application Support/LisaPhone/cc-ledger-runtime/scripts/cc-ledger-nature.cjs")],
  ["scripts/cc-somatic-shadow.cjs", join(home, "Library/Application Support/LisaPhone/cc-ledger-runtime/scripts/cc-somatic-shadow.cjs")],
  ["js/somatic-core.js", join(home, "Library/Application Support/LisaPhone/cc-ledger-runtime/js/somatic-core.js")]
];
const digest = p => createHash("sha256").update(readFileSync(p)).digest("hex");
const stale = [];
for (const [source, deployed] of pairs) {
  if (!existsSync(source) || !existsSync(deployed)) stale.push(`${source} -> ${deployed} (missing)`);
  else if (digest(source) !== digest(deployed)) stale.push(`${source} -> ${deployed} (content drift)`);
}
if (stale.length) {
  console.error("Runtime copy check failed:\n- " + stale.join("\n- "));
  process.exit(1);
}
console.log(`Runtime copy check OK: ${pairs.length} deployed copies match repository sources.`);
