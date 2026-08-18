#!/usr/bin/env node
// CC→App 候选轮的唯一返修入口。
// 安全顺序：--list → --draft TURN_ID → 人工只勾逐字原句 → --check PLAN → --commit PLAN。
// 一次只处理一轮；无批量日期模式、无默认 life、无改写、无第二写路。
import { readFileSync, existsSync, writeFileSync, renameSync, appendFileSync } from "fs";
import { basename, join } from "path";
import { createHash } from "crypto";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { buildDraft, validatePlan } = require("./cc-ledger-repair.cjs");
const projectDir = process.env.CLAUDE_PROJECT_DIR || "/Users/lisa/Desktop/Lisa-phone";
const stateDir = join(projectDir, ".claude", "cc-ledger-state");
const candidatePath = join(stateDir, "candidates.jsonl");
const diagnosticPath = join(stateDir, "diagnostic.jsonl");

function readJSONL(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
}
function replaceJSONL(path, rows) {
  const tmp = path + ".tmp";
  writeFileSync(tmp, rows.map(x => JSON.stringify(x)).join("\n") + (rows.length ? "\n" : ""));
  renameSync(tmp, path);
}
function loadEnv() {
  const env = {};
  readFileSync("/Users/lisa/Desktop/lisa-practice/mcp/.env", "utf8").split("\n").forEach(line => {
    const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim();
  });
  return env;
}
async function request(base, key, path, options = {}) {
  const headers = { apikey: key, Authorization: "Bearer " + key, ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  const res = await fetch(base + path, { method: options.method || "GET", headers, body: options.body ? JSON.stringify(options.body) : undefined });
  if (!res.ok) throw new Error("supabase " + res.status + ": " + (await res.text()).slice(0, 160));
  const text = await res.text(); return text ? JSON.parse(text) : [];
}
async function resolveYanqiu(base, key, user) {
  const saves = await request(base, key, `/rest/v1/saves?select=${encodeURIComponent("x_characters:data->>x_characters,x_chatSettings:data->>x_chatSettings")}&user_id=eq.${user}`);
  if (!saves[0]) throw new Error("cloud save missing");
  const data = saves[0] || {}, chars = JSON.parse(data.x_characters || "[]"), settings = JSON.parse(data.x_chatSettings || "{}");
  const digital = chars.filter(c => c && settings[c.id] && settings[c.id].engineerEyes === true);
  const char = digital.length === 1 ? digital[0] : chars.find(c => c && /小克|言秋/.test(String(c.name || "") + String(c.remark || "")));
  if (!char) throw new Error("yanqiu identity missing");
  return String(char.id);
}
function usage() {
  console.log("usage: cc-ledger-replay --list | --draft TURN_ID | --check PLAN.json | --commit PLAN.json");
}

const rows = readJSONL(candidatePath);
const args = process.argv.slice(2);
const mode = args[0];
if (mode === "--list") {
  rows.filter(r => r.status === "candidate").forEach(r => console.log([r.turn_id, r.occurred_at || r.at, (r.reasons || []).join(",")].join("\t")));
  process.exit(0);
}
if (mode === "--draft") {
  const turnId = String(args[1] || ""), candidate = rows.find(r => r.status === "candidate" && String(r.turn_id) === turnId);
  if (!candidate) throw new Error("candidate_not_found");
  const safe = turnId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const out = join(stateDir, "repair-" + safe + ".json");
  writeFileSync(out, JSON.stringify(buildDraft(candidate), null, 2) + "\n");
  console.log(out);
  process.exit(0);
}
if (mode !== "--check" && mode !== "--commit") { usage(); process.exit(2); }
const planPath = String(args[1] || "");
if (!planPath || !existsSync(planPath)) throw new Error("repair_plan_missing");
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const candidate = rows.find(r => r.status === "candidate" && String(r.turn_id) === String(plan.turn_id || ""));
if (!candidate) throw new Error("candidate_not_found");
const selected = validatePlan(candidate, plan);
if (mode === "--check") {
  console.log(`checked ${candidate.turn_id}: lisa=${selected.lisa_segments.length}, yanqiu=${selected.yanqiu_segments.length}`);
  process.exit(0);
}

const env = loadEnv(), base = "https://nposjnafsbikwfeoudbg.supabase.co", key = env.SUPABASE_SERVICE_KEY, user = env.TARGET_USER;
if (!key || !user) throw new Error("mcp env incomplete");
const charId = await resolveYanqiu(base, key, user);
const hash = createHash("sha256").update(candidate.session_id + "\0" + candidate.turn_id).digest("hex").slice(0, 32);
const baseMs = Number.isFinite(Date.parse(candidate.occurred_at)) ? Date.parse(candidate.occurred_at) : Date.now();
const makeRows = (segments, side, speakerType, offset) => segments.map((segment, index) => ({
  user_id: user, message_key: `cc:${hash}:${side}:${index}`, char_id: charId, thread_type: "cc", thread_id: candidate.session_id,
  speaker_type: speakerType, speaker_id: speakerType === "character" ? charId : null, content: segment.content,
  occurred_at: new Date(baseMs + offset + index).toISOString(), source: "cc",
  source_message_id: `${candidate.session_id}:${candidate.turn_id}:${side}:${index}`,
  metadata: { shadow_version: 1, auto_capture_version: 1, excerpted: true, sync_kind: segment.sync_kind, segment_side: side, segment_index: index, replayed: true, repair_schema: 1 }
}));
const payload = [...makeRows(selected.lisa_segments, "lisa", "lisa", 0), ...makeRows(selected.yanqiu_segments, "yanqiu", "character", selected.lisa_segments.length + 1)];
await request(base, key, "/rest/v1/chat_messages?on_conflict=user_id,message_key", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: payload });
replaceJSONL(candidatePath, rows.map(r => r === candidate ? { ...r, status: "replayed", repair_plan: basename(planPath) } : r));
appendFileSync(diagnosticPath, JSON.stringify({ at: new Date().toISOString(), outcome: "replayed", turn_id: candidate.turn_id, rows: payload.length, repair_schema: 1 }) + "\n");
console.log(`replayed ${candidate.turn_id}: ${payload.length} rows`);
