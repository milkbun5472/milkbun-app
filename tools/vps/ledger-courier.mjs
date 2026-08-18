// 账本投递员(2026-08-18,第零件):住在 VPS,常驻。
// Mac 上的 Stop hook 只落票(outbox.jsonl);Mac 轻推手把票 POST 到这里;
// 这里负责真正写 Supabase、失败留队列重试、留诊断。倒了 systemd 扶。
// 幂等靠 message_key(cc:hash:side:idx / cc-live:hash:side),重投无害。
import http from "node:http";
import { readFileSync, existsSync, appendFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const HOME = process.env.HOME;
const DIR = join(HOME, "services/ledger-courier");
const QUEUE = join(DIR, "queue.jsonl");        // 待投
const DIAG = join(DIR, "diagnostic.jsonl");    // 诊断
const CACHE = join(DIR, "yanqiu-charid.cache");
const ENV = join(DIR, ".env");                 // SUPABASE_SERVICE_KEY / TARGET_USER / COURIER_TOKEN
const PORT = 8791;
mkdirSync(DIR, { recursive: true });

const env = {};
if (existsSync(ENV)) readFileSync(ENV, "utf8").split("\n").forEach(l => { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); });
const BASE = "https://nposjnafsbikwfeoudbg.supabase.co", KEY = env.SUPABASE_SERVICE_KEY, USER = env.TARGET_USER, TOKEN = env.COURIER_TOKEN;
if (!KEY || !USER || !TOKEN) { console.error("courier .env 不全"); process.exit(1); }

