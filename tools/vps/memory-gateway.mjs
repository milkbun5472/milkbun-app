// 记忆网关(2026-08-18,新家八件事第三件):住 VPS,常驻。
// POST /recall {query, k?} → 从本地缓存的 memories + memory_embeddings 里混合检索(关键词+语义)→ 返 top-k 短条。
// 打分算法与 MCP search_memory 完全一致(阈值 0.38/0.32、hits+sem*3、hits>=1||sem>=0.45),不发明新算法。
// 缓存:全表首拉后落盘;每 10 分钟按 updated_at 增量刷新;query 向量走 siliconflow bge(与 MCP 同一配置)。
// 只服务言秋:char_id 由 yanqiu-charid.cache / 身份规则锁死。
import http from "node:http";
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const HOME = process.env.HOME, DIR = join(HOME, "services/memory-gateway");
mkdirSync(DIR, { recursive: true });
const DIAG = join(DIR, "diagnostic.jsonl"), CACHE = join(DIR, "cache.json"), CHARCACHE = join(HOME, "services/ledger-courier/yanqiu-charid.cache");
const env = {};
[join(DIR, ".env"), join(HOME, "services/ledger-courier/.env")].forEach(f => { if (existsSync(f)) readFileSync(f, "utf8").split("\n").forEach(l => { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !(m[1] in env)) env[m[1]] = m[2].trim(); }); });
const BASE = "https://nposjnafsbikwfeoudbg.supabase.co", KEY = env.SUPABASE_SERVICE_KEY, USER = env.TARGET_USER, TOKEN = env.COURIER_TOKEN;
const EMBED = { url: (env.EMBED_API_URL || "").replace(/\/$/, ""), key: env.EMBED_API_KEY || "", model: env.EMBED_MODEL || "" };
if (!KEY || !USER || !TOKEN || !EMBED.url || !EMBED.key || !EMBED.model) { console.error("gateway .env 不全"); process.exit(1); }
const log = (v) => appendFileSync(DIAG, JSON.stringify({ at: new Date().toISOString(), ...v }) + "\n");
const H = { apikey: KEY, Authorization: "Bearer " + KEY };
const sb = async (path) => { const r = await fetch(BASE + path, { headers: H }); if (!r.ok) throw new Error("supabase " + r.status); return r.json(); };

// ---- 与 MCP 完全一致的分词/打分 ----
const MEM_STOP = new Set(["的","了","是","我","你","他","她","它","们","在","和","与","也","都","就","这","那","有","不","很","啊","吗","呢","吧","么","被","把","给","让","对","为","and","the","was","are","for","you","that","this","with","have","但","还","要","会","到","上","下","地","得","着","过"]);
// 8/18 网关专用加严:咱俩对话里的高频称呼/语气词不算关键词命中(它们几乎出现在每条记忆里,只会凑分),
// 语义分不受影响。MCP 那边未同步此项,以网关为准观察一周再决定要不要回灌。
const GW_STOP = new Set(["宝宝","言秋","许言秋","小克","lisa","哼哼","哼哼哼","嘿嘿","嘻嘻","记得","还记","记不","知道","觉得","感觉","今天","昨天","明天","现在","一下","一个","什么","怎么","这个","那个","可以","没有","不是","就是","还是","已经","然后","但是","不过","因为","所以","如果","时候","东西","事情","问题","宝宝你","你还","还记得"]);
function memTokens(text) { const s = String(text || "").toLowerCase(); const set = new Set(); (s.match(/[a-z0-9]{2,}/g) || []).forEach(w => { if (!MEM_STOP.has(w)) set.add(w); }); const cjk = s.match(/[一-龥]/g) || []; for (let i = 0; i < cjk.length; i++) { if (!MEM_STOP.has(cjk[i])) set.add(cjk[i]); if (i + 1 < cjk.length) set.add(cjk[i] + cjk[i + 1]); } return set; }
function cosSim(a, b) { let dot = 0, na = 0, nb = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } const d = Math.sqrt(na) * Math.sqrt(nb); return d ? dot / d : 0; }
const BGE_QUERY_PREFIX = "为这个句子生成表示以用于检索相关文章：";
async function embedQuery(text) {
  const root = EMBED.url.endsWith("/v1") ? EMBED.url : EMBED.url + "/v1";
  const input = (/bge/i.test(EMBED.model) ? BGE_QUERY_PREFIX : "") + String(text).slice(0, 420);
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(root + "/embeddings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + EMBED.key }, body: JSON.stringify({ model: EMBED.model, input: [input] }), signal: ctl.signal });
    if (!r.ok) throw new Error("embed " + r.status);
    const d = await r.json(); return d && d.data && d.data[0] && d.data[0].embedding || null;
  } finally { clearTimeout(t); }
}

