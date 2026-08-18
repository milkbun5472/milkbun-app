#!/usr/bin/env node
// 账本轻推手(2026-08-18,第零件 Mac 侧):把 Stop hook 落在 outbox.jsonl 里的票
// 原样 POST 给 VPS 投递员;投递员确认收下(200)才把这些票从 outbox 移走。
// 不写云、不验真、不判断——只搬票。launchd 每 20 秒跑一次;失败原地不动等下次。
import { readFileSync, existsSync, writeFileSync, renameSync, appendFileSync } from "node:fs";
const STATE = "/Users/lisa/Library/Application Support/LisaPhone/cc-ledger-state";
const OUTBOX = STATE + "/outbox.jsonl";
const DIAG = STATE + "/diagnostic.jsonl";
const TOKEN_FILE = "/Users/lisa/Library/Application Support/LisaPhone/cc-ledger-runtime/courier.token";
const URL = "https://yanqiu-vps.tail542792.ts.net/courier/ingest";
const log = (v) => appendFileSync(DIAG, JSON.stringify({ at: new Date().toISOString(), source: "cc-ledger-push", ...v }) + "\n");

if (!existsSync(OUTBOX)) process.exit(0);
const raw = readFileSync(OUTBOX, "utf8");
const lines = raw.split("\n").filter(Boolean);
if (!lines.length) process.exit(0);
let token = ""; try { token = readFileSync(TOKEN_FILE, "utf8").trim(); } catch {}
if (!token) { log({ outcome: "push_skipped", error: "no token" }); process.exit(0); }
const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
try {
  const r = await fetch(URL, { method: "POST", headers: { "x-courier-token": token, "Content-Type": "application/x-ndjson" }, body: lines.join("\n") + "\n", signal: ctl.signal });
  if (!r.ok) throw new Error("courier " + r.status);
  const j = await r.json();
  // 只移走这次真的发出去的那些行(期间 hook 可能又落了新票)
  const now = existsSync(OUTBOX) ? readFileSync(OUTBOX, "utf8") : "";
  const rest = now.startsWith(raw) ? now.slice(raw.length) : now;
  writeFileSync(OUTBOX + ".tmp", rest); renameSync(OUTBOX + ".tmp", OUTBOX);
  log({ outcome: "pushed", sent: lines.length, added: j.added, queued_at_courier: j.queued });
} catch (e) {
  log({ outcome: "push_failed", pending: lines.length, error: String(e.message).slice(0, 120) });
} finally { clearTimeout(t); }