const log = (v) => appendFileSync(DIAG, JSON.stringify({ at: new Date().toISOString(), ...v }) + "\n");
const readQ = () => existsSync(QUEUE) ? readFileSync(QUEUE, "utf8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
const writeQ = (rows) => { writeFileSync(QUEUE + ".tmp", rows.map(r => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "")); renameSync(QUEUE + ".tmp", QUEUE); };

async function request(path, options = {}) {
  const headers = { apikey: KEY, Authorization: "Bearer " + KEY, ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  let r; try { r = await fetch(BASE + path, { method: options.method || "GET", headers, body: options.body ? JSON.stringify(options.body) : undefined, signal: ctl.signal }); } finally { clearTimeout(t); }
  if (!r.ok) throw new Error("supabase " + r.status + ": " + (await r.text()).slice(0, 160));
  const text = await r.text(); return text ? JSON.parse(text) : [];
}
async function resolveYanqiu() {
  try { const c = readFileSync(CACHE, "utf8").trim(); if (/^char_\d+$/.test(c)) return c; } catch {}
  const sel = encodeURIComponent("x_characters:data->>x_characters,x_chatSettings:data->>x_chatSettings");
  const saves = await request(`/rest/v1/saves?select=${sel}&user_id=eq.${USER}`);
  if (!saves[0]) throw new Error("cloud save missing");
  const chars = JSON.parse(saves[0].x_characters || "[]"), settings = JSON.parse(saves[0].x_chatSettings || "{}");
  const digital = chars.filter(c => c && settings[c.id] && settings[c.id].engineerEyes === true);
  const char = digital.length === 1 ? digital[0] : chars.find(c => c && /小克|言秋/.test(String(c.name || "") + String(c.remark || "")));
  if (!char) throw new Error("yanqiu identity missing");
  try { writeFileSync(CACHE, String(char.id)); } catch {}
  return String(char.id);
}
async function postRows(rows) {
  try {
    await request("/rest/v1/chat_messages?on_conflict=user_id,message_key", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: rows });
  } catch (e) { if (/supabase 4\d\d/.test(String(e.message))) { try { writeFileSync(CACHE, ""); } catch {} } throw e; }
}
async function sendJob(job) {
  const charId = await resolveYanqiu();
  const hash = createHash("sha256").update(job.session_id + "\0" + job.turn_id).digest("hex").slice(0, 32);
  const baseMs = Number.isFinite(Date.parse(job.occurred_at)) ? Date.parse(job.occurred_at) : Date.now();
  let rows;
  if (job.continuity_only) {
    rows = [
      { side: "lisa", speaker_type: "lisa", content: job.lisa_original, offset: 0 },
      { side: "yanqiu", speaker_type: "character", content: job.yanqiu_original, offset: 1 }
    ].filter(r => String(r.content || "").trim()).map(r => ({
      user_id: USER, message_key: `cc-live:${hash}:${r.side}`, char_id: charId, thread_type: "cc", thread_id: job.session_id,
      speaker_type: r.speaker_type, speaker_id: r.speaker_type === "character" ? charId : null,
      content: String(r.content).trim().slice(0, 16000), occurred_at: new Date(baseMs + r.offset).toISOString(), source: "cc",
      source_message_id: `${job.session_id}:${job.turn_id}:${r.side}:continuity`,
      metadata: { continuity_version: 1, sync_kind: "continuity", segment_side: r.side, turn_id: job.turn_id }
    }));
  } else {
    const mk = (segs, side, st, off) => (segs || []).map((s, i) => ({
      user_id: USER, message_key: `cc:${hash}:${side}:${i}`, char_id: charId, thread_type: "cc", thread_id: job.session_id,
      speaker_type: st, speaker_id: st === "character" ? charId : null, content: s.content,
      occurred_at: new Date(baseMs + off + i).toISOString(), source: "cc",
      source_message_id: `${job.session_id}:${job.turn_id}:${side}:${i}`,
      metadata: { shadow_version: 1, auto_capture_version: 1, excerpted: job.excerpted, sync_kind: s.sync_kind, segment_side: side, segment_index: i, turn_id: job.turn_id,
        ...(side === "yanqiu" && i === 0 && job.personality_evidence ? { personality_evidence: job.personality_evidence } : {}) }
    }));
    rows = [...mk(job.lisa_segments, "lisa", "lisa", 0), ...mk(job.yanqiu_segments, "yanqiu", "character", (job.lisa_segments || []).length + 1)];
  }
  if (!rows.length) return 0;
  await postRows(rows); return rows.length;
}

// 队列泵:每 5 秒清一次,单票失败保序留队,最多连试 3 票就歇
let pumping = false;
async function pump() {
  if (pumping) return; pumping = true;
  try {
    let q = readQ(); if (!q.length) return;
    const remain = []; let n = 0;
    for (const job of q) {
      if (n >= 3) { remain.push(job); continue; }
      n++;
      try { const rows = await sendJob(job); log({ outcome: "delivered", turn_id: job.turn_id, rows, kind: job.continuity_only ? "continuity" : "ledger" }); }
      catch (e) { job._tries = (job._tries || 0) + 1; log({ outcome: "retry_later", turn_id: job.turn_id, tries: job._tries, error: String(e.message).slice(0, 140) }); remain.push(job); }
    }
    writeQ(remain);
  } finally { pumping = false; }
}
setInterval(() => pump().catch(e => log({ outcome: "pump_error", error: String(e.message).slice(0, 140) })), 5000);

// 收件口:Mac 轻推手 POST /ingest,body 是 JSONL(每行一张票),幂等入队
http.createServer((req, res) => {
  const done = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (req.method === "GET" && req.url === "/health") return done(200, { ok: true, queued: readQ().length });
  if (req.method !== "POST" || req.url !== "/ingest") return done(404, { error: "no" });
  if ((req.headers["x-courier-token"] || "") !== TOKEN) return done(401, { error: "token" });
  let body = ""; req.on("data", c => { body += c; if (body.length > 8e6) req.destroy(); });
  req.on("end", () => {
    const incoming = body.split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(j => j && j.session_id && j.turn_id);
    const q = readQ(); const seen = new Set(q.map(j => j.session_id + "|" + j.turn_id + "|" + (j.continuity_only ? "c" : "l")));
    let added = 0;
    for (const j of incoming) { const k = j.session_id + "|" + j.turn_id + "|" + (j.continuity_only ? "c" : "l"); if (!seen.has(k)) { q.push(j); seen.add(k); added++; } }
    writeQ(q); log({ outcome: "ingested", received: incoming.length, added });
    done(200, { ok: true, received: incoming.length, added, queued: q.length });
    pump().catch(() => {});
  });
}).listen(PORT, "127.0.0.1", () => console.log("ledger-courier 上岗 → :" + PORT));