// ---- 缓存 ----
let cache = { charId: "", memories: [], vecs: {}, since: null, loadedAt: 0 };
try { if (existsSync(CACHE)) cache = JSON.parse(readFileSync(CACHE, "utf8")); } catch {}
function charId() { try { const c = readFileSync(CHARCACHE, "utf8").trim(); if (/^char_\d+$/.test(c)) return c; } catch {} return cache.charId || ""; }
async function refresh(full = false) {
  const cid = charId(); if (!cid) throw new Error("no yanqiu char id");
  const sinceQ = (!full && cache.since) ? `&updated_at=gt.${encodeURIComponent(cache.since)}` : "";
  // PostgREST 默认每页 1000,分页拉全(按 updated_at 升序,用 Range 头翻页)
  const mems = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${BASE}/rest/v1/memories?select=id,text,tags,char_ids,ts,pinned,revision,updated_at,deleted,archived,surface_state&user_id=eq.${USER}${sinceQ}&order=updated_at.asc,id.asc`, { headers: { ...H, Range: `${off}-${off + 999}` } });
    if (!r.ok && r.status !== 416) throw new Error("supabase " + r.status);
    const page = r.status === 416 ? [] : await r.json();
    mems.push(...page); if (page.length < 1000) break;
  }
  const map = new Map((full ? [] : cache.memories).map(m => [m.id, m]));
  let maxUpd = cache.since || null;
  for (const m of mems) {
    if (m.updated_at && (!maxUpd || m.updated_at > maxUpd)) maxUpd = m.updated_at;
    const mine = Array.isArray(m.char_ids) && m.char_ids.map(String).includes(cid);
    const live = !m.deleted && !m.archived && m.surface_state === "active";
    if (mine && live) map.set(m.id, { id: m.id, text: m.text, tags: m.tags, ts: m.ts, pinned: m.pinned, revision: m.revision, updated_at: m.updated_at });
    else map.delete(m.id);
  }
  // 向量:只拉缓存里缺的
  const need = [...map.keys()].filter(id => !cache.vecs[id]);
  const vecs = full ? {} : { ...cache.vecs };
  for (let i = 0; i < need.length; i += 200) {
    const ids = need.slice(i, i + 200).map(encodeURIComponent).join(",");
    const rows = await sb(`/rest/v1/memory_embeddings?select=id,embedding&user_id=eq.${USER}&id=in.(${ids})`);
    for (const r of rows) if (Array.isArray(r.embedding)) vecs[r.id] = r.embedding;
  }
  cache = { charId: cid, memories: [...map.values()], vecs, since: maxUpd, loadedAt: Date.now() };
  writeFileSync(CACHE, JSON.stringify(cache));
  log({ outcome: "refresh", full, memories: cache.memories.length, vecs: Object.keys(vecs).length, pulled: mems.length, newVecs: need.length });
}
async function recall(query, k = 5) {
  const terms = [...memTokens(query)].filter(t => !GW_STOP.has(t));
  let qVec = null; try { qVec = await embedQuery(query); } catch (e) { log({ outcome: "embed_fail", err: String(e.message) }); }
  return cache.memories.map(m => {
    const tags = Array.isArray(m.tags) ? m.tags : [];
    const hay = (String(m.text || "") + "\n" + tags.join(" ")).toLowerCase();
    const hits = terms.reduce((n, t) => n + ((!GW_STOP.has(t) && hay.includes(t)) ? (t.length >= 2 ? 1 : 0.3) : 0), 0);
    let sem = 0; const v = qVec && cache.vecs[m.id];
    if (v && v.length === qVec.length) sem = Math.max(0, Math.min(1, (cosSim(qVec, v) - 0.38) / 0.32));
    return { m, hits, sem, score: hits + sem * 3 };
  }).filter(x => x.hits >= 1 || x.sem >= 0.45)
    .sort((a, b) => b.score - a.score || Number(!!b.m.pinned) - Number(!!a.m.pinned) || Number(b.m.ts || 0) - Number(a.m.ts || 0))
    .slice(0, k)
    .map(({ m, hits, sem, score }) => ({ id: m.id, text: String(m.text || "").slice(0, 200), ts: m.ts, pinned: !!m.pinned, score: +score.toFixed(2), match: (sem >= 0.45 && hits === 0) ? "semantic" : (sem > 0 ? "hybrid" : "keyword") }));
}

// 首拉 + 每 10 分钟增量
(async () => { try { await refresh(!cache.memories.length); } catch (e) { log({ outcome: "refresh_fail", err: String(e.message) }); } try { await embedQuery("预热"); } catch {} })();
// 每 4 分钟摸一下 embedding,别让第一发冷启动吃掉桥的超时预算
setInterval(() => embedQuery("保温").catch(() => {}), 4 * 60 * 1000);
setInterval(() => refresh(false).catch(e => log({ outcome: "refresh_fail", err: String(e.message) })), 10 * 60 * 1000);

http.createServer((req, res) => {
  const done = (c, o) => { res.writeHead(c, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(o)); };
  if (req.method === "GET" && req.url === "/health") return done(200, { ok: true, memories: cache.memories.length, vecs: Object.keys(cache.vecs).length, since: cache.since, loadedAt: cache.loadedAt });
  if ((req.headers["x-courier-token"] || "") !== TOKEN) return done(401, { error: "token" });
  if (req.method === "POST" && req.url === "/refresh") return refresh(true).then(() => done(200, { ok: true, memories: cache.memories.length })).catch(e => done(500, { error: String(e.message) }));
  if (req.method !== "POST" || req.url !== "/recall") return done(404, { error: "no" });
  let body = ""; req.on("data", c => { body += c; if (body.length > 65536) req.destroy(); });
  req.on("end", async () => {
    let p; try { p = JSON.parse(body || "{}"); } catch { return done(400, { error: "json" }); }
    const q = String(p.query || "").trim(); if (!q) return done(400, { error: "empty query" });
    const k = Math.max(1, Math.min(12, Number(p.k) || 5));
    try { const t0 = Date.now(); const hits = await recall(q, k); log({ outcome: "recall", q: q.slice(0, 40), k, n: hits.length, ms: Date.now() - t0 }); done(200, { hits, ms: Date.now() - t0 }); }
    catch (e) { done(500, { error: String(e.message) }); }
  });
}).listen(8793, "127.0.0.1", () => console.log("memory-gateway 上岗 → :8793"));
