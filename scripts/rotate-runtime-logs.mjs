#!/usr/bin/env node
import { existsSync, renameSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const home = homedir();
const targets = [
  join(root, ".claude/cc-ledger-state/candidates.jsonl"),
  join(root, ".claude/cc-ledger-state/diagnostic.jsonl"),
  join(root, ".claude/cc-ledger-state/alerts.jsonl"),
  join(home, "Library/Application Support/LisaPhone/yanqiu-wake/wake_inbox.jsonl"),
  join(home, "Library/Application Support/LisaPhone/stackchan-relay/wake_inbox.jsonl"),
  join(home, "Library/Application Support/LisaPhone/stackchan-relay/voice_jobs.jsonl"),
  join(home, "Library/Application Support/LisaPhone/fable-bridge/stdout.log"),
  join(home, "Library/Application Support/LisaPhone/fable-bridge/stderr.log")
];
const limit = Math.max(128 * 1024, Number(process.env.LOG_ROTATE_BYTES) || 1024 * 1024);
for (const file of targets) {
  if (!existsSync(file) || statSync(file).size <= limit) continue;
  for (let i = 3; i >= 1; i--) {
    const from = `${file}.${i}`, to = `${file}.${i + 1}`;
    if (!existsSync(from)) continue;
    if (i === 3) rmSync(from);
    else renameSync(from, to);
  }
  renameSync(file, `${file}.1`);
  console.log(`rotated ${file}`);
}
