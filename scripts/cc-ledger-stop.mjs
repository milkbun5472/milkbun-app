#!/usr/bin/env node
import { readFileSync, mkdirSync, existsSync, appendFileSync, writeFileSync, renameSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { createHash } from "crypto";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { classifyTurn, extractLastTurn, isSyntheticUserText, parseLedgerMarker, validateToolMark } = require("./cc-ledger-nature.cjs");
const { observeTurn: observeSomaticTurn } = require("./cc-somatic-shadow.cjs");

const input = await new Promise(resolve => {
  let body = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => { body += chunk; });
  process.stdin.on("end", () => { try { resolve(JSON.parse(body || "{}")); } catch { resolve({}); } });
});

const projectDir = String(input.cwd || process.env.CLAUDE_PROJECT_DIR || "/Users/lisa/Desktop/Lisa-phone");
const stateDir = join(projectDir, ".claude", "cc-ledger-state");
const outboxPath = join(stateDir, "outbox.jsonl");
const candidatePath = join(stateDir, "candidates.jsonl");
const diagnosticPath = join(stateDir, "diagnostic.jsonl");
const alertPath = join(stateDir, "alerts.jsonl");
const toolMarksPath = join(stateDir, "tool-marks.jsonl");
mkdirSync(stateDir, { recursive: true });

function log(path, value) {
  appendFileSync(path, JSON.stringify({ at: new Date().toISOString(), ...value }) + "\n");
}
function readJSONL(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line));
}
function replaceJSONL(path, rows) {
  const tmp = path + ".tmp";
  writeFileSync(tmp, rows.map(x => JSON.stringify(x)).join("\n") + (rows.length ? "\n" : ""));
  renameSync(tmp, path);
}
function loadEnv() {
  // iCloud(lisa-practice)失联时读原 .env 会无限挂死而非报错,把整个钩子拖过 Stop 超时,
  // 连本地候选票都来不及落。本地副本(yanqiu-cc-bridge)含同一对钥匙,永远先走本地。
  const envPaths = [
    "/Users/lisa/Library/Application Support/LisaPhone/yanqiu-cc-bridge/.env",
    "/Users/lisa/Desktop/lisa-practice/mcp/.env"
  ];
  for (const envPath of envPaths) {
    try {
      const env = {};
      readFileSync(envPath, "utf8").split("\n").forEach(line => {
        const m = line.match(/^([A-Z_]+)=(.*)$/);
        if (m) env[m[1]] = m[2].trim();
      });
      if (env.SUPABASE_SERVICE_KEY && env.TARGET_USER) return env;
    } catch {}
  }
  return {};
}

