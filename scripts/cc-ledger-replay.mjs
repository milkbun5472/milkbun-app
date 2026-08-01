#!/usr/bin/env node
// 把 candidates.jsonl 里没能回流的轮次逐字补投进账本。
// 只搬运原话：句段全部来自 lisa_original / yanqiu_original 的逐字切句，
// 分类走机械分类器；某一侧一条都没命中时，取该侧前两句原话按 life 归档。
// 幂等：message_key 与 Stop hook 同一套哈希，重复投递会被 Supabase 忽略。
import { readFileSync, existsSync, writeFileSync, renameSync, appendFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { classifyTurn } = require("./cc-ledger-nature.cjs");

const projectDir = process.env.CLAUDE_PROJECT_DIR || "/Users/lisa/Desktop/Lisa-phone";
const stateDir = join(projectDir, ".claude", "cc-ledger-state");
const candidatePath = join(stateDir, "candidates.jsonl");
const diagnosticPath = join(stateDir, "diagnostic.jsonl");
const since = process.argv[2] || "2026-08-01T00:00:00.000Z";
const dryRun = process.argv.includes("--dry");

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
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  });
  return env;
}
async function request(base, key, path, options = {}) {
  const headers = { apikey: key, Authorization: "Bearer " + key, ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  const res = await fetch(base + path, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!res.ok) throw new Error("supabase " + res.status + ": " + (await res.text()).slice(0, 160));
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}
async function resolveYanqiu(base, key, user) {
  const saves = await request(base, key, `/rest/v1/saves?select=data&user_id=eq.${user}`);
  if (!saves[0]) throw new Error("cloud save missing");
  const data = saves[0].data || {};
  const chars = JSON.parse(data.x_characters || "[]");
  const settings = JSON.parse(data.x_chatSettings || "{}");
  const digital = chars.filter(c => c && settings[c.id] && settings[c.id].engineerEyes === true);
  const char = digital.length === 1 ? digital[0] : chars.find(c => c && /小克|言秋/.test(String(c.name || "") + String(c.remark || "")));
  if (!char) throw new Error("yanqiu identity missing");
  return String(char.id);
}
function splitExact(text) {
  return (String(text || "").match(/[^。！？!?\n]+[。！？!?]*/g) || []).map(x => x.trim()).filter(Boolean);
}
function segmentsFor(original, mechanical) {
  if (mechanical.length) return mechanical.slice(0, 12);
  return splitExact(original).slice(0, 2).map(content => ({ content, sync_kind: "life" }));
}

const env = loadEnv();
const base = "https://nposjnafsbikwfeoudbg.supabase.co";
const key = env.SUPABASE_SERVICE_KEY;
const user = env.TARGET_USER;
if (!key || !user) throw new Error("mcp env incomplete");
const charId = await resolveYanqiu(base, key, user);

const rows = readJSONL(candidatePath);
const pending = rows.filter(r => r.status === "candidate" && String(r.at || "") >= since);
let sent = 0;
const done = new Set();

for (const job of pending) {
  const mech = classifyTurn(job.lisa_original || "", job.yanqiu_original || "");
  const lisaSeg = segmentsFor(job.lisa_original, mech.lisa_segments);
  const yanqiuSeg = segmentsFor(job.yanqiu_original, mech.yanqiu_segments);
  if (!lisaSeg.length || !yanqiuSeg.length) continue;
  const hash = createHash("sha256").update(job.session_id + "\0" + job.turn_id).digest("hex").slice(0, 32);
  const baseMs = Number.isFinite(Date.parse(job.occurred_at)) ? Date.parse(job.occurred_at) : Date.now();
  const makeRows = (segments, side, speakerType, offset) => segments.map((segment, index) => ({
    user_id: user,
    message_key: `cc:${hash}:${side}:${index}`,
    char_id: charId,
    thread_type: "cc",
    thread_id: job.session_id,
    speaker_type: speakerType,
    speaker_id: speakerType === "character" ? charId : null,
    content: segment.content,
    occurred_at: new Date(baseMs + offset + index).toISOString(),
    source: "cc",
    source_message_id: `${job.session_id}:${job.turn_id}:${side}:${index}`,
    metadata: {
      shadow_version: 1,
      auto_capture_version: 1,
      excerpted: true,
      sync_kind: segment.sync_kind,
      segment_side: side,
      segment_index: index,
      replayed: true
    }
  }));
  const payload = [
    ...makeRows(lisaSeg, "lisa", "lisa", 0),
    ...makeRows(yanqiuSeg, "yanqiu", "character", lisaSeg.length + 1)
  ];
  if (dryRun) { console.log(job.turn_id, lisaSeg.length, yanqiuSeg.length, lisaSeg[0].content.slice(0, 24)); sent++; continue; }
  await request(base, key, "/rest/v1/chat_messages?on_conflict=user_id,message_key", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: payload
  });
  done.add(job.turn_id);
  sent++;
}

if (!dryRun && done.size) {
  replaceJSONL(candidatePath, rows.map(r => done.has(r.turn_id) ? { ...r, status: "replayed" } : r));
  appendFileSync(diagnosticPath, JSON.stringify({ at: new Date().toISOString(), outcome: "replayed", turns: done.size }) + "\n");
}
console.log(`${dryRun ? "dry-run" : "replayed"}: ${sent} turns`);