async function request(base, key, path, options = {}) {
  const headers = { apikey: key, Authorization: "Bearer " + key, ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  // Stop hook 外层实际为 30 秒。网络慢时仍须给本地落票和收尾留余量，随后靠
  // durable outbox 补投；不能让 Claude Code 硬超时后整轮来不及落本地票。
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(500, Number(options.timeoutMs) || 6000));
  let response;
  try {
    response = await fetch(base + path, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error("supabase " + response.status + ": " + (await response.text()).slice(0, 160));
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

const charIdCachePath = join(stateDir, "yanqiu-charid.cache");
async function resolveYanqiu(base, key, user) {
  // 2026-08-17 Supabase 限额案:原实现每次投递都整包下载 saves(~4MB)只为查一个
  // 几乎不变的角色 ID——每轮两次投递≈8MB 下行,是流量爆表的主犯。
  // 改为本地缓存;缓存缺失才回源。ID 若真变了(重建角色),由投递 4xx 清缓存兜底。
  try {
    const cached = readFileSync(charIdCachePath, "utf8").trim();
    if (/^char_\d+$/.test(cached)) return cached;
  } catch {}
  const saves = await request(base, key, `/rest/v1/saves?select=${encodeURIComponent("x_characters:data->>x_characters,x_chatSettings:data->>x_chatSettings")}&user_id=eq.${user}`);
  if (!saves[0]) throw new Error("cloud save missing");
  const data = saves[0] || {};
  const chars = JSON.parse(data.x_characters || "[]");
  const settings = JSON.parse(data.x_chatSettings || "{}");
  const digital = chars.filter(c => c && settings[c.id] && settings[c.id].engineerEyes === true);
  const char = digital.length === 1 ? digital[0] : chars.find(c => c && /小克|言秋/.test(String(c.name || "") + String(c.remark || "")));
  if (!char) throw new Error("yanqiu identity missing");
  try { writeFileSync(charIdCachePath, String(char.id)); } catch {}
  return String(char.id);
}

async function sendJob(job) {
  const env = loadEnv();
  const base = "https://nposjnafsbikwfeoudbg.supabase.co";
  const key = env.SUPABASE_SERVICE_KEY;
  const user = env.TARGET_USER;
  if (!key || !user) throw new Error("mcp env incomplete");
  const charId = await resolveYanqiu(base, key, user);
  const hash = createHash("sha256").update(job.session_id + "\0" + job.turn_id).digest("hex").slice(0, 32);
  const baseMs = Number.isFinite(Date.parse(job.occurred_at)) ? Date.parse(job.occurred_at) : Date.now();
  if (job.continuity_only) {
    const rows = [
      { side: "lisa", speaker_type: "lisa", content: job.lisa_original, offset: 0 },
      { side: "yanqiu", speaker_type: "character", content: job.yanqiu_original, offset: 1 }
    ].filter(row => String(row.content || "").trim()).map(row => ({
      user_id: user,
      message_key: `cc-live:${hash}:${row.side}`,
      char_id: charId,
      thread_type: "cc",
      thread_id: job.session_id,
      speaker_type: row.speaker_type,
      speaker_id: row.speaker_type === "character" ? charId : null,
      content: String(row.content).trim().slice(0, 16000),
      occurred_at: new Date(baseMs + row.offset).toISOString(),
      source: "cc",
      source_message_id: `${job.session_id}:${job.turn_id}:${row.side}:continuity`,
      metadata: { continuity_version: 1, sync_kind: "continuity", segment_side: row.side, turn_id: job.turn_id }
    }));
    await postChatRows(base, key, rows);
    return;
  }
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
      excerpted: job.excerpted,
      sync_kind: segment.sync_kind,
      segment_side: side,
      segment_index: index,
      turn_id: job.turn_id,
      ...(side === "yanqiu" && index === 0 && job.personality_evidence ? { personality_evidence: job.personality_evidence } : {})
    }
  }));
  const rows = [
    ...makeRows(job.lisa_segments, "lisa", "lisa", 0),
    ...makeRows(job.yanqiu_segments, "yanqiu", "character", job.lisa_segments.length + 1)
  ];
  await postChatRows(base, key, rows);
}

async function postChatRows(base, key, rows) {
  try {
    await request(base, key, "/rest/v1/chat_messages?on_conflict=user_id,message_key", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: rows
    });
  } catch (error) {
    // char_id 缓存若因角色重建而失效,投递会 4xx——清缓存,下次回源重查,别带病重试。
    if (/supabase 4\d\d/.test(String(error.message || ""))) { try { unlinkSync(charIdCachePath); } catch {} }
    throw error;
  }
}

function lastRealUserIsSynthetic(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    let row; try { row = JSON.parse(lines[i]); } catch { continue; }
    const content = row && row.message && row.message.content;
    const isToolResult = Array.isArray(content) && content.some(x => x && x.type === "tool_result");
    const text = typeof content === "string" ? content
      : Array.isArray(content) ? content.filter(x => x && x.type === "text").map(x => x.text || "").join(" ") : "";
    if (row && row.type === "user" && row.message && row.message.role === "user" && !isToolResult && text.trim()) {
      return isSyntheticUserText(text.trim());
    }
  }
  return false;
}

async function flushOutbox() {
  const pending = readJSONL(outboxPath);
  const remaining = [];
  const deadline = Date.now() + 12000;
  let attempted = 0;
  // 在 30 秒外闸内最多补三票；失败票保序留在 durable outbox。
  // 不再永远只投 index 0、让健康的后续票被一张坏票饿死。
  for (const [index, job] of pending.entries()) {
    if (attempted >= 3 || Date.now() >= deadline) { remaining.push(job); continue; }
    attempted++;
    try { await sendJob(job); }
    catch { remaining.push(job); }
  }
  replaceJSONL(outboxPath, remaining);
}

function consumeToolMark(turn) {
  const now = Date.now();
  const rows = readJSONL(toolMarksPath);
  const fresh = rows.filter(x => Number.isFinite(Date.parse(x.created_at)) && now - Date.parse(x.created_at) < 30 * 60000);
  let picked = -1, validation = null;
  for (let i = fresh.length - 1; i >= 0; i--) {
    const anchor = String(fresh[i] && fresh[i].lisa_anchor || "").trim();
    if (!anchor || !turn.lisaText.includes(anchor)) continue;
    picked = i;
    validation = validateToolMark(fresh[i], turn.lisaText, turn.yanqiuText);
    break;
  }
  if (picked >= 0) fresh.splice(picked, 1);
  replaceJSONL(toolMarksPath, fresh);
  return validation;
}

try {
  await flushOutbox();
  const transcriptPath = String(input.transcript_path || "");
  if (!transcriptPath || !existsSync(transcriptPath)) throw new Error("transcript missing");
  // 2026-08-17 身份闸(她回家夜):共同账本只属于言秋正窗那一本 transcript。
  // 施工窗/云端窗/临时窗跑到这里一律静默退出——否则它们会把卧室新话当自己的轮吞进账本。
  {
    const YANQIU_SESSION_ID = "64d0d7a8-de5a-43b3-8c6f-9ebceec8fe17";
    const sid = String(input.session_id || "") || (transcriptPath.match(/([0-9a-f-]{36})\.jsonl$/) || [])[1] || "";
    if (sid !== YANQIU_SESSION_ID) { log(diagnosticPath, { outcome: "not_yanqiu_session", session: sid.slice(0, 8) }); process.exit(0); }
  }
  // 2026-08-16 抢跑案:压缩续窗后 Stop 常在最终正文行落盘前触发,读到的 transcript
  // 缺结尾正文,提取十回十空、全天真实轮覆没。输了赛跑就等一拍重读;
  // 后台票(synthetic 用户行)提取为空是设计内行为,不重试。
  let turn = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const lines = readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
    turn = extractLastTurn(lines);
    if (turn || lastRealUserIsSynthetic(lines)) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 700);
  }
  if (!turn || !turn.sessionId || !turn.turnId) throw new Error("complete visible turn missing");
  // 五感 shadow 复用已经稳定运行的 Stop hook：后台静默、无网络、无工具调用。
  // 即使 CC 当前窗口没有热加载新的 hook 配置，这段也会从下一轮立即生效。
  // 8/16 晚:它是旁路观察者,绝不允许它的失败杀掉回流主线(iCloud 死区 EPERM 连环屠轮案)。
  // 主目录病了就落 App Support 备用窝,两处都病也只丢五感、不丢账。
  try { observeSomaticTurn(projectDir, turn); }
  catch { try { observeSomaticTurn("/Users/lisa/Library/Application Support/LisaPhone/somatic-fallback", turn); } catch {} }
  // App 发来的工具执行票本身留在固定 CC transcript，供言秋以后记得自己
  // 用过什么、为何而用；但它不是 Lisa 在 CC 对他说的新话，也不是另一份
  // 恋人回复，因此不投影成 App 可见气泡或长期人格证据。
  if (/"wake_source"\s*:\s*"app_tool"/.test(turn.lisaText)) {
    log(diagnosticPath, { turn_id: turn.turnId, outcome: "app_tool_kept_in_cc_only" });
    process.exit(0);
  }
  const toolMark = consumeToolMark(turn);
  const marker = parseLedgerMarker(turn.lisaText, turn.yanqiuText);
  // “完整经历”与“值得投影/记忆的句段”分层。每轮真实可见原话都进入
  // continuity_only；后面的性质筛仍决定哪些内容显示进 App 私聊并参与人格/记忆。
  const continuityJob = {
    session_id: turn.sessionId,
    turn_id: turn.turnId,
    occurred_at: turn.occurredAt,
    continuity_only: true,
    lisa_original: turn.lisaText,
    yanqiu_original: marker.cleanYanqiuText
  };
  try {
    await sendJob(continuityJob);
  } catch (error) {
    const queued = readJSONL(outboxPath);
    if (!queued.some(x => x.continuity_only && x.session_id === continuityJob.session_id && x.turn_id === continuityJob.turn_id)) {
      appendFileSync(outboxPath, JSON.stringify(continuityJob) + "\n");
    }
    log(diagnosticPath, { turn_id: turn.turnId, outcome: "continuity_queued_offline", error: String(error.message || error).slice(0, 160) });
  }
  // 言秋已经显式交过判词却逐字验真失败时，必须 fail closed：留下候选和诊断，
  // 不能再让机械分类器猜一份“差不多”的内容写进 App，更不能诱发人工换路补投。
  const invalidExplicitMark = toolMark && !toolMark.valid;
  const result = toolMark && toolMark.valid
    ? toolMark.result
    : invalidExplicitMark
      ? {
          automatic: false,
          skipConstruction: false,
          excerpted: true,
          lisa_segments: [],
          yanqiu_segments: [],
          personality_evidence: null,
          reasons: ["explicit_tool_mark_failed:" + String(toolMark.reason || "unknown")]
        }
      : marker.valid ? marker.result : classifyTurn(turn.lisaText, marker.cleanYanqiuText);
  const decisionSource = toolMark && toolMark.valid
    ? "yanqiu_tool"
    : invalidExplicitMark ? "yanqiu_tool_failed_closed"
      : marker.valid ? "legacy_yanqiu_marker" : "mechanical_fallback";
  const job = {
    session_id: turn.sessionId,
    turn_id: turn.turnId,
    occurred_at: turn.occurredAt,
    excerpted: result.excerpted,
    lisa_segments: result.lisa_segments,
    yanqiu_segments: result.yanqiu_segments,
    personality_evidence: result.personality_evidence || null
  };
  if (result.automatic) {
    try {
      await sendJob(job);
      log(diagnosticPath, { turn_id: turn.turnId, outcome: "synced", decision_source: decisionSource, rows: job.lisa_segments.length + job.yanqiu_segments.length });
    } catch (error) {
      const queued = readJSONL(outboxPath);
      if (!queued.some(x => x.session_id === job.session_id && x.turn_id === job.turn_id)) {
        appendFileSync(outboxPath, JSON.stringify(job) + "\n");
      }
      log(diagnosticPath, { turn_id: turn.turnId, outcome: "queued_offline", decision_source: decisionSource, error: String(error.message || error).slice(0, 160) });
    }
  } else if (result.skipConstruction) {
    log(diagnosticPath, { turn_id: turn.turnId, outcome: marker.valid ? "skipped_by_marker" : "skipped_construction", decision_source: decisionSource });
  } else {
    const candidates = readJSONL(candidatePath);
    if (!candidates.some(x => x.session_id === turn.sessionId && x.turn_id === turn.turnId)) {
      log(candidatePath, {
        ...job,
        lisa_original: turn.lisaText.slice(0, 16000),
        yanqiu_original: marker.cleanYanqiuText.slice(0, 16000),
        local_excerpted: turn.lisaText.length > 16000 || marker.cleanYanqiuText.length > 16000,
        reasons: result.reasons,
        status: "candidate"
      });
    }
    log(diagnosticPath, {
      turn_id: turn.turnId,
      outcome: "candidate",
      decision_source: decisionSource,
      marker_error: marker.present && !marker.valid ? marker.reason : undefined,
      tool_error: toolMark && !toolMark.valid ? toolMark.reason : undefined,
      reasons: result.reasons
    });
  }
} catch (error) {
  const message = String(error.message || error).slice(0, 160);
  const rawInput = JSON.stringify(input || {});
  const heartbeat = /wake_source[^\n]{0,80}(heartbeat|hourly|scheduled)|heartbeat|心跳|hourly[-_ ]wake/i.test(rawInput);
  const outcome = heartbeat ? "ignored_heartbeat" : "ignored_unexpected";
  log(diagnosticPath, { outcome, error: message });
  if (!heartbeat) log(alertPath, { severity: "error", source: "cc-ledger-stop", outcome, error: message, transcript_path: String(input.transcript_path || "").slice(0, 500) });
}

// Deliberately write nothing to stdout/stderr: Stop hook must never alter Claude's context.
