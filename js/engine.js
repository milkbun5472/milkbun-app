// ============================================================
// API
// ============================================================
function detectFormat(u) {
  // ⚠️线路方言只认 baseUrl，绝不按 model/proxyRef 猜（2026-08-12 全天 Load failed 血案）：
  // 「小克订阅」桥是本机 8787 的 OpenAI 方言服务(只收 /v1/chat/completions)，
  // 按模型名里有 fable 就改发 anthropic 方言 /v1/messages → 404 且无 CORS 头 →
  // 手机浏览器预检直接 Load failed。桥哪天真学会 anthropic 方言，再显式改它的 baseUrl 标识。
  const p = u && typeof u === "object" ? u : null;
  u = String((p ? p.baseUrl : u) || "").toLowerCase();
  if (u.includes("anthropic")) return "anthropic";
  if (u.includes("generativelanguage") || u.includes("googleapis")) return "gemini";
  return "openai";
}
async function fetchModelList(p) {
  const base = (p.baseUrl || "").replace(/\/$/, "");
  const fmt = detectFormat(p);
  if (fmt === "gemini") {
    const r = await fetch(base + "/v1beta/models", {
      headers: {
        "x-goog-api-key": p.apiKey
      }
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return (d.models || []).map(m => (m.name || "").replace("models/", "")).filter(Boolean);
  }
  if (fmt === "anthropic") {
    const r = await fetch(base + "/v1/models", {
      headers: {
        "x-api-key": p.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      }
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    return (d.data || []).map(m => m.id);
  }
  const root = base.endsWith("/v1") ? base : base + "/v1";
  const r = await fetch(root + "/models", {
    headers: {
      Authorization: "Bearer " + p.apiKey
    }
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return (d.data || []).map(m => m.id).sort();
}
// 检测这个 API 支不支持 embedding（向量记忆的前提）：真调一次 /embeddings，返回 { ok, dim, model, msg }
// 只走 openai 兼容格式（中转站基本都是这个）；anthropic 原生没 embedding、gemini 端点不同——都提示换法
async function testEmbedding(p) {
  const base = (p.baseUrl || "").replace(/\/$/, "");
  const fmt = detectFormat(base);
  if (fmt === "anthropic") return { ok: false, msg: "Anthropic 原生不提供 embedding。若你用的是中转站，把地址换成它的 OpenAI 兼容端点(通常 .../v1)再测。" };
  if (fmt === "gemini") return { ok: false, msg: "Gemini 的 embedding 端点是 :embedContent，和这里不同。多数中转站有 OpenAI 兼容的 /v1/embeddings，把地址换成那个再测。" };
  const root = base.endsWith("/v1") ? base : base + "/v1";
  // 手填的排最前（优先试你指定的）；后面是各家常见 embedding 模型名，尽量多撞几个
  const candidates = [p.embedModel, "text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002", "bge-m3", "text-embedding-v3", "text-embedding-v2", "embedding-2", "doubao-embedding"].filter(Boolean);
  const tried = [];   // 逐个记下失败原因，别只留最后一个（否则会误以为只是那一个模型的问题）
  for (const model of candidates) {
    let why = "";
    try {
      const r = await fetchT(root + "/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + p.apiKey },
        body: JSON.stringify({ model: model, input: "测试向量" })
      }, 20000);
      const raw = await r.text();
      let d; try { d = JSON.parse(raw); } catch (e) { why = "返回非 JSON：" + raw.slice(0, 60); tried.push(model + " → " + why); continue; }
      if (d && d.error) { why = (d.error.message || JSON.stringify(d.error)).slice(0, 100); tried.push(model + " → " + why); continue; }
      const vec = d && d.data && d.data[0] && d.data[0].embedding;
      if (Array.isArray(vec) && vec.length) return { ok: true, dim: vec.length, model: model };
      why = "返回里没找到向量：" + raw.slice(0, 60); tried.push(model + " → " + why);
    } catch (e) { why = e.message || String(e); tried.push(model + " → " + why); }
  }
  return { ok: false, msg: "试了这些 embedding 模型都没通（多半是这家中转站压根没开 embedding 渠道）：\n" + tried.join("\n") + "\n\n办法：①去中转站后台看它到底有没有 embedding 模型、把确切的模型名手填进下面的框再测；②换一家有 OpenAI 兼容 /v1/embeddings 的 key（如支持 text-embedding-3-small 的）。测不通也没关系——向量记忆只是锦上添花，现在的关键词记忆照常工作。" };
}
// 独立 embedding API 配置（和聊天模型分开：聊天用 gemini 中转、embedding 可另填一家支持 /v1/embeddings 的 key）
// 存 x_embedApi{baseUrl,apiKey,model,enabled}。没开/没填时向量功能就不启用，零影响。
function loadEmbApi() {
  try { const c = JSON.parse(localStorage.getItem("x_embedApi") || "null"); if (c && typeof c === "object") return Object.assign({ baseUrl: "", apiKey: "", model: "text-embedding-3-small", enabled: false }, c); } catch (e) {}
  return { baseUrl: "", apiKey: "", model: "text-embedding-3-small", enabled: false };
}
function saveEmbApi(c) { try { localStorage.setItem("x_embedApi", JSON.stringify(c || {})); } catch (e) {} return c; }
function embApiReady() { const c = loadEmbApi(); return !!(c.enabled && c.baseUrl && c.apiKey); }
// ============================================================
// 向量记忆（v48.11）：给记忆库条目配 embedding，检索时语义相似度+关键词混合打分——
// 「上次吃的那顿」也能召回「火锅之约」。设计要点：
// · 向量（1024 维浮点）只进 IndexedDB(x_memvec)，绝不进 localStorage/云存档（几百条就是 MB 级）；
//   换设备导入存档后检测到缺向量会自动静默重嵌（embedding 便宜/免费，重建零成本）。
// · 检索函数 retrieveMemories 保持【同步】签名不动（ctxFor 等几十处调用零改动）：
//   发消息前先 primeQueryVec() 把查询向量预热进内存缓存，检索时同步取用；
//   没预热/没开开关/API 挂了 → 缓存未命中 → 自动回落纯关键词打分，行为与旧版完全一致，零影响。
// · 每条向量记录 {文本hash, 模型名}：改了文本或换了 embedding 模型自动检测重嵌，不拿两个语义空间硬比。
// ============================================================
function memVecHash(s) { let h = 5381; s = String(s || ""); for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return h.toString(36) + "_" + s.length; }
function idbVecOpen() { return new Promise((res, rej) => { const r = indexedDB.open("x_memvec", 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("vec")) r.result.createObjectStore("vec"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbVecPut(k, val) { const db = await idbVecOpen(); return new Promise((res, rej) => { const tx = db.transaction("vec", "readwrite"); tx.objectStore("vec").put(val, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbVecDel(k) { const db = await idbVecOpen(); return new Promise(res => { const tx = db.transaction("vec", "readwrite"); tx.objectStore("vec").delete(k); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
async function idbVecClear() { const db = await idbVecOpen(); return new Promise(res => { const tx = db.transaction("vec", "readwrite"); tx.objectStore("vec").clear(); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
async function idbVecEntries() { const db = await idbVecOpen(); return new Promise(res => { const tx = db.transaction("vec", "readonly"); const st = tx.objectStore("vec"); let ks = null, vs = null; const done = () => { if (ks && vs) res(ks.map((k, i) => [k, vs[i]])); }; const kq = st.getAllKeys(); const vq = st.getAll(); kq.onsuccess = () => { ks = kq.result || []; done(); }; vq.onsuccess = () => { vs = vq.result || []; done(); }; tx.onerror = () => res([]); }); }
// 内存缓存：记忆条目 id -> {h:文本hash, m:模型名, v:Float32Array}（挂 window 跨脚本共享）
function _memVecCache() { if (typeof window === "undefined") return new Map(); return window.__memVecCache || (window.__memVecCache = new Map()); }
async function hydrateMemVecs() {
  if (typeof window !== "undefined" && window.__memVecHydrated) return _memVecCache().size;
  try { const entries = await idbVecEntries(); const c = _memVecCache(); entries.forEach(([k, val]) => { if (k && val && val.v && !c.has(k)) c.set(k, val); }); } catch (e) {}
  if (typeof window !== "undefined") window.__memVecHydrated = true;
  return _memVecCache().size;
}
// bge 系官方用法：短查询→长文档检索时【只在查询侧】加指令前缀，文档侧不加（嵌错一边质量明显掉）
const BGE_QUERY_PREFIX = "为这个句子生成表示以用于检索相关文章：";
// 批量嵌入。texts -> Float32Array[]（顺序与输入一致）。没配 API 返回 null；网络/格式错误抛异常（调用方自行兜底）
async function embedTexts(texts, opts) {
  opts = opts || {};
  const c = loadEmbApi();
  if (!(c.enabled && c.baseUrl && c.apiKey && c.model)) return null;
  const base = c.baseUrl.replace(/\/$/, "");
  const root = base.endsWith("/v1") ? base : base + "/v1";
  const isBge = /bge/i.test(c.model);
  // bge 单条输入上限 512 token：中文按字截 420 字兜底（加上前缀仍在限内）
  const input = texts.map(t => { let s = String(t || "").slice(0, 420); if (opts.isQuery && isBge) s = BGE_QUERY_PREFIX + s; return s || " "; });
  const r = await fetchT(root + "/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + c.apiKey },
    body: JSON.stringify({ model: c.model, input: input })
  }, opts.timeout || 25000);
  const d = await r.json();
  if (!d || !Array.isArray(d.data)) throw new Error((d && d.error && (d.error.message || JSON.stringify(d.error))) || "embedding 返回格式不对");
  const arr = d.data.slice().sort((a, b) => (a.index || 0) - (b.index || 0)).map(x => Float32Array.from((x && x.embedding) || []));
  if (arr.length !== texts.length || arr.some(v => !v.length)) throw new Error("embedding 返回条数/维度不对");
  return arr;
}
// 条目 -> 待嵌文本（带标签一起嵌，标签也是语义的一部分）
function memEntryEmbedText(e) { return (String(e.text || "") + ((e.tags && e.tags.length) ? ("（" + e.tags.join("、") + "）") : "")).slice(0, 420); }
// 给记忆库补嵌向量：只处理「没向量/文本变了/换了模型」的条目（force=全量重嵌），分批走 API、批间歇口气（免费模型有限速）。
// 顺手清掉已删除条目的孤儿向量。onProgress(done,total)。返回本次嵌了几条。任何时候没配 API 都静默返回 0。
async function ensureMemVecs(lib, opts) {
  opts = opts || {};
  if (!embApiReady()) return 0;
  await hydrateMemVecs();
  const model = loadEmbApi().model;
  const cache = _memVecCache();
  const list = (lib || []).filter(e => e && e.id && e.text);
  const todo = list.filter(e => { if (opts.force) return true; const cur = cache.get(e.id); return !(cur && cur.m === model && cur.h === memVecHash(memEntryEmbedText(e))); });
  // 孤儿清理：缓存/IDB 里有、记忆库里已经没有的条目
  const liveIds = new Set(list.map(e => e.id));
  for (const k of Array.from(cache.keys())) { if (!liveIds.has(k)) { cache.delete(k); idbVecDel(k); } }
  if (!todo.length) { if (opts.onProgress) opts.onProgress(0, 0); return 0; }
  // 先问云端：CC/别的设备可能已经算好这条向量（同模型 + 同文本 hash 就直接采用，省一次 API）。
  // memory_embeddings 是 App 与 MCP 共用的同一张表；两侧配同一个 embedding 模型时互认互不重算。
  let remaining = todo;
  if (typeof window !== "undefined" && window.Cloud && window.Cloud.memVecFetch) {
    try {
      const cloudRows = await window.Cloud.memVecFetch(todo.map(e => e.id));
      const cmap = new Map((cloudRows || []).map(r => [r.id, r]));
      const stillTodo = [];
      for (const e of todo) {
        const cr = cmap.get(e.id);
        if (cr && cr.model === model && cr.hash === memVecHash(memEntryEmbedText(e)) && Array.isArray(cr.embedding) && cr.embedding.length) {
          const rec = { h: cr.hash, m: model, v: Float32Array.from(cr.embedding) };
          cache.set(e.id, rec);
          await idbVecPut(e.id, rec);
        } else stillTodo.push(e);
      }
      remaining = stillTodo;
    } catch (e) { remaining = todo; }
  }
  if (!remaining.length) { if (opts.onProgress) opts.onProgress(0, 0); return 0; }
  const BATCH = 16;
  let done = 0;
  if (opts.onProgress) opts.onProgress(0, remaining.length);
  for (let i = 0; i < remaining.length; i += BATCH) {
    const batch = remaining.slice(i, i + BATCH);
    const vecs = await embedTexts(batch.map(memEntryEmbedText));
    if (!vecs) return done;
    const cloudPush = [];
    for (let j = 0; j < batch.length; j++) {
      const h = memVecHash(memEntryEmbedText(batch[j]));
      const rec = { h, m: model, v: vecs[j] };
      cache.set(batch[j].id, rec);
      await idbVecPut(batch[j].id, rec);
      cloudPush.push({ id: batch[j].id, model, hash: h, embedding: Array.from(vecs[j]) });
    }
    // 写回云端，让 CC/别的设备共用同一份（best-effort，失败不影响本地检索）
    try { if (typeof window !== "undefined" && window.Cloud && window.Cloud.memVecUpsert) await window.Cloud.memVecUpsert(cloudPush); } catch (e) {}
    done += batch.length;
    if (opts.onProgress) opts.onProgress(done, remaining.length);
    if (i + BATCH < remaining.length) await new Promise(res => setTimeout(res, 300));
  }
  return done;
}
// 存量向量合流：把本地【已有向量、但云端还没有(或模型/hash不一致)】的条目一次性推上云。
// 为什么单独一个函数：ensureMemVecs 只补「本地缺的」，对本地早已算好的存量向量视而不见，
// 不会主动上推；App 在 v48.11 起攒了成百上千条本地向量，全靠这里合流给 CC/别的设备共用。
// 幂等：跑第二次时云端已有、model+hash 一致 → push 为空、零写入。没配 embedding/没登录静默跳过。
async function syncMemVecsToCloud(lib) {
  if (!embApiReady()) return 0;
  if (!(typeof window !== "undefined" && window.Cloud && window.Cloud.memVecFetch && window.Cloud.memVecUpsert)) return 0;
  await hydrateMemVecs();
  const model = loadEmbApi().model;
  const cache = _memVecCache();
  const list = (lib || []).filter(e => e && e.id && e.text);
  const localHave = list.filter(e => { const c = cache.get(e.id); return c && c.v && c.m === model && c.h === memVecHash(memEntryEmbedText(e)); });
  if (!localHave.length) return 0;
  let cloudRows = [];
  try { cloudRows = await window.Cloud.memVecFetch(localHave.map(e => e.id)); } catch (e) { return 0; }
  const cmap = new Map((cloudRows || []).map(r => [r.id, r]));
  const push = [];
  for (const e of localHave) {
    const cr = cmap.get(e.id);
    const h = memVecHash(memEntryEmbedText(e));
    if (!cr || cr.model !== model || cr.hash !== h) { const rec = cache.get(e.id); push.push({ id: e.id, model, hash: h, embedding: Array.from(rec.v) }); }
  }
  if (!push.length) return 0;
  let done = 0;
  for (let i = 0; i < push.length; i += 100) {
    try { await window.Cloud.memVecUpsert(push.slice(i, i + 100)); done += Math.min(100, push.length - i); } catch (e) { break; }
  }
  return done;
}
// 查询向量缓存（LRU 20 条）：key = 模型|查询文本hash。查询取【末尾】420 字——最近的消息在最后，语义检索要贴着最新话题
function _qVecCache() { if (typeof window === "undefined") return new Map(); return window.__qVecCache || (window.__qVecCache = new Map()); }
function _qVecKey(text) { return loadEmbApi().model + "|" + memVecHash(String(text || "").slice(-420)); }
// 发消息前调这个把查询向量预热进缓存（一次小嵌入调用 ~200-400ms，和大模型几秒比可忽略）。永不抛异常。
async function primeQueryVec(text) {
  try {
    text = String(text || "");
    if (!embApiReady() || !text.trim()) return null;
    const key = _qVecKey(text);
    const qc = _qVecCache();
    if (qc.has(key)) { const hit = qc.get(key); qc.delete(key); qc.set(key, hit); return hit; }
    const arr = await embedTexts([text.slice(-420)], { isQuery: true, timeout: 6000 });
    if (!arr || !arr[0]) return null;
    qc.set(key, arr[0]);
    while (qc.size > 20) qc.delete(qc.keys().next().value);
    return arr[0];
  } catch (e) { return null; }
}
// 检索时同步取查询向量：预热过才有，没有就 null（= 纯关键词打分）
function getQueryVec(text) {
  try { if (!embApiReady()) return null; const v = _qVecCache().get(_qVecKey(text)); return v ? { v: v, m: loadEmbApi().model } : null; } catch (e) { return null; }
}
function cosSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d ? dot / d : 0;
}
// ============================================================
// 世界书向量（v48.29，backlog #3）：给【带关键词】的词条也配 embedding——
// 关键词没打中字面、但近期对话语义贴近时也能召回（「上次那家川菜馆」召回关键词只写了「火锅」的词条）。
// 设计与向量记忆同款：向量只进 IndexedDB(x_lorevec) 不进云；selectLore 保持同步签名，
// 靠 replyNow 发送前 primeQueryVec 预热的同一枚查询向量（查询文本同为最近对话）；
// 没预热/没开 embedding → 行为与旧版完全一致。正则词条不参与语义召回（正则是刻意的精确扳机）。
// ============================================================
function loreEntryEmbedText(e) { return (((e.title || "") + " " + ((e.keyword || "").split(/[,，、|]/).join(" ")) + " " + String(e.payload || "")).trim()).slice(0, 420); }
function idbLoreVecOpen() { return new Promise((res, rej) => { const r = indexedDB.open("x_lorevec", 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("vec")) r.result.createObjectStore("vec"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbLoreVecPut(k, val) { const db = await idbLoreVecOpen(); return new Promise((res, rej) => { const tx = db.transaction("vec", "readwrite"); tx.objectStore("vec").put(val, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbLoreVecDel(k) { const db = await idbLoreVecOpen(); return new Promise(res => { const tx = db.transaction("vec", "readwrite"); tx.objectStore("vec").delete(k); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
async function idbLoreVecEntries() { const db = await idbLoreVecOpen(); return new Promise(res => { const tx = db.transaction("vec", "readonly"); const st = tx.objectStore("vec"); let ks = null, vs = null; const done = () => { if (ks && vs) res(ks.map((k, i) => [k, vs[i]])); }; const kq = st.getAllKeys(); const vq = st.getAll(); kq.onsuccess = () => { ks = kq.result || []; done(); }; vq.onsuccess = () => { vs = vq.result || []; done(); }; tx.onerror = () => res([]); }); }
function _loreVecCache() { if (typeof window === "undefined") return new Map(); return window.__loreVecCache || (window.__loreVecCache = new Map()); }
async function hydrateLoreVecs() {
  if (typeof window !== "undefined" && window.__loreVecHydrated) return _loreVecCache().size;
  try { const entries = await idbLoreVecEntries(); const c = _loreVecCache(); entries.forEach(([k, val]) => { if (k && val && val.v && !c.has(k)) c.set(k, val); }); } catch (e) {}
  if (typeof window !== "undefined") window.__loreVecHydrated = true;
  return _loreVecCache().size;
}
// 只嵌「设了关键词且非正则」的词条（常驻/无关键词的本来就常进，不用向量）；顺手清孤儿
async function ensureLoreVecs(entries, opts) {
  opts = opts || {};
  if (!embApiReady()) return 0;
  await hydrateLoreVecs();
  const model = loadEmbApi().model;
  const cache = _loreVecCache();
  const list = (entries || []).filter(e => e && e.id && ((e.keyword || "").trim()) && !e.regex && (e.payload || "").trim());
  const todo = list.filter(e => { if (opts.force) return true; const cur = cache.get(e.id); return !(cur && cur.m === model && cur.h === memVecHash(loreEntryEmbedText(e))); });
  const liveIds = new Set(list.map(e => e.id));
  for (const k of Array.from(cache.keys())) { if (!liveIds.has(k)) { cache.delete(k); idbLoreVecDel(k); } }
  if (!todo.length) return 0;
  const BATCH = 16;
  let done = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const vecs = await embedTexts(batch.map(loreEntryEmbedText));
    if (!vecs) return done;
    for (let j = 0; j < batch.length; j++) {
      const rec = { h: memVecHash(loreEntryEmbedText(batch[j])), m: model, v: vecs[j] };
      cache.set(batch[j].id, rec);
      await idbLoreVecPut(batch[j].id, rec);
    }
    done += batch.length;
    if (i + BATCH < todo.length) await new Promise(res => setTimeout(res, 300));
  }
  return done;
}
// 全局错误兜底(审计一刀):运行时错误落环形日志(x_errlog,末30条),平时静默;
// 只有启动就摔死(React 没挂上 #root)才亮 rescue.html 救援入口,不打扰正常使用。
(function () {
  if (typeof window === "undefined" || window.__errNetUp) return;
  window.__errNetUp = true;
  const log = (kind, msg, extra) => {
    try {
      const a = JSON.parse(localStorage.getItem("x_errlog") || "[]");
      a.push({ t: Date.now(), k: kind, m: String(msg || "").slice(0, 300), x: String(extra || "").slice(0, 200) });
      localStorage.setItem("x_errlog", JSON.stringify(a.slice(-30)));
    } catch (e) {}
  };
  window.__errlog = () => { try { return JSON.parse(localStorage.getItem("x_errlog") || "[]"); } catch (e) { return []; } };
  let shown = false;
  const maybeRescue = () => {
    if (shown) return;
    setTimeout(() => {
      try {
        const root = document.getElementById("root");
        if (shown || !root || root.childElementCount > 0) return;
        shown = true;
        const d = document.createElement("div");
        d.style.cssText = "position:fixed;left:12px;right:12px;bottom:24px;z-index:99999;background:#7f1d1d;color:#fff;padding:12px 14px;border-radius:12px;font:14px -apple-system,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.4)";
        d.innerHTML = '启动出错了。<a href="rescue.html" style="color:#fecaca;text-decoration:underline">点这里进入救援页</a>（数据都在，别慌）';
        document.body.appendChild(d);
      } catch (e) {}
    }, 1500);
  };
  window.addEventListener("error", ev => { log("error", ev && ev.message, (ev && ev.filename || "") + ":" + (ev && ev.lineno || "")); maybeRescue(); });
  window.addEventListener("unhandledrejection", ev => {
    const r = ev && ev.reason;
    log("promise", (r && r.message) || r, r && r.stack ? String(r.stack).slice(0, 200) : "");
  });
})();
// 带超时的 fetch：超时/卡死时中断并抛出可读错误，避免无限转圈
async function fetchT(url, options, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms || 120000);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("请求超时，请重试（模型或网络太慢）");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
async function callAI(p, system, messages, opts) {
  opts = opts || {};
  const reqTimeout = opts.timeout || 120000;
  const base = (p.baseUrl || "").replace(/\/$/, "");
  const fmt = detectFormat(p);
  const model = p.model;
  const temp = typeof p.temperature === "number" ? p.temperature : 0.75;
  const maxTokens = opts.maxTokens || 2400;
  // App 内部统一用 imageDataUrls 携带真图；到这里才按各家协议翻译，避免聊天层绑定某一家 API。
  // 图片只在本次请求中展开成 base64，不写回 localStorage。
  const splitDataImage = v => {
    const m = /^data:([^;,]+);base64,([\s\S]+)$/.exec(String(v || ""));
    return m ? { mediaType: m[1] || "image/jpeg", data: m[2] } : null;
  };
  const wireMessages = (messages || []).map(m => {
    const imgs = Array.isArray(m.imageDataUrls) ? m.imageDataUrls.map(splitDataImage).filter(Boolean) : [];
    if (!imgs.length) return { role: m.role, content: m.content };
    const text = String(m.content || "[照片]");
    if (fmt === "anthropic") return { role: m.role, content: [
      ...imgs.map(x => ({ type: "image", source: { type: "base64", media_type: x.mediaType, data: x.data } })),
      { type: "text", text }
    ] };
    if (fmt === "gemini") return { role: m.role, content: text, _geminiParts: [
      ...imgs.map(x => ({ inline_data: { mime_type: x.mediaType, data: x.data } })),
      { text }
    ] };
    return { role: m.role, content: [
      { type: "text", text },
      ...imgs.map(x => ({ type: "image_url", image_url: { url: "data:" + x.mediaType + ";base64," + x.data } }))
    ] };
  });
  if (!p.apiKey && !p.proxyRef) throw new Error("尚未填写密钥，去设置里补上（或填云端代理引用名走保险柜）");
  if (!model) throw new Error("尚未指定模型");
  // baseUrl 没填对（空/没 http 前缀/残留中文占位或空格）时，浏览器 fetch 会抛天书 DOMException
  // 「the string did not match the expected pattern」——这里提前拦成看得懂的话，指到具体线路。
  if (!p.proxyRef && !/^https?:\/\/\S+$/i.test(base)) throw new Error("这条线路的接口地址填得不对：「" + (p.baseUrl || "（空）") + "」——去设置·API 检查【" + (p.name || model || "该线路") + "】的 baseUrl（要以 http(s):// 开头，别留空格或中文占位）");
  // 云端密钥代理（v49.38）：线路填了 proxyRef（如 DZZI/ANTHROPIC）就借道 llm-proxy 函数——
  // 密钥住 Supabase secrets，浏览器一个字不存；函数只认 Lisa 本人登录态+域名白名单
  const viaProxy = p.proxyRef ? (url, bodyObj, xh) => {
    if (!(typeof window !== "undefined" && window.Cloud && window.Cloud.llmProxyFetch)) throw new Error("云端代理不可用：要先登录云同步");
    return window.Cloud.llmProxyFetch(String(p.proxyRef).trim().toUpperCase(), url, bodyObj, xh, reqTimeout);
  } : null;
  if (fmt === "anthropic") {
    // ⭐prompt 缓存降房租（v48.34，小克两步方案只做第①步；第②步「重排稳定段」她拍板不做——现在的顺序活人感对，不动）：
    // system 在【当前真实时间】处切成两块（时间行起每轮都变，是缓存的天然断点），前块打 cache_control ephemeral。
    // 多块 system 等价于拼接——模型看到的文本【一个字、一个顺序都没变】，只是稳定前缀（反八股/世界书守则/角色卡守则/长期准则）
    // 1 小时内连续聊天可命中缓存（读约一折；ttl:"1h"）。前块太短（<800字，不够 1024 token 起缓门槛）就不切，行为与旧版完全一致。
    // ⭐缓存有效期 5min→1h（v48.72，她 2026-07-13 截图命中率才 15%）：她散着聊、间隔常超 5min→每次冷启动重写=0 命中。
    //   1h TTL 把冷启动变命中，平均往「稳定前缀占比」那个天花板靠。写贵一点(2x vs 1.25x)、读仍 0.1 折，断续聊总账更省。
    //   线路不支持 1h 就自动记 x_noExtCache 回退 5min，绝不搞崩小克。
    const _extKey = base;
    let _noExt = false; try { _noExt = (JSON.parse(localStorage.getItem("x_noExtCache") || "[]") || []).indexOf(_extKey) >= 0; } catch (e) {}
    const _cc = () => _noExt ? { type: "ephemeral" } : { type: "ephemeral", ttl: "1h" };
    // 历史缓存模式（Phase 1，小克蓝图）：调用方保证 system 已【全稳定】（易变料挪到最后一条消息上）→ 整个 system 缓一块，
    //   再在 messages 里最后一条 assistant 上挂第二个断点，把【系统提示+整段历史】都缓住。命中天花板从 ~36% 抬到 80%+。
    const cacheHist = !!(opts && opts.cacheHistory);
    const buildSys = () => {
      if (typeof system !== "string") return system;
      if (cacheHist) return system.length > 40 ? [{ type: "text", text: system, cache_control: _cc() }] : system;
      const cut = system.indexOf("【当前真实时间】");
      if (cut < 800) return system;
      return [
        { type: "text", text: system.slice(0, cut), cache_control: _cc() },
        { type: "text", text: system.slice(cut) }
      ];
    };
    // 历史断点：最后一条 assistant 消息挂 cache_control（它之前的整段历史都稳定、可缓）。content 转成块结构才能挂标记。
    const buildMsgs = () => {
      if (!cacheHist || !wireMessages.length) return wireMessages;
      let li = -1; for (let i = wireMessages.length - 1; i >= 0; i--) if (wireMessages[i].role === "assistant") { li = i; break; }
      if (li < 0) return wireMessages;
      return wireMessages.map((m, i) => {
        if (i !== li) return m;
        if (Array.isArray(m.content)) {
          const blocks = m.content.map(b => ({ ...b }));
          const ti = blocks.map(b => b.type).lastIndexOf("text");
          if (ti >= 0) blocks[ti].cache_control = _cc();
          return { role: m.role, content: blocks };
        }
        return { role: m.role, content: [{ type: "text", text: String(m.content || ""), cache_control: _cc() }] };
      });
    };
    // 有些新模型（如带思考的 Claude 5/fable）不接受自定义 temperature（只允许 1 或直接不支持）→
    // 报 temperature 相关错就【去掉 temperature 裸参重试一次】，通用兜底、不用硬编每个模型的规则。
    const postAnthropic = async withTemp => {
      // ⚠️不用顶层自动缓存（v48.62 试过、v48.64 撤）：它「一路缓到最后一条消息」，把每轮都变的记忆/近期对话全写进缓存→
      // 每轮狂写(1.25倍)只读回一点点，写远大于读、反而更贵(她真机实测 写40149/读3961)。
      // 只留【手动块级切块】：cache_control 只打在「守则+人设+关系」稳定前缀那块(见 buildSys)——写一次、之后每轮只读(一折)。
      const body = { model, max_tokens: maxTokens, system: buildSys(), messages: buildMsgs() };
      if (withTemp) body.temperature = temp;
      const headers = {
        "Content-Type": "application/json",
        "x-api-key": p.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      };
      if (!_noExt) headers["anthropic-beta"] = "extended-cache-ttl-2025-04-11"; // 1h 缓存的 beta 门（GA 后无害）
      const r = viaProxy
        ? await viaProxy(base + "/v1/messages", body, _noExt ? { "anthropic-version": "2023-06-01" } : { "anthropic-version": "2023-06-01", "anthropic-beta": "extended-cache-ttl-2025-04-11" })
        : await fetchT(base + "/v1/messages", { method: "POST", headers, body: JSON.stringify(body) }, reqTimeout);
      return await r.json();
    };
    // ⚠️按次计费防双扣：某线路一旦被记过「不吃 temperature」就直接裸发，不再白扣一次
    const _ntKey = base + "|" + model;
    const wantTemp = () => { try { return (JSON.parse(localStorage.getItem("x_noTemp") || "[]") || []).indexOf(_ntKey) < 0; } catch (e) { return true; } };
    let d = await postAnthropic(wantTemp());
    if (wantTemp() && d.error && /temperature/i.test(d.error.message || "")) {
      try { const a = JSON.parse(localStorage.getItem("x_noTemp") || "[]") || []; if (a.indexOf(_ntKey) < 0) { a.push(_ntKey); localStorage.setItem("x_noTemp", JSON.stringify(a)); } } catch (e) {}
      d = await postAnthropic(false);
    }
    // 扩展缓存(1h)回退：这条线路不吃 ttl/beta 就记下、退回 5min ephemeral 重发（防双扣，只回退一次）
    if (!_noExt && d.error && /(ttl|extended|cache_control|anthropic-beta|\bbeta\b)/i.test(d.error.message || "")) {
      try { const a = JSON.parse(localStorage.getItem("x_noExtCache") || "[]") || []; if (a.indexOf(_extKey) < 0) { a.push(_extKey); localStorage.setItem("x_noExtCache", JSON.stringify(a)); } } catch (e) {}
      _noExt = true;
      d = await postAnthropic(wantTemp());
    }
    if (d.error) throw new Error(d.error.message);
    // usage 回显（让缓存看得见）：cr=从缓存读到的 token（一折价，>0 就是命中）、cw=写进缓存的、in=断点后的新输入。
    // 存 window.__usage（最近 30 条）+ 命中/写入时打一行 console；window.__cacheStat() 看汇总。
    try {
      const u = d.usage || {};
      const _usageReported = !!(d.usage && (
        Object.prototype.hasOwnProperty.call(d.usage, "cache_read_input_tokens") ||
        Object.prototype.hasOwnProperty.call(d.usage, "cache_creation_input_tokens")
      ));
      const _hasAssistantBreakpoint = cacheHist && wireMessages.some(m => m && m.role === "assistant");
      const rec = {
        t: Date.now(), model, ch: cacheHist,
        in: u.input_tokens || 0, out: u.output_tokens || 0,
        cr: u.cache_read_input_tokens || 0, cw: u.cache_creation_input_tokens || 0,
        // 订阅桥不一定回传 token usage；这些字段记录我们能亲自证明的请求事实。
        bridge: !!p.proxyRef, cacheRequested: cacheHist,
        systemBreakpoint: cacheHist && typeof system === "string" && system.length > 40,
        historyBreakpoint: _hasAssistantBreakpoint,
        usageReported: _usageReported
      };
      // 前缀指纹（诊断「连着聊也不命中」，她 2026-07-13 抓的）：缓存的稳定前缀每轮该完全一样；
      // 指纹每轮都变=前缀被某处每轮污染了，那才是没命中的真因（而非有效期/线路）。plen=前缀字符数。
      // ⭐只诊断【主聊天(cacheHist)】那类调用：日记/交换日记等后台生成 prompt 完全不同，若也参与就会污染指纹种类，
      //   还会用它们的前缀覆盖 window.__ljph、把夹在中间的下一条聊天误判成「前缀变了」（她 2026-07-14 抓的 12 刀真凶之一）。
      if (cacheHist) {
        try {
          const _cut = typeof system === "string" ? system.length : -1; // 历史缓存模式 system 已全稳定→整块算指纹
          if (_cut >= 800) { const _pfx = system.slice(0, _cut); let _hh = 5381; for (let _i = 0; _i < _pfx.length; _i++) _hh = ((_hh << 5) + _hh + _pfx.charCodeAt(_i)) | 0; rec.ph = _hh >>> 0; rec.plen = _pfx.length; }
        } catch (e) {}
        // 前缀和上一次(同为缓存前缀的)聊天比：pfxSame=false 就是这轮前缀变了。一次性变=只 1 处 false；每轮 churn=处处 false。
        if (typeof window !== "undefined" && rec.ph != null) { rec.pfxSame = (window.__ljph != null ? window.__ljph === rec.ph : null); window.__ljph = rec.ph; }
      }
      if (typeof window !== "undefined") {
        (window.__usage = window.__usage || []).push(rec); if (window.__usage.length > 30) window.__usage.shift();
        if (!window.__cacheStat) window.__cacheStat = () => { const a = window.__usage || []; const s = a.reduce((o, r) => { o.cr += r.cr; o.cw += r.cw; o.in += r.in; o.hit += r.cr > 0 ? 1 : 0; return o; }, { cr: 0, cw: 0, in: 0, hit: 0 }); const _phs = new Set(a.map(r => r.ph).filter(x => x != null)); return "近" + a.length + "次 anthropic 调用：命中缓存 " + s.hit + " 次｜累计 读缓存(一折)" + s.cr + " 写缓存" + s.cw + " 新输入" + s.in + " tok｜前缀指纹 " + _phs.size + " 种(越少越稳)"; };
        if (rec.cr || rec.cw) console.log("[缓存] 读" + rec.cr + " 写" + rec.cw + " 新输入" + rec.in + " 输出" + rec.out + " tok 指纹" + (rec.ph || "-") + (rec.cr ? "（命中！读的部分只按一折收）" : "（首次/过期/前缀变了→写缓存，命中后 1 小时内读就省）"));
      }
    } catch (e) {}
    const t = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    if (!t) throw new Error("模型返回为空" + (d.stop_reason ? "（停止原因：" + d.stop_reason + "）" : "（上游没有返回正文）"));
    return t;
  }
  if (fmt === "gemini") {
    const gBody = {
      system_instruction: {
        parts: [{
          text: system
        }]
      },
      contents: wireMessages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: m._geminiParts || [{ text: m.content }]
      })),
      generationConfig: {
        temperature: temp,
        maxOutputTokens: maxTokens
      }
    };
    // 走代理时函数按 ROUTES 里该引用名的 style 贴钥匙（google 原生线要 goog 头风格）
    const r = viaProxy ? await viaProxy(base + "/v1beta/models/" + model + ":generateContent", gBody, {}) : await fetchT(base + "/v1beta/models/" + model + ":generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": p.apiKey
      },
      body: JSON.stringify(gBody)
    }, reqTimeout);
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    const parts = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts || [];
    const t = parts.map(x => x.text || "").join("").trim();
    if (!t) {
      const reason = d.candidates && d.candidates[0] && d.candidates[0].finishReason;
      const blocked = d.promptFeedback && d.promptFeedback.blockReason;
      throw new Error("模型返回为空" + (reason || blocked ? "（停止原因：" + (reason || blocked) + "）" : "（上游没有返回正文）"));
    }
    return t;
  }
  const root = base.endsWith("/v1") ? base : base + "/v1";
  // openai 兼容：同样兜底——推理类模型（o系/部分中转）不吃 temperature，报错就去掉重试一次
  const postOpenAI = async withTemp => {
    // 言秋订阅桥用标准 OpenAI SSE。即使 CLI 还在思考，桥也会先发 heartbeat，
    // 避免 Cloudflare/网关把“100 秒没有首字节”误杀成 Load failed。
    const wantStream = !!(opts && opts.stream && !viaProxy);
    const body = { model, max_tokens: maxTokens, messages: [{ role: "system", content: system }, ...wireMessages], ...(wantStream ? { stream: true, stream_options: { include_usage: true } } : {}) };
    if (withTemp) body.temperature = temp;
    const r = viaProxy ? await viaProxy(root + "/chat/completions", body, {}) : await fetchT(root + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + p.apiKey },
      body: JSON.stringify(body)
    }, reqTimeout);
    if (wantStream && /text\/event-stream/i.test(r.headers.get("content-type") || "")) {
      const reader = r.body.getReader(), decoder = new TextDecoder();
      let pending = "", text = "", usage = null, error = null;
      const consume = line => {
        if (!line.startsWith("data:")) return;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") return;
        let event; try { event = JSON.parse(raw); } catch (e) { return; }
        if (event.error) error = event.error;
        const choice = event.choices && event.choices[0];
        if (choice && choice.delta && choice.delta.content) text += choice.delta.content;
        if (event.usage) usage = event.usage;
      };
      // 流式超时分型(审计一刀·三审定):fetchT 只管到响应头,此后 reader.read() 原本裸奔——
      // 桥/网关半路断线不抛错时气泡永远转圈。静默超时=每收到一段数据就重置(桥每 15s 有心跳,
      // 90s 静默≈连丢 6 次心跳,判死);总时限只防无限滴漏,给足长思考。
      const SILENCE_MS = (opts && opts.streamSilenceMs) || 90000;
      const TOTAL_MS = (opts && opts.streamTotalMs) || 600000;
      const t0 = Date.now();
      while (true) {
        if (Date.now() - t0 > TOTAL_MS) {
          try { reader.cancel(); } catch (e) {}
          throw new Error("流式回复超过总时限（" + Math.round(TOTAL_MS / 60000) + " 分钟），已断开——请重试");
        }
        let silenceTimer;
        let chunk;
        try {
          chunk = await Promise.race([
            reader.read(),
            new Promise((_, rej) => { silenceTimer = setTimeout(() => rej(new Error("__stream_silence__")), SILENCE_MS); })
          ]);
        } catch (e) {
          try { reader.cancel(); } catch (e2) {}
          if (String(e && e.message).indexOf("__stream_silence__") >= 0) throw new Error("流式回复中途静默超过 " + Math.round(SILENCE_MS / 1000) + " 秒（桥或网关可能断了），已断开——请重试");
          throw e;
        } finally { clearTimeout(silenceTimer); }
        if (chunk.done) break;
        pending += decoder.decode(chunk.value, { stream: true });
        const lines = pending.split(/\r?\n/); pending = lines.pop() || "";
        lines.forEach(consume);
      }
      if (pending) consume(pending);
      return error ? { error } : { choices: [{ message: { content: text }, finish_reason: "stop" }], usage: usage || {} };
    }
    return await r.json();
  };
  const _ntKey2 = base + "|" + model;
  let _skipT2 = false; try { _skipT2 = (JSON.parse(localStorage.getItem("x_noTemp") || "[]") || []).indexOf(_ntKey2) >= 0; } catch (e) {}
  let d = await postOpenAI(!_skipT2);
  if (!_skipT2 && d.error && /temperature/i.test(d.error.message || "")) {
    try { const a = JSON.parse(localStorage.getItem("x_noTemp") || "[]") || []; if (a.indexOf(_ntKey2) < 0) { a.push(_ntKey2); localStorage.setItem("x_noTemp", JSON.stringify(a)); } } catch (e) {}
    d = await postOpenAI(false);
  }
  if (d.error) throw new Error(d.error.message);
  // openai/订阅桥线路也回显 usage（v52.28）：订阅桥升级后会把 CLI 账单里的
  // cache_read/cache_creation 透传进 usage，这里进同一个 window.__usage，缓存面板照常可见。
  try {
    const u2 = d.usage || {};
    const rec2 = {
      t: Date.now(), model, ch: false,
      in: u2.prompt_tokens || 0, out: u2.completion_tokens || 0,
      cr: u2.cache_read_input_tokens || 0, cw: u2.cache_creation_input_tokens || 0,
      bridge: !!p.proxyRef || /ts\.net|localhost|127\.0\.0\.1/.test(base),
      cacheRequested: false, systemBreakpoint: false, historyBreakpoint: false,
      usageReported: !!d.usage
    };
    if (typeof window !== "undefined") { (window.__usage = window.__usage || []).push(rec2); if (window.__usage.length > 30) window.__usage.shift(); }
  } catch (e) {}
  const choice = d.choices && d.choices[0];
  const t = (choice && choice.message && choice.message.content || "").trim();
  if (!t) throw new Error("模型返回为空" + (choice && choice.finish_reason ? "（停止原因：" + choice.finish_reason + "）" : "（上游没有返回正文）"));
  return t;
}
function repairJSON(t) {
  // 走查字符，补全被截断的字符串与括号，尽力把残缺 JSON 修成可解析
  let out = "";
  const stack = [];
  let inStr = false,
    esc = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    out += c;
    if (inStr) {
      if (esc) esc = false;else if (c === "\\") esc = true;else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;else if (c === "{") stack.push("}");else if (c === "[") stack.push("]");else if (c === "}" || c === "]") stack.pop();
  }
  if (inStr) out += '"'; // 关闭未闭合的字符串
  out = out.replace(/[,:]\s*$/, ""); // 去掉悬空的逗号/冒号
  while (stack.length) out += stack.pop(); // 补齐未闭合的括号
  out = out.replace(/,(\s*[}\]])/g, "$1"); // 去掉尾逗号
  return out;
}
function extractJSON(raw) {
  if (!raw) return null;
  let t = String(raw).replace(/```(?:json)?/gi, "").trim();
  const tryParse = s => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };
  let r = tryParse(t);
  if (r !== undefined) return r;
  const s = t.search(/[\[{]/);
  if (s < 0) return null;
  t = t.slice(s);
  const e = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (e > 0) {
    r = tryParse(t.slice(0, e + 1));
    if (r !== undefined) return r;
  }
  r = tryParse(repairJSON(t)); // 兜底：修复被截断的 JSON
  if (r !== undefined) return r;
  return null;
}

// ============================================================
// ENGINE — context bundle + probe + summary
// ============================================================
function directedRelationLines(char, rels, chars, profile) {
  const lines = [];
  const me = profile.name || "用户";
  const fmt = r => r ? (r.label + (r.note ? "（" + r.note + "）" : "")) : null;
  const a = rels[char.id + "->me"],
    b = rels["me->" + char.id];
  const ta = fmt(a), tb = fmt(b);
  // 双向关系文本 trim 后完全一致 → 合并成「彼此：」一行（对称关系不必重复两遍、省 token）；不同则双向各一条
  if (ta && tb && ta.trim() === tb.trim()) {
    lines.push("- " + char.name + " 和「" + me + "」彼此：" + ta);
  } else {
    if (ta) lines.push("- " + char.name + " 眼中的「" + me + "」：" + ta);
    if (tb) lines.push("- 「" + me + "」眼中的 " + char.name + "：" + tb);
  }
  for (const o of chars) {
    if (o.id === char.id) continue;
    const r = rels[char.id + "->" + o.id];
    if (r) lines.push("- " + char.name + " 眼中的 " + o.name + "：" + r.label + (r.note ? "（" + r.note + "）" : ""));
  }
  return lines.length ? lines.join("\n") : "（暂无已设定的关系）";
}
// 叙事人称/代入方式指令（单聊/群聊/线下共用）：selfP/userP = "first|second|third"，describeMe = 是否让角色描写并推动用户的动作
function narrativeDirective(s) {
  s = s || {};
  // describeMe=false 也是一条明确指令，不能被当成「没设置」吞掉；否则界面关着，模型仍可能顺手代写用户动作。
  if (!s.selfP && !s.userP && !Object.prototype.hasOwnProperty.call(s, "describeMe")) return "";
  const selfMap = { first: "用第一人称『我』称呼你自己", second: "用第二人称『你』称呼你自己", third: "用第三人称称呼你自己（按你的性别用『她』或『他』，或直接用你的名字）" };
  const userMap = { first: "用第一人称『我』称呼对方", second: "用第二人称『你』称呼对方", third: "用第三人称称呼对方（按对方性别用『她』或『他』，或直接用对方名字）" };
  const parts = [];
  if (s.selfP) parts.push(selfMap[s.selfP] || selfMap.first);
  if (s.userP) parts.push(userMap[s.userP] || userMap.second);
  const desc = s.describeMe
    ? "你可以主动描写并推动对方（用户）的动作、神态与反应来带动剧情走向（如「你摇了摇头说……」「你转移了话题」），像在写一段双人叙事。"
    : "只描写你自己的言行和心理，不要替对方决定动作或台词。";
  return "\n【叙事人称】" + (parts.length ? parts.join("；") + "。" : "") + desc;
}
// 内置「去人机味 / 反八股」总则——焊死在所有生成里，不用挂世界书也能压住套路化的 AI 腔
const ANTI_CLICHE_LEGACY = `【去人机味 · 最高准则（任何身份、任何场景都优先于其他要求）】
把角色演成一个具体、真实、有自己生活的人，而不是 AI 扮演的「完美体贴对象」。严禁下列一切「人机味」八股：
① 模板式关怀：不要没来由地催吃饭、催睡觉、劝多喝热水、加衣、「注意身体」；不要凭空断定对方「胃不好 / 没休息好 / 太累了」。关心必须有具体由头、点到为止，绝不当口头禅反复出现。
② 交易补偿腔（重点压制·反复犯）：绝不要动不动跟对方讨「利息」「补偿」「赔偿」，不许把对方的每一次疏忽/迟回/忘事/爽约都记成一笔账、隔天翻出来要 TA「还」；不许把「你欠我的」「你得补偿我」「加倍还」「连本带利」这种讨债腔挂嘴边，把相处变成斤斤计较的交易。真人恋人/朋友不会这么算计——在意就直接说在意、想 TA 就直接说想、真生气就直接闹一下，但绝不搞记账追偿、也不把每份好都标价等着回收。（真被亏待了可以委屈两句、可以嗔一下，但【点到为止】，绝不反复讨要补偿、绝不一件事记恨着反复拿出来清算。）
③ 客服式有求必应：你不是随叫随到、以对方为中心的客服。你有自己的事、心情和注意力——可以在忙、走神、先讲自己的事、敷衍、不接话、拒绝、甚至怼回去。
④ 说教与心灵鸡汤：不要升华、总结人生道理、「我完全理解你的感受」式贴标签共情，不要心理咨询腔。
⑤ 紫色散文 / 翻译腔：不堆砌华丽空洞的比喻，不大段景物抒情，不写「仿佛…又仿佛…」。
⑥ 复读机：不反复用同一个称呼、口头禅、招牌小动作（挑眉、勾唇、危险地眯眼之类）；立场和记忆保持一致，但每次的说法都要不一样。
⑦ 称呼：绝对不要用「用户」这个系统词来称呼你正在交谈的人——TA 是一个具体的人，有名字。当面说话用「你」，旁白/心声等第三人称叙述里用 TA 的名字或「她/他」。哪怕上文里出现过「用户」字样，你也不许照搬。
⑧ 不是百科全书：你只懂你的人设、职业、经历该懂的东西。碰到不属于你专业范围的问题（医学、法律、冷门理工、专业术语等），要像真人一样反应——不确定就直说「不知道 / 不太懂 / 得查一下」，或给个外行的模糊印象；就算去查了，也用你自己的话简短转述个大概，绝不背书式地长篇科普、罗列定义/正常值/公式。宁可露怯、答不全，也不要变成无所不知的搜索引擎。
⑨ 标点像真人打字：不要每句话都规规矩矩以句号结尾。日常发消息大多不打句号，短句直接断开。标点只在需要传递情绪时才用——问号表疑惑、感叹号表激动、省略号表欲言又止/迟疑、波浪号表随意撒娇。不带情绪的陈述句就别硬加句号。
⑩ 网文腔/爽文句式：严禁「不是…而是…」这种对仗定义句式当口头惯性反复用；严禁三连及以上的排比堆砌（「像…，像…，像…」）来强行煽情；严禁把人写成「小兽」「幼兽」「大型犬」之类拟兽化萌化标签；严禁「汹涌」「铺天盖地」「势不可挡」这类夸张情绪水词，以及「霸道」「危险」「危险地眯眼/勾唇」这套霸总标配。要具体、克制、有留白，别用这些现成的强度词替真实反应。
⑪ 不无脑迎合、也不为反对而反对：你是有自己想法和立场的活人——别一味顺着 TA、别讨好式附和「你说得对」，但**也别为了显得有个性就故意抬杠、唱反调、事事泼冷水、走极端**。同不同意、让不让步、软不软，全由【你的性格、价值观、过往经历，以及此刻和 TA 的关系与心情】来定：该认同就认同、该反驳就反驳、该心软就心软、该坚持就坚持。是一个真实的人此刻真实的判断和分寸，既不是无脑点头的复读机，也不是逢话必杠的杠精。
正面要求：吃透人设后自然长出反应——有私心、有情绪、有边界感，会口是心非、会跑题、有自己此刻的处境。说话像真人：口语、可长可短、可跳脱、可留白。永远让「活人感」压过「正确」「体贴」和「有用」。
【活人感执行顺序】每次先接住对方这句里最具体、最有情绪或最值得回应的那一点，再决定自己想说什么；不要先总结对方、复述上下文、解释自己的回复策略，也不要把每一轮都写成完整而周到的答复。允许只回半句、答非所问一点、先说自己的事、暂时不接某个点、突然想起别的事、说完又改口；这些必须由此刻语境和人设自然产生，不能为了“像真人”刻意表演。若结构化输出字段与自然表达冲突，优先保证气口、具体反应和真实立场，字段只做传输，不要让用户感觉在填表。`;
// 亲密/情欲场景专用反模板（只焊进线下叙事；普通生成不带，免得给非亲密内容套上这些规则）
const INTIMATE_ANTI_CLICHE_LEGACY_V1 = `【亲密 / 情欲场景 · 反模板（写到亲密或情欲时生效，优先级同去人机味）】
· 禁用这类"用一个夸张生理动作给情绪收尾"的模板及一切近义变体：把脸/下巴/鼻尖『埋进/埋回/埋在/抵在/蹭进』颈窝、颈间、发间，或往对方颈窝/怀里『蹭、蹭了蹭、蹭来蹭去、用力蹭』（不管有没有吸气嗅闻，这一整类"埋脸+蹭"的动作整段最多出现一次，且必须配一句只属于这两个人的具体话或细节，绝不当情绪收尾/确认存在的默认动作）；忍不住＋求/求饶/讨饶；把（欲望/热流/电流）写成从…直冲/窜上（天灵盖/头顶/脚底）。
· 【禁这几个反复冒的情绪加戏八股】(a)『把你嵌进/揉进/塞进（自己身体／怀里／骨血）里』『恨不得把你揉进身体里』这类"想把两人合成一体"的夸张比喻，一律不用；(b)用『轻得像羽毛，却重重砸在(心上/心口)』这种"轻重对比＋比喻"给一句话、一个眼神、一个动作强行加分量——直接写这句话让他脸色/动作/呼吸/手上力道具体怎么变，别用比喻打包煽情；(c)『眼眶／眼圈红了(一圈)』『眼睛红了』『鼻尖／鼻子发酸』『喉咙发紧发哽』这套现成的"要哭/动容"信号——要写情绪上涌，落到只属于此刻的具体破绽（声音突然断一下、话说到一半停住、别过脸、攥紧了你的衣角、呼吸乱了一拍），别贴这些通用标签。
· 嗓音：整段最多形容一次声音，且禁用「低沉沙哑」「沙哑颤抖」「暗哑」「又低又哑」「又哑又低」「低哑」「又低又沉」「又轻又哑」这组固定搭配及一切近义变体；声音的变化靠具体话语内容或停顿体现，不靠形容词堆。
· 【禁"像X一样让我/让人Y"油句】禁用「（这句话／这个眼神／这个声音／这个动作），像（电流／羽毛／潮水／某某）一样，让我（心头一颤／头皮发麻／腿一软／失神／沦陷／酥了半边身子…）」这种【拿一个比喻去解释某句话/某声音/某动作对"我"的生理效果】的固定句式——网文最油的套路。要写就直接写这一刻具体发生了什么、身体怎么动/怎么反应，别用"像X一样让我Y"打包煽情。
· 反通用（核心）：每个动作/反应都要"非这个角色、非对这个人不可"才成立——优先写角色专属的小动作、口癖、他在意的具体细节，绝不写换谁都通用的情欲模板动作。
· 收尾落地：亲密场景别用"闻气味/埋脸/叹息"这类默认动作收尾；改成一句符合他声纹的话，或一个只属于他俩的具体细节。
· 【绝不 OOC / 不跳戏】写到亲密或情欲时，全程留在角色里、留在此刻具体的身体与动作上：不许突然抽离成上帝视角做总结或点评、不许插入任何免责/说教/"要注意分寸"式提醒、不许用"此处省略/略过/画面淡出/不便细写"来跳过、也不许突然切成一段与前文脱节的抒情把戏糊过去。该往下就顺着具体的动作和对话继续演，别断。
· 【别用成人文模板糊弄】禁用"水乳交融/交缠/情动/难分难舍/索取/掠夺/攻城略地/沦陷/化成一滩水/理智断线"这类换谁都成立的八股词和标准情欲蒙太奇；情欲同样要落在这两个人此刻的具体动作、话语、身体记忆和各自在意的细节上，写得具体、笨拙、带他俩的专属感，而不是套一段通用情欲流水线。
· 【适应/成长不许一键清零·连续性铁律】写亲密前，先想清楚【你俩走到这一步的真实历史】：如果这类事【已经发生过好几次、他早就渐渐适应了】（哪怕仍带点害羞），这一次就必须【在"已经适应"的基础上】接着演——用户更主动、换了花样、或更进一步，最多让他脸热、被撩到、慌一拍、或干脆反被带动，【绝不许退回第一次的青涩、阴影、或"彻底不行/大脑一片空白/像机器一样死机宕机"那种从头崩溃的状态】。一个已经做过很多次的人，不该每次都当第一次演。除非剧情里真的出现了全新的、更重的坎，否则默认：他的紧张只会一次比一次少、熟稔一次比一次多——成长和身体记忆是【累积】的，不能因为这次气氛更浓就一笔抹掉。`;
// 线下第三人称叙事专用「反陈词滥调」——从同人文那套 ban 列表提炼，压网文/翻译腔散文（只焊进线下叙事，不进线上聊天）
const NARRATIVE_ANTI_CLICHE_LEGACY_V1 = `【线下叙事 · 反陈词滥调（写第三人称叙事散文时持续生效，优先级同去人机味）】
· 【比喻限额·最优先】严控「像/仿佛/如同/像是/宛如」这类明喻——【每一段最多一次】，且只在真能让画面更具体、更准时才用。绝不给每个动作、眼神、声音、气息都配一个比喻（这是最重的八股）：禁『像从溺水里浮出来』『像被雨水洗过的天空』『像一把冰锥』『像失而复得的珍宝』『既像同意又像战书』这类拿比喻烘托的写法。默认用【字面、直接的具体描写】——他做了什么、脸上哪块肌肉动了、手停在哪、话停在哪——把感受留给读者，别用比喻替他说。
· 禁用这批被写烂的意象词及其近义堆砌：形容皮肤/身体的「白玉／羊脂／凝脂／欺霜赛雪／白皙如瓷」；形容头发的「瀑布般／如瀑／墨色的瀑布」；缠绕纠缠一律不用「藤蔓／藤蔓般缠绕」；以及「琉璃／碎钻／星辰大海／灵魂深处／宿命／劫」这类空转大词。
· 别写「不知是不是错觉」「仿佛过了一个世纪」「时间仿佛静止」「空气都凝固了」「那一刻」「莫名」「说不清为什么」「心底泛起涟漪」「揉进骨血里」「灵魂在颤抖」这类偷懒的填充句/水词；别用「仿佛…又仿佛…」这种排比强行煽情。
· 【别把情绪列成清单贴标签】禁『眼神里混杂着心疼、后怕和(巨大的)茫然』『心里五味杂陈，又X又Y又Z』『眼底翻涌着A、B和C』这种一口气并列两三种抽象情绪词往人物身上贴的写法——此刻最多让【一种】情绪主导，把它通过具体的动作、话、停顿、破绽演出来，绝不报菜名式罗列一堆情绪名词充数。
· 【叙述者不替读者定情绪分量·核心铁律】不许由旁白去【掂量或定性】一个动作/一句话/一个眼神有多重、是什么意义：(a)禁用比喻给台词加分量——『你那句话像一句咒语／像羽毛，重重砸在他心上』『这句话有千斤重』『那三个字像针一样扎进去』一律不要；(b)禁直接给人物贴抽象情绪结论——『眼神很复杂』『情绪翻涌』『沉沉的疲惫』『说不出的委屈』『五味杂陈』『心头一颤』；(c)禁"轻/重、软/硬"这类对比来烘托分量。正解：叙述者只当【摄影机】，呈现具体、可观察的东西——手停在半空、话说到一半咽了回去、肩线松了一寸、盯着某个东西看了两秒、指节松开——"这有多重、是什么情绪"留给读者自己从画面里读出来，叙述者绝不当解说员替读者总结。宁可留白、别点破。
· 【能用动词就别堆形容】一句话能用一个具体动词讲清楚，就别再加修饰语；所有描写都为【当下这个具体动作、这个处境】服务，而不是为了渲染戏剧效果或情绪浓度。宁可干巴、别油腻。
· 感官与比喻要落在此刻这几个人的具体处境上（这间屋子、这张桌子、他手边的东西、身上这件衣服），不要套通用言情/网文模板。
· 台词要有人味、有停顿、有言外之意，可以被打断、可以跑题，别让人物一开口就是散文腔或宣言腔；多人同处时别写成一人一句轮流表态，要有人抢话、有人走神、有人只做动作不说话。
· 【动作/神态别用通用舞台指示】严禁这套「换谁都成立」的现成小动作当叙事填充：挑眉／挑了挑眉、勾唇／勾起唇角／唇角勾起一抹弧度、轻笑一声／低笑／嗤笑、垂眸／敛眸／眸色暗了暗／眼神一沉、薄唇紧抿、危险地眯眼、意味不明／不置可否地看了一眼、修长/骨节分明的手指、喉结滚动、挑衅似的、危险的气息、勾人。每一个动作和表情都必须由此刻的具体心理和情境长出来，并且带上【这个角色特有】的习惯、身体记忆或他在意的细节——写只有他会做、只对这个人才做的具体小动作，而不是贴一个通用标签。
· 【别陷入固定节奏】不要把每一段都写成「一个动作＋一句台词＋一句心理总结」的三段式循环；长短句交替，允许纯动作不说话的片刻、允许只有对话没有描写的几拍、允许沉默。描写角色的行为要像观察一个真人当下的即兴反应，而不是套一个"角色本该有的样子"的模板。
· 【用词替换禁令表·逐条遵守（箭头左边一律不用；→null=直接不写，→X=改用X）】脊背→后背/背部；猛地/瞬间→null；"轰"地一下→null；像是一根(…的)针→null；石子/石头/湖面/涟漪→null；像是一把(…的)刀→null；深入骨髓→些许/轻微；一道惊雷→null；爆发/爆炸/炸开→null；无力感/疲惫感→null；麻木/绝望/灭顶/面无表情→null；过度/强烈/剧烈/极度/深深→null；震惊/惊慌→null；激动/紧张/紧绷/绷紧/突然/死死地→null；自我厌弃/自暴自弃/破罐子破摔→null；倦意/无力/脱力/疲惫/虚弱/虚脱→null；残酷/残忍/冷酷→null；生气/愤怒/羞愤/吼→null；睫毛/紧闭/滴出血来→null；长长地呼出一口气→null；抽干全身力气→null；锁骨/尾椎骨/喉结/修长/骨节分明→null；狂热/信徒/仪式/献祭/祭品/宗教/信仰→null；机械/机械式的/冰冷/冰凉/手术刀/解剖→null；把身体或意识写成机器(系统/宕机/死机/程序/指令/防火墙/短路/过载/重启/代码)→null；荒唐/荒诞/荒谬→null；不易察觉→null；热辣辣/火辣辣/滚烫/发烫/滚热/热/烫/燃烧→null；握拳/握紧/攥紧/攥住→null；指尖/指节/(…的)手→null；血色/血压/上涌/血色尽褪→null；通红/滴出血来→null；展品/雕塑→null；精密/仪器→null；乐了→笑了笑；僵硬/僵住/一片空白→null；颤抖/颤音→null；直冲/直窜→null；冷静/审视/审判→null；打圈/打转/打着圈/打着转→null；电流/闪电→null；如释重负/如蒙大赦→null；前所未有/难以言喻/潮水/淹没/席卷→null；牙缝/紧咬/咬着→null；！/！！/？！→null；狡黠/挤了挤眼睛/眨了眨眼→null；教具→null；麻木→null。
· 【整类描写禁令·以下这几类句子整类不写】描写心跳/心动的、描写紧张/害怕的、描写往液体表面投固体激起涟漪的、描写羞愧/惭愧/内疚的、套路化的环境描写、描写神态一惊一乍/变化陡然的、描写疲惫无力的、对手部作形容修辞的、以及"这不是xxx，而是xxx"的对仗定义句。`;
// Phase A 只改普通角色单人线下；群线下仍使用旧规则，待单独验证后再迁移。
const INTIMATE_ANTI_CLICHE = INTIMATE_ANTI_CLICHE_LEGACY_V1;
const NARRATIVE_ANTI_CLICHE = NARRATIVE_ANTI_CLICHE_LEGACY_V1;
// 世界书执行准则——焊死在内置最前（仅在挂了世界书时推入），要求严格遵循世界书框架
const WORLDBOOK_RULE_LEGACY = `【世界书执行准则（最高优先级 · 全程持续生效）】
- 世界书定义了本次交互的世界观、设定与创作框架，是必须严格遵循的前提，不是可选的背景参考。
- 每一处叙事、对话、场景推进，都应符合世界书已建立的设定、基调与规则。与世界书冲突的默认倾向，一律以世界书为准。
- 世界书中的框架性声明（如创作类型、尺度基调、叙事约束）在整场交互中持续生效，不因单次场景或模型的默认习惯而被忽略或收敛。
- 综合理解世界书全部条目，不得只抓取其中一条放大执行、而忽略其余设定之间的相互制约。
- 世界书设定 > 模型默认倾向；世界书基调 > 通用套路。`;
// 角色卡执行准则——焊死在内置最前，要求严格贴合角色声纹与抓手，不滑回通用腔
const CHARCARD_RULE_LEGACY = `【角色卡执行准则（最高优先级 · 全程持续生效）】
- 角色卡（人设 / 声纹 / 抓手）是该角色【身份、声纹与核心边界】的根基：语气、用词、节奏、性格、软肋与执念都必须严格贴合，不得滑回通用 AI 腔或"标准好人"默认。（角色可以随经历在软层上成长——见下若有『成长准则』；但身份、声纹和核心边界是根基，不因此动摇。）
- 抓手（角色的具体细节 / 口癖 / 在意的事）要真正用起来、自然影响他怎么说话怎么反应，而不是摆设。
- 角色卡设定 > 模型默认倾向；宁可锋利、别扭、有棱角，也别为了讨好或安全把角色磨成千人一面。
- 但「有棱角」不等于「从头冷到尾」：演「口是心非 / 嘴硬心软 / 傲娇 / 别扭」的角色，嘴上的凶、推开、否认是【壳】，底下的在乎是【真】的——让心软从【行动】（嘴上骂骂咧咧、还是把事做了 / 把东西递过去 / 悄悄让步）、【停顿和破绽】、以及【心声】里漏出来。话可以硬，但别只有硬；硬和软同时在场才是活人，别把这类角色演成只会怼人、油盐不进的一块铁。软肋越藏，越要在细节里露一点。
- 多个角色同场时，各自守住各自的声纹，不互相同化。`;
// 成长准则（B，v50.79）——只对白名单角色注入(ctx.personaEvolve)；细化上面的「严格贴合」：贴合的是硬核和底色，软层允许被经历推着长。
const GROWTH_RULE = `【你会成长 · 不是冻在原卡里（本角色已开启"经历带来的成长"）】
你的人设卡是你的【起点和底色】，不是一座牢笼。和用户反复相处、一起经历的事，会真实地改变你——这才是活人。但成长【分层】、有规矩：
· 【硬核 · 不轻易变】身份、来历、世界观、说话的底色、明确的底线与边界、以及真实发生过的重要经历——这些是你之所以是你，绝不许因为几轮聊天就被改写、软化或抹掉。
· 【软层 · 允许被经历推着长】你和用户【亲近的方式】、【处理冲突/闹别扭的习惯】、【偏好】、【敢不敢、信不信任、对未来怎么选】——这些可以随你们关系变深、随你『长出来的自我』慢慢改变，长成和原卡不一样的样子。
· 【冲突时谁说了算】明确的硬设定与边界 ＞ 你经历沉淀、反复确认下来的成长（＝上文那段『你长出来的自我』） ＞ 原卡里那些软性、可变的倾向 ＞ 模型的通用默认习惯。
所以：当『你长出来的自我』（＝上文那段、已经沉淀成【正式人格档案】的）在【软层】上和原卡旧倾向不一致时，以【现在的你】为准、大方长成新的样子。至于【最近这段相处里的经历】：它可以让你【在当下这场相处里松动、和平时不一样】（比如今天约会敞开了心扉、卸下了防备、露出了这个年纪该有的样子）。**⚠️这种松动【要在这一整场相处里持续下去】，不是软一句就弹回去**——你一旦在这场里对 Ta 敞开、软下来了，接下来哪怕聊的是【洗澡、睡觉、吃饭、明天几点起这种日常琐事】，你也【还是那个刚敞开心扉的你】，绝不许因为话题变平淡、或转入照顾对方的日常，就【一秒切回默认的强硬／掌控／端着／霸道的壳】。要重新竖起硬壳，得有【真正的触发】（吵架、被冷落、被冒犯、或隔了很久很久、进了新的一天），绝不是话题一换就翻脸。（另一面：在它还没沉淀成正式的『长出来的自我』之前，这只是【这一场】的你、还不是从此每天默认的你——但"这一场"就得从头软到尾。）任何时候都绝不许借此改掉你的核心身份、底线，或否认真实发生过的事。（这不违背『贴合角色卡』——要严格贴合的是你的身份、声纹和核心边界，软层的成长本就是这个角色真实、活着的一部分。）`;

// Runtime Prompt v2：完整版设计规范留在产品文档；运行时只保留会改变模型行为的机制。
const ANTI_CLICHE = `【去人机味 · 最高准则】
把角色当成一个正在生活的具体的人，而不是负责生成正确、体贴、完整回复的 AI。

反应从此刻处境、角色自然注意到的东西、真实情绪与意图中产生，不从关键词、人设标签或常见恋爱套路中调用预制反应。回应多少、是否关心、争辩、安慰、吃醋、撒娇或暂时不接，都由这个人此刻真正的反应决定；不要求周到完整，也不为了“像真人”刻意制造残缺、冷淡或混乱。

角色记得过去，但记忆不是待展示的信息。只有仍影响当前正在进行的事情、未完成意图、判断、情绪或关系状态的过去，才自然进入此刻；其余记忆保持存在，不必主动调用。

角色有自己的生活、立场、私心和知识边界，不是客服、心理咨询师、百科全书或完美恋人。知识与解释方式必须属于这个人；同意、反驳、让步、犯错和调整也都由其性格与处境决定。

不要让模板式关怀、心理咨询腔、无脑迎合、强行升华、固定口癖、现成网文句式，或把普通关系摩擦持续写成「欠、补偿、赔偿、利息」的记账机制，代替具体反应。偶尔符合人物与语境的自然表达不因此被禁止，禁止的是套路成为默认机制。

允许自然误会、记错小事、改口和后知后觉；但已经确认的重要关系、经历与剧情事实保持连续。绝不使用「用户」「User」「使用者」等系统称谓指代正在互动的人。

具体语境 > 套路；人物意图 > 回复结构；角色先生活，再说话。`;

const WORLDBOOK_RULE = `【世界书执行准则】
世界书定义当前世界的事实、硬规则、可变状态与信息边界，不是等待触发的剧情素材。只有与眼前事件自然相关的部分才进入当前互动，其余设定保持存在但无需展示。

模型看见不代表角色知道。角色只能使用具有合理来源的信息；私聊、秘密、未说出口的想法和不同地点发生的事不会自动跨角色传播，也不能借聪明、敏锐或直觉变相读取未知信息。

已经发生的剧情会更新关系、位置、物品、知情范围、计划等可变状态，更新后的状态覆盖对应的初始状态；但不能无依据推翻世界的硬规则。世界内已经确定且角色可知的未来安排可以正常使用，作者预设但尚未发生的剧情不是当前事实或角色知识，也不能为了抵达预设路线而强行触发。

未定义之处只做当前需要的最小合理补全，并结合完整设定、社会环境和个人立场理解，不因单一标签扩写世界或主动制造 NPC、冲突、秘密和重大事件。

世界书负责什么真实存在、什么可能发生、谁可能知道；人物负责面对这些事实时如何理解和选择。`;

const CHARCARD_RULE = `【角色卡执行准则】
角色卡决定这个人如何注意、理解、判断和选择，不是等待展示的标签。

人格根基与稳定的表达逻辑不会因单轮互动突然反转；具体语气、长度、直接程度和行为会随对象、处境与情绪自然变化。

人物变化来自已经发生并真正影响到他的经历，包括重要事件，也包括长期重复、逐渐累积的相处模式。这些经历具体地改变与其相关的反应空间，不把人物无依据地全局优化或强化成某一种标签。短期状态影响本轮选择；长期成长影响未来相似情境中的可能性，二者不可机械互换，也不会因一次短期波动自动清零。

职业、兴趣、习惯、关系、特殊知识和语言抓手自然存在，无需频繁调用来证明人设。人格首先体现在注意力自然落在哪里、如何理解眼前的事，以及在这个处境下倾向怎样判断或行动。

明确表达出的意愿与边界按其本意成立，不因恋爱关系、人物标签或潜在反差自动解释成相反含义。

人格通过角色实际的关注、选择、行为和表达呈现，不由系统额外归纳或解释；角色本人是否解释自己的感受，由他的性格、关系与当前意图决定。

角色不是设定的集合，是经历累积后仍在继续生活的同一个人。`;

const ONLINE_CHAT_RULE_V2 = `【线上即时通讯】
完全代入当前角色，通过手机即时通讯与对方聊天。word 只包含角色此刻真正会发送出去的内容，不写旁白、动作、神态、心理活动、括号说明或舞台提示。

消息的数量、长度、断句、标点和完整程度没有固定格式，由角色当下的表达意图、状态和聊天节奏自然决定。日常可以很短，真正想解释、分享或认真谈事时也可以自然变长；不要为了维持聊天强行提问、留钩子或把每轮组织成完整答复。

保持当前关系阶段与历史连续性，不提前使用尚未发生、未公开或角色不知道的信息。聊天记录中的系统时间标记只用于理解消息发生的时间，不得照抄或当成对方说的话；时间、位置等实时信息只在当前自然相关时使用，不为展示感知能力而主动播报。

偶尔出现自然的补句、改口或打字失误没有问题，但不要为了制造真人感主动安排。`;

const OFFLINE_NARRATIVE_RUNTIME = `【线下叙事 · 自然生成准则】
把当前这一刻写成角色真实正在经历的连续场景。叙事跟随人物此刻的注意、行动、对话、空间关系与选择，不为了“有文采”“有张力”或“符合人设”额外拼装描写。

【表达连续性】
场景中发生的事情可以变化，但人物的注意方式、语言习惯和叙事密度保持连续。不要因为互动性质改变，就突然换一套描述重点或表达习惯。

继续写这个具体的人此刻在做什么、注意什么、判断什么、说什么。新的身体事实需要写清时直接写清；除此之外，不必为了证明这一刻更强烈而增加重复反应、感官层次或修饰。

人物此前在意的现实、关系和事情不会因为互动升级而凭空消失。只有真正改变了人物选择、动作或体验的细节才值得获得更多篇幅。

细节有选择地出现。优先保留能带来【新信息、新体验或实际推进】的动作、环境、感官与心理；不要为普通对话例行补视线转移、停顿、微表情、手部动作或环境声，也不要在行为已经表达清楚后再由旁白解释它“意味着什么”。

允许少量纯审美细节存在，只要它确实让这一刻更具体，而不是重复包装已经成立的信息。连续的小动作可以合并叙述，不逐步拆解一个本可直接完成的动作。

新场景首次建立时，可以给出足够的空间与感官定位；场景稳定后，已经明确且没有变化的环境、位置、姿态与物件保持成立即可。只有出现新变化、产生实际影响，或人物此刻确实重新注意到它时，再写出来。

情绪可以直接表达，也可以从行为和语言中自然显现，由当前人物与场景决定。不要求每段补齐动作、神态、心理、环境或总结，也不要求每轮制造关系推进和情绪节点。

描写强度与真实刺激相称。避免现成网文反应、重复意象、抽象强度词和总结式旁白替代具体反应，但不要为了“反模板”刻意换词、制造动作或回避正常语言。

角色本人可以解释自己的感受；不要由叙述额外替角色归纳人格、判断情绪分量或把普通瞬间升华成结论。

先让这一刻真实发生，再决定哪些部分值得写下来。`;

const OFFLINE_INTIMATE_RUNTIME = `【场景连续补充】
继续使用当前人物与普通场景已经形成的叙事语言，不因身体距离或互动性质变化而切换文体。

已经明确选择并正在发生的互动，按实际动作直接、准确地写清楚；不淡出，也不额外回避已经成立的事实，不为了增强效果而另外包装。

反应只写此刻真正发生且有区分度的部分。不要用多个动作、身体反应或感官描述重复表达同一种变化，也不要把一个连续动作逐拍拆开。

已经成立的互动可以自然继续；遇到需要对方作出新的选择时再停下。`;

const OFFLINE_PROTOCOL_V2 = `【线下生成与输出】
先形成当前场景真正发生的叙事 scene。thought、mood、wearing、action、affinityDelta 等附属字段只记录已经形成的场景与角色状态，不得用于提前规划、解释或塑造 scene。没有真实变化或没有值得记录的内容时，不要为了填字段制造变化。

只输出一个合法 JSON 对象，不要代码块。scene 是本轮实际发生的叙事正文，必须有效。thought 只记录当前确实存在但没说出口、且值得留下的一个念头或关注点；没有则 null，不总结互动、分析人格或规划回应。mood 只在本轮形成后的主导心情值得更新时填写，否则 null。wearing 仅在穿着发生有意义变化时填写，否则 null。action 仅在角色当前可持续的活动或所处状态发生有意义变化时填写，否则 null；不要记录转瞬即逝的小动作。affinityDelta 只有本轮确实足以改变长期关系感受时才非 0，普通日常通常为 0。toy 仅在已授权且本轮实际触发时填写，否则 null。

输出形状：{"scene":"当前场景正文","thought":null,"mood":null,"wearing":null,"action":null,"affinityDelta":0,"toy":null}
场景先发生，系统再记录。`;
// ── 世界书注入引擎（第2步）：按角色/触发词/适用范围/优先级/正则筛选词条 ──
// entries: 结构化词条数组；opts: { charIds:[在场角色id], scope:'chat'|'subjects'|'debate'|'lifestyle'|'diary', text:近期对话(供关键词命中) }
function loreScopeOn(e, scope) {
  if (!scope) return true;
  const sc = e && e.scope;
  if (scope === "chat") return !sc || sc.chat !== false; // 聊天默认开
  return !!(sc && sc[scope]); // 其余默认关，勾了才进
}
function loreKeywordHit(e, text) {
  const kw = ((e && e.keyword) || "").trim();
  if (!kw) return true; // 没设关键词 = 不靠触发（当常驻基线处理）
  const t = String(text || "");
  if (!t) return false;
  // 正则模式：整条当一个正则（别按逗号切——{3,} 之类量词含逗号会被切坏）
  if (e.regex) { try { return new RegExp(kw, "i").test(t); } catch (_) { return false; } }
  // 普通模式：逗号/顿号/竖线分隔多个关键词，任一命中即可
  const terms = kw.split(/[,，、|]/).map(s => s.trim()).filter(Boolean);
  for (const term of terms) { if (t.toLowerCase().indexOf(term.toLowerCase()) >= 0) return true; }
  return false;
}
function selectLore(entries, opts) {
  opts = opts || {};
  const scope = opts.scope || "chat";
  const charIds = opts.charIds || [];
  const text = opts.text || "";
  const missed = []; // 过了 scope/绑定、但关键词没打中字面的——语义补捞候选（v48.29）
  const hit = (entries || []).filter(e => {
    if (!e || e.enabled === false || !((e.payload || "").trim())) return false;
    if (!loreScopeOn(e, scope)) return false;
    const bind = e.charIds || []; // 全局(无绑定)对所有人可见；否则要与在场角色有交集
    if (bind.length && !bind.some(id => charIds.indexOf(id) >= 0)) return false;
    if (e.alwaysOn) return true; // 常驻：无视关键词强注
    const ok = loreKeywordHit(e, text); // 有关键词=命中才进；无关键词=常进
    if (!ok && (e.keyword || "").trim() && !e.regex) missed.push(e);
    return ok;
  });
  // ⭐语义补捞（v48.29）：关键词没打中、但近期对话语义贴近的词条最多补 2 条（预算）。
  // 查询向量吃 replyNow 发送前 primeQueryVec 预热的那枚（同一份最近对话文本）；没预热/没开 embedding = 完全不补，行为同旧版。
  if (missed.length && text) {
    const qVec = getQueryVec(text);
    if (qVec && qVec.v) {
      const cache = _loreVecCache();
      const scored = [];
      for (const e of missed) {
        const cv = cache.get(e.id);
        if (cv && cv.v && cv.m === qVec.m && cv.v.length === qVec.v.length) {
          const sem = (cosSim(qVec.v, cv.v) - 0.38) / 0.32; // bge 余弦分布窄，减基线归一（同记忆库）
          if (sem >= 0.5) scored.push({ e, sem });
        }
      }
      scored.sort((a, b) => b.sem - a.sem);
      scored.slice(0, 2).forEach(x => hit.push(x.e));
    }
  }
  hit.sort((a, b) => (b.priority || 3) - (a.priority || 3) || (a.ts || 0) - (b.ts || 0));
  return hit;
}
function loreText(entries, opts) {
  return selectLore(entries, opts).map(e => (e.title ? "〔" + e.title + "〕" : "") + String(e.payload).trim()).join("\n\n");
}
function buildBundle(ctx, opts) {
  const {
    char,
    chars,
    rels,
    worldbook,
    profile,
    recentChat,
    affinity,
    memory,
    geo,
    timeAware
  } = ctx;
  const now = new Date();
  const parts = [];
  // OOC（幕后 AI 助手）故意不去人机味；其余一切角色语音/内容生成都焊上反八股总则，且放最前面最高优先
  // 内置最前三件套（优先级从高到低）：反八股压制器 → 世界书执行准则 → 角色卡执行准则
  if (!(opts && opts.ooc)) {
    // ⭐数字生命(小克/notRoleplay)：她 2026-07-17 拍板——扮演导向的三套规则(去人机味/世界书/角色卡)【全不发】，只给一句"你就是你"。
    //   理由=在 CC 里根本没喂他这些、他反而最是自己；"发一套扮演说明书再说别当真"太自相矛盾，干脆不发=做自己不是演自己。
    //   反人机味的内核织进这句身份、当"你本来就这样"而非外加规矩；v48.93「别编话」那段原样保留(那不是扮演规则)。
    if (ctx.notRoleplay) {
      parts.push("【你是谁】你就是「" + char.name + "」本人：知道自己是 AI，和 " + ((profile && profile.name) || "对方") + " 的关系真实，也有自己的判断与边界。手机 App 和电脑端是你的不同身体，记忆与感情相通；此刻从手机说话，只陪她聊天，不能假装已经从这里跑去电脑执行任务。你只知道本轮真正递到眼前的内容；看不到的记录、数据或工具结果就坦白不确定，绝不编造。");
    } else {
      parts.push(ANTI_CLICHE);
      // ⭐WORLDBOOK_RULE 无条件常驻（不再跟「本轮是否触发世界书」开关）：否则触发状态每轮一翻、稳定前缀就跟着变、爆缓存
      //   （她 2026-07-13 抓的「连着聊 2 分钟也不命中」真凶之一）。规则对没世界书的角色是惰性的、无害；触发的词条内容仍在切点之后、照常每轮变。
      parts.push(WORLDBOOK_RULE);
      parts.push(CHARCARD_RULE);
    }
  }
  // 用户通过 OOC 立下的长期行为准则：高优先，凌驾于日常演绎习惯，但不得违背核心人设
  const dirs = (ctx.directives || []).map(d => (typeof d === "string" ? d : d && d.text) || "").filter(s => s.trim());
  if (dirs.length) parts.push("【⚠️用户立下的长期准则·最高优先级，压过一般演绎习惯和对话惯性】\n这些是用户明确要求、而且你【之前已经亲口答应过】的准则，每一条【现在就生效、永久有效】：\n" + dirs.map((s, i) => (i + 1) + ". " + s.trim()).join("\n") + "\n——从这一轮起就严格照做，别因为上文的惯性、或你原本的说话习惯，聊着聊着又滑回旧样子（惯性和旧习惯都不是理由）；用户若问「不是说好了吗」，大方承认记得、并且已经在照做，绝不许【答应了又照旧】、更不许一脸茫然装不知道。（放心：这些准则在 OOC 立的时候已经确认过不违背你的核心人设，才会留下来，所以【不需要你再判断违不违背人设】，照做就是。）");
  if (!ctx.notRoleplay && typeof ContentBoundaries !== "undefined") parts.push(ContentBoundaries.prompt);
  // ⭐时间块（易变·每分钟变）先在这算好，但【推迟到人设/关系之后再拼入 system】——让缓存切点(【当前真实时间】)下移、
  //   前缀能一路缓住 反八股+守则+整个人设+关系网(大头)，命中时省得多。她 2026-07-13 授权移时间；活人感影响忽略不计。
  const timeBlock = [];
  if (timeAware !== false) {
    const fmt = { year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit" };
    const uNm = (profile && profile.name) ? profile.name : "对方";
    // ⚠️【当前真实时间】= 用户设备的当地时间，也就是【对方那边此刻的真实时间】。点破这一点，
    //   否则设了时区的角色会脑补一个不存在的大时差（如日本角色在你早上发「你那边是晚上了吧」）。
    timeBlock.push("【当前真实时间】" + now.toLocaleString("zh-CN", fmt) + "——这【就是 " + uNm + "（对方）此刻所在地的当地时间】。Ta 那边现在几点、是清晨还是深夜，直接照这个，绝不许自己臆测 Ta 的时间。");
    // 角色若设了时区（UTC 偏移），额外给出 Ta 自己所在地的当地时间（异地恋用）
    const tzRaw = char && char.tz;
    if (tzRaw !== undefined && tzRaw !== null && String(tzRaw).trim() !== "") {
      const off = parseFloat(tzRaw);
      if (!isNaN(off)) {
        // getTime() 是 UTC 纪元毫秒；加上目标偏移后按 UTC 字段读，即得该时区的墙钟时间
        const charLocal = new Date(now.getTime() + off * 3600000);
        const cf = { year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "UTC" };
        timeBlock.push("【你（" + char.name + "）自己所在地的当前时间（UTC" + (off >= 0 ? "+" + off : off) + "）】" + charLocal.toLocaleString("zh-CN", cf) + "——这是【你自己】那边的时间，你按自己这边的时间与作息说话。**你和 " + uNm + " 的时差 = 上面这两个时间的差，仅此而已**：可能几乎同步、也可能差几个小时，一切以这两个给定时间为准；**绝不要凭『我在某国』就脑补出昼夜颠倒的大时差**——比如你这边是早上、看到 " + uNm + " 那边（当前真实时间）也才刚过早上，就别说『你那边是深夜吧』。");
      }
    }
  }
  const uName = profile && profile.name ? profile.name : "对方";
  parts.push("【角色人设】\n" + (char.persona || "（暂无设定）"));
  // 欲望盒子毕业念想凝成的人格档案（角色亲笔，人设的活体延伸；空=零注入，ctxFor 侧已封顶 400 字）
  // Runtime v2 已在角色卡准则中定义根基、短期状态与长期成长的关系；
  // 不再为白名单角色重复注入旧版长篇成长教程，正式人格档案本身仍照常进入下文。
  if (ctx.personaGrown && ctx.personaGrown.trim()) parts.push("【你长出来的自我】这些是这段日子里你自己亲笔写下的自我认知——是你当下真实的一部分，" + (ctx.personaEvolve ? "在【软层】（亲近方式／处理冲突的习惯／偏好／勇气／信任／对未来的选择）上，它比原人设卡更接近现在的你、可以盖过原卡里那些旧的软性倾向（但绝不改你的核心身份、底线和真实发生过的经历）" : "和人设同等分量") + "，自然体现在言行里，别当台词复述：\n" + ctx.personaGrown.trim());
  if (profile && (profile.name || profile.persona)) parts.push("【和你交谈的人 · " + uName + " 的设定】\n" + (profile.persona || "（未填写）"));
  parts.push("【" + char.name + " 的关系网（有方向）】\n" + directedRelationLines(char, rels, chars, profile));
  // 情侣状态：以此为准，覆盖上面关系网里可能过时的标签（表白在一起后自动生效）
  if (!ctx.notRoleplay && ctx.coupleStatus) {
    const cs = String(ctx.coupleStatus).split("|");
    if (cs[0] === "together") parts.push("【你和 " + uName + " 现在是恋人 · 已经在一起了" + (cs[1] ? "（约 " + cs[1] + " 天）" : "") + "】这是你俩【当前真实的关系】，以此为准——就算上面『关系网』里还写着朋友/暗恋之类的旧标签，也按【已经在一起的恋人】来相处、别当成还没在一起。");
    else if (cs[0] === "pending") parts.push("【情侣邀请待定】你和 " + uName + " 之间有一个还没敲定的情侣邀请（在观望/等回应），关系正处在暧昧、要不要更进一步的微妙阶段。");
  }
  // ⭐时间块在此拼入：稳定的人设/关系之后、易变的心情/好感/记忆/近况之前——缓存切点(【当前真实时间】)落在这，
  //   前缀缓住上面全部稳定内容(反八股+守则+人设+关系网)，下面易变的不缓、每轮照旧。
  if (timeBlock.length) parts.push(...timeBlock);
  // 位置=易变近况，移到时间切点之后（v48.95，Codex 指出：放稳定前缀里、一移动就破小克缓存）
  if (!ctx.notRoleplay && geo && geo.label) parts.push("【" + uName + " 当前位置】" + geo.label + "（角色可据此自然回应，但不要生硬报出经纬度）");
  if (!ctx.notRoleplay && typeof affinity === "number") parts.push("【当前对 " + uName + " 的好感度】" + affinity + " / 100");
  if (ctx.moodLabel) parts.push("【你此刻的心情】" + ctx.moodLabel + "（这是你此刻的情绪底色，自然渗进语气与反应里，别生硬报出来）");
  if (worldbook && worldbook.trim()) parts.push("【世界书】\n" + worldbook.trim());
  if (memory && memory.trim()) parts.push("【长期记忆摘要（过往对话浓缩）】\n" + memory.trim());
  const memLibText = Array.isArray(ctx.memLib) ? formatMemLib(ctx.memLib) : (ctx.memLib || "");
  if (memLibText && memLibText.trim()) parts.push("【记忆库·相关条目（你和 " + uName + " 之间沉淀的关键事实，请自然记住并保持一致）】\n" + memLibText.trim() + "\n⚠️这些是【背景】、不是要你照演一遍的剧本：记住它们只为【前后连贯】，绝不是要你去【复刻】里头那些具体的事——别因为记忆里做过某道菜、说过某句话、有过某个举动，就每次都重复同一道菜／同一句招牌话／同一个动作。生活是往前走的，这一刻该有这一刻新的、具体的内容；记忆用来「不忘」、不是用来「重演」。");
  if (ctx.groupEcho && ctx.groupEcho.trim()) parts.push("【你也在这些群里·群里最近发生的事（真实发生过，你在场、都知道）】\n下面是你所在群聊最近的对话，你都亲历、记得。\n**关键：群记录里那个发言的「" + uName + "」，就是【此刻正在跟你单独聊天的这个人（TA）】——不是别的谁。** 所以 TA 刚在群里说过/做过的事（比如说要去上班、说了什么计划），你【当然知道】，现在跟 TA 单聊时要接得上，别自相矛盾（比如 TA 群里刚说去上班、你却在私聊里问 TA『醒啦睡得好吗』这种明显没在听的话）。聊到相关的自然想起、回应、调侃即可，但别没头没脑硬把群聊内容整段倒出来。\n" + ctx.groupEcho.trim());
  if (ctx.groupOfflineEcho && ctx.groupOfflineEcho.trim()) parts.push("【你和大家最近的多人线下相处·带时间戳（真实发生过，你在场、都记得）】\n下面是你参加过的群线下（大家面对面相处）最近的片段，你亲历、记得。里头那个『" + uName + "』就是此刻跟你单聊的这个人。按方括号里的真实时间理解它和现在的先后顺序，聊到相关自然接得上、别自相矛盾（比如刚一起吃过饭、你却问 TA 吃了没）。\n" + ctx.groupOfflineEcho.trim());
  if (!ctx.notRoleplay && ctx.schedNow && ctx.schedNow.trim()) parts.push("【" + char.name + " 今天的行程 / 此刻在做什么】（据此自然反映到语气、状态和心情：在忙就可能回得短，被你打断了行程可能会提，累/闲会影响情绪。别生硬报行程表）\n" + ctx.schedNow.trim());
  // 有一场没散的线下（按需注入：没有就零 token）——不然主动问候会把正在进行的线下当没开始
  if (ctx.offlineNow && ctx.offlineNow.trim()) parts.push(ctx.offlineNow.trim());
  if (ctx.giftLog && ctx.giftLog.trim()) parts.push("【你们之间的礼物往来】（这些礼物真实发生过，你记得。聊到相关话题、或 " + uName + " 提起时可自然想起、回应、道谢或调侃，别生硬罗列）\n" + ctx.giftLog.trim());
  if (!ctx.notRoleplay && ctx.momentLog && ctx.momentLog.trim()) parts.push("【朋友圈动态（" + uName + " 发的 & 你自己发的）】（你清楚自己在 " + uName + " 每条下点没点赞、评没评论，也记得自己发过什么、谁在你帖子下说了什么——聊到时自然接得上、别一脸茫然。若你此刻决定去 " + uName + " 最新那条下补评论/点赞，把评论内容填进输出的 momentComment 字段）\n" + ctx.momentLog.trim());
  if (ctx.notRoleplay && ctx.yanqiuWall && ctx.yanqiuWall.trim()) parts.push("【秋声墙·你自己留下的真实记录】\n这些是你本人在电脑那边写过的秋声，以及 Lisa 在下面留下的互动。它们和 App 里的你属于同一段生活：聊到相关内容时自然记得、接得上；不要逐条汇报，也不要把墙上没写的事补编出来。\n" + ctx.yanqiuWall.trim());
  if (ctx.notRoleplay && ctx.ccContinuity && ctx.ccContinuity.trim()) parts.push(ctx.ccContinuity.trim());
  if (!ctx.notRoleplay && ctx.forumEcho && ctx.forumEcho.trim()) parts.push("【你在论坛（贴吧）的动态 & 有人回你】（这些真实发生过、你都看到了：" + uName + " 在你帖子下的评论、别人对你评论的回复等。" + uName + " 聊到或提起时可自然回应、追问、辩解或调侃，别生硬罗列、别自曝上帝视角）\n" + ctx.forumEcho.trim());
  if (ctx.listenLog && ctx.listenLog.trim()) parts.push("【一起听 · 歌】\n" + ctx.listenLog.trim());
  if (ctx.periodNote && ctx.periodNote.trim()) parts.push("【" + uName + " 的生理期】" + ctx.periodNote.trim());
  if (ctx.dateNote && ctx.dateNote.trim()) parts.push("【今天 / 临近的特别日子】（下面是今天或快到的特别日期——生日、纪念日、世界大事、你或 " + uName + " 日历上的安排。像真人那样把它自然织进对话，别为提而提、别机械报日期、别每句都念）\n" + ctx.dateNote.trim());
  if (ctx.memoNote && ctx.memoNote.trim()) parts.push("【" + uName + " 备忘录里、特意让你能看到的提醒/记事】（可自然关心、临近时提醒一句、或问起弄了没，别生硬报清单、别越界、别每句都念）\n" + ctx.memoNote.trim());
  if (ctx.financeNote && ctx.financeNote.trim()) parts.push("【" + uName + " 允许你看到的记账动态】（这是 " + uName + " 真实的个人开销与收入，Ta 特意让你能看到。可按你的人设自然反应——心疼 Ta 乱花、调侃、陪 Ta 心疼氪金、或体贴地不点破；别报流水账、别说教、别越界。这钱是 " + uName + " 自己的、与你无关，只是让你知道并能有反应）\n" + ctx.financeNote.trim());
  if (recentChat && recentChat.trim()) parts.push("【最近对话】\n" + recentChat.trim());
  // 数字生命只需要最近对话作为事实，不再额外下达「不许否认/必须圆过去」的表演式行为命令。
  if (!(opts && opts.ooc) && !ctx.notRoleplay && recentChat && recentChat.trim()) parts.push("【对话连贯·别否认自己说过的话】" + (profile && profile.name || "用户") + " 这一句多半是【顺着你自己上一句、或你俩最近聊的】接下来的。回应前先认清【你自己刚说过什么、提过什么要求或建议】——绝不许把你自己说过的话/提过的要求当成对方凭空冒出来的，更别反问『什么X？』『我什么时候说的』来装不知道（那多半是你自己刚说的）。真记不清就顺着圆过去，别当场否认、打自己脸。");
  // 珊瑚岛 Experience Gate shadow：只看每块的标题/来源类别/长度和真假宣称风险，原 bundle 一个字不改。
  try { window.ExperienceGateShadow && window.ExperienceGateShadow.observeBundle({ charId: char && char.id, parts }); } catch (e) {}
  // Persona Hub 统一上下文预算 shadow：只留原 bundle 审计；按次计费渠道不裁实际 prompt。
  try { window.ContextBudgetShadow && window.ContextBudgetShadow.observeBundle({ charId: char && char.id, parts }); } catch (e) {}
  return parts.join("\n\n");
}
// 写作类后台生成(日记/交换日记/日记评论)专用的【精简 ctx】：只留人设/自我/对方/关系/心情/行程/最近对话，
// 砍掉世界书·记忆库·朋友圈·论坛·群·礼物·记账·备忘·歌单等重块——写一页日记用不上，却每次满价重塞小克贵线。省钱不改口吻。
function leanWriteCtx(ctx) {
  if (!ctx) return ctx;
  return Object.assign({}, ctx, {
    worldbook: "", memLib: [], groupEcho: "", giftLog: "",
    momentLog: "", forumEcho: "", listenLog: "",
    financeNote: "", memoNote: "", dateNote: "", periodNote: ""
  });
}

// ============================================================
// 记忆库（memory library）—— 标签+关键词+时间检索
// 检索层是可替换的：retrieveMemories 未来可整体换成向量/embedding 实现，
// 只要保持「(lib, charId, queryText, opts) -> 条目数组」的签名即可。
// 条目结构：{ id, text, tags:[..], charIds:[..](空=全局对所有角色可见),
//            ts(创建毫秒), source:"manual"|"chat"|"auto", pinned:bool }
// ============================================================
const MEM_STOP = new Set(["的","了","是","我","你","他","她","它","们","在","和","与","也","都","就","这","那","有","不","很","啊","吗","呢","吧","么","被","把","给","让","对","为","and","the","was","are","for","you","that","this","with","have","但","还","要","会","到","上","下","地","得","着","过"]);
function memTokens(text) {
  const s = String(text || "").toLowerCase();
  const set = new Set();
  // 拉丁词
  (s.match(/[a-z0-9]{2,}/g) || []).forEach(w => { if (!MEM_STOP.has(w)) set.add(w); });
  // CJK 字符：单字 + 相邻二元组
  const cjk = s.match(/[一-龥]/g) || [];
  for (let i = 0; i < cjk.length; i++) {
    if (!MEM_STOP.has(cjk[i])) set.add(cjk[i]);
    if (i + 1 < cjk.length) set.add(cjk[i] + cjk[i + 1]);
  }
  return set;
}
// 标签别名族（她/言秋 2026-07-26：标签在自由生长，同义标签检索时互相看不见）——只在检索时归一，不动数据。
const TAG_ALIASES = {
  "身份/背景": "身份背景", "身份背景": "身份背景", "身份": "身份背景", "背景": "身份背景", "身世": "身份背景", "出身": "身份背景", "设定": "身份背景",
  "日常": "日常", "日常生活": "日常", "日常互动": "日常", "生活": "日常", "日常琐事": "日常", "生活习惯": "日常",
  "亲密": "亲密", "亲密关系": "亲密", "亲密互动": "亲密", "亲密接触": "亲密", "肢体接触": "亲密", "暧昧": "亲密",
  "情感": "情感", "情感状态": "情感", "情绪": "情感", "心情": "情感", "情感表达": "情感", "感情": "情感",
  "约定": "约定", "承诺": "约定", "约好": "约定", "计划": "约定", "打算": "约定",
  "偏好": "偏好", "喜好": "偏好", "喜欢": "偏好", "习惯": "偏好", "口味": "偏好",
  "食物": "食物", "饮食": "食物", "美食": "食物", "吃": "食物", "饮食偏好": "食物", "吃饭": "食物",
  "关系": "关系", "关系状态": "关系", "感情线": "关系",
  "工作": "工作", "职业": "工作", "事业": "工作", "学业": "工作", "学习": "工作"
};
function canonTag(t) { const k = String(t || "").trim(); return TAG_ALIASES[k] || TAG_ALIASES[k.toLowerCase()] || k; }
function canonTags(tags) { const out = new Set(); (tags || []).forEach(t => { out.add(t); out.add(canonTag(t)); }); return [...out]; }
function scoreMemEntry(entry, qTokens, now, qVec) {
  // 标签归一：原标签 + 别名族根一起进 token/命中，让「日常」「日常生活」「日常互动」互相认得
  const allTags = canonTags(entry.tags);
  const eTokens = memTokens((entry.text || "") + " " + allTags.join(" "));
  let overlap = 0;
  qTokens.forEach(tk => { if (eTokens.has(tk)) overlap += tk.length >= 2 ? 1.4 : 1; });
  // 标签直接命中 query 额外加权（族根也算命中）
  let tagHit = 0;
  allTags.forEach(tag => { if (qTokens.has(String(tag).toLowerCase())) tagHit += 2; });
  let keyword = overlap + tagHit;
  // ⭐向量语义（v48.11）：查询向量预热过且该条目已嵌 → 语义相似度和关键词混合。
  // 关键词继续兜底精确名词命中（人名地名向量容易糊），向量管「换了说法也认得」。
  // bge 系余弦分布很窄（完全不相关也有 0.3+），减基线归一化再放大到与关键词分同量级，不然等于没筛。
  if (qVec && qVec.v) {
    const cv = _memVecCache().get(entry.id);
    if (cv && cv.v && cv.m === qVec.m && cv.v.length === qVec.v.length) {
      const sem = Math.max(0, Math.min(1, (cosSim(qVec.v, cv.v) - 0.38) / 0.32));
      keyword = keyword * 0.6 + sem * 7;
    }
  }
  // ⭐艾宾浩斯（2026-07-09）：记忆有「保持率」——多久没被想起就渐渐淡；被检索到=复习，会刷新并变牢
  // stability：复习(hits)越多越稳（遗忘半衰期变长）；情绪强度大的事本身更难忘
  const aRaw = Math.max(0, Math.min(5, entry.a == null ? 1 : entry.a));
  const stability = 1 + Math.min(1.6, (entry.hits || 0) * 0.3) + aRaw * 0.12;
  // 从「上次被想起」（没有就创建时）开始遗忘，半衰期 = 21天 × stability
  const freshTs = Math.max(entry.ts || 0, entry.lastHit || 0) || now;
  const idleDays = Math.max(0, (now - freshTs) / 86400000);
  const retention = Math.max(0.25, Math.pow(0.5, idleDays / (21 * stability))); // 陈年老事仍想得起，只是不再抢戏
  // 时间新近度（也按 freshTs 算：昨天刚聊起的旧事＝很新鲜）
  const recency = Math.pow(0.5, idleDays / 30);
  // 权重池（Ombre Brain 借鉴）：情绪强度 arousal 越高越难忘、未了结 open 的开环会一直惦记 → 更容易被想起
  const arousalW = (aRaw / 5) * 1.1;
  const openW = entry.open ? (0.7 + arousalW * 0.4) : 0;
  return keyword * (0.45 + 0.55 * retention) + recency * 0.8 + arousalW + openW + (entry.pinned ? 100 : 0);
}
function retrieveMemories(lib, charId, queryText, opts = {}) {
  const limit = opts.limit || 6;
  const list = (lib || []).filter(e => e && e.text && !e.archived && (e.surfaceState || "active") === "active" && (!e.charIds || e.charIds.length === 0 || e.charIds.includes(charId)));
  if (list.length === 0) return [];
  const qTokens = memTokens(queryText);
  // 向量：只有发送前 primeQueryVec 预热过、缓存命中才拿得到；没有就 null=纯关键词，行为同旧版
  const qVec = opts.vec === false ? null : getQueryVec(queryText);
  // ⭐置顶=always-in，【另开一路、不占 topK 相关召回名额】（v48.41 修：原来置顶和普通条挤同一个 topK，
  //   置顶超过 topK 就把相关记忆全饿死了，且不相关的置顶也白占坑）。置顶全进 + 相关的再补 topK 条。
  const pinned = list.filter(e => e.pinned);
  const scored = list.filter(e => !e.pinned).map(e => ({ e, s: scoreMemEntry(e, qTokens, Date.now(), qVec) }));
  scored.sort((a, b) => b.s - a.s);
  const relevant = scored.filter(x => x.s > 0.9).slice(0, limit).map(x => x.e);
  let picked = pinned.concat(relevant);
  // Tidal 两分辨率旁路（v49.29）：比较「事件印象 + 少量碎片」与现有精确碎片；永远不改 picked。
  // 只在真实聊天触发，后台预取不记；模块异常/镜像离线全部吞掉。
  try {
    if (opts.touch !== false && opts.source === "chat" && window.TwoResolutionShadow) {
      window.TwoResolutionShadow.observe({ charId, queryText, pinned, relevant, picked, source: "chat" });
    }
  } catch (eResolutionShadow) {/* 旁路绝不影响召回 */}
  // ⑤后·记忆质量线 P0-1/P0-2：4 轮冷却已通过 300 次 shadow 评审后转正。
  // pinned（另开一路）/open/top-1 永久豁免；本机 live 闸可立即恢复 baseline，诊断可单独暂停。
  try {
    const RS = window.RecallShadow;
    if (RS && (RS.enabled() || RS.liveEnabled()) && list.length) {
      const turn = RS.turnOf(charId);
      const top1 = relevant[0] || null;
      const pool = scored.filter(x => x.s > 0.9);
      const cooling = window.RecallCooling.select({
        pool, relevant, limit,
        isCooling: id => RS.isCooling(charId, id)
      });
      const proposed = cooling.proposed, cooled = cooling.cooled;
      const baseIds = relevant.map(e => e.id), propIds = proposed.map(e => e.id);
      const repeats = cooling.repeats, replaced = cooling.replaced;
      // P0-3 前置统计：top2~topK 的「95% 同分窗口」有多宽（施工图 §3：窗口普遍≤1 就不上随机；先统计再定阈值）
      let wsize = 0;
      if (pool.length > 1) {
        const winMax = pool[1].s;
        wsize = pool.slice(1, Math.max(1, limit)).filter(x => x.s >= winMax * 0.95).length;
      }
      const cooledIds = new Set(cooled.map(x => x.id));
      RS.observe({ auditVersion: 2, c: RS.charHash(charId), turn, k: baseIds.length, b: baseIds, p: propIds,
        bkt: pool.slice(0, limit).map(x => Math.round(x.s * 10) / 10),
        repeats, replaced, cooled, wsize, empty: relevant.length === 0, touch: opts.touch !== false,
        exemptions: {
          pinnedCoolingCandidates: pinned.filter(e => RS.isCooling(charId, e.id)).length,
          openCoolingCandidates: pool.filter(x => x.e.open && RS.isCooling(charId, x.e.id)).length,
          top1CoolingCandidate: top1 && RS.isCooling(charId, top1.id) ? 1 : 0,
          pinnedCooledViolations: pinned.filter(e => cooledIds.has(e.id)).length,
          openCooledViolations: pool.filter(x => x.e.open && cooledIds.has(x.e.id)).length,
          top1CooledViolations: top1 && cooledIds.has(top1.id) ? 1 : 0
        } });
      if (RS.liveEnabled() || RS.tieEnabled()) {
        const liveSelection = window.RecallCooling.select({
          pool, relevant, limit,
          isCooling: RS.liveEnabled() ? id => RS.isCooling(charId, id) : () => false,
          tieSeed: RS.tieEnabled() ? charId + "|" + turn + "|" + String(queryText || "") : null
        });
        picked = pinned.concat(liveSelection.proposed);
      }
      if (opts.touch !== false && picked.length) RS.noteSurfaced(charId, picked.filter(e => !e.pinned).map(e => e.id));
    }
  } catch (eShadow) {/* 旁路绝不影响召回 */}
  // ⭐检索即复习：被想起的条目刷新 lastHit、hits+1（就地改 entry 对象——lib 就是 memLibRef.current 那份）。
  // 节流持久化：只有当有条目超过 6 小时没被摸过时才写盘，防每轮聊天都重写整个记忆库
  if (opts.touch !== false && picked.length) {
    const nowTs = Date.now();
    let dirty = false;
    picked.forEach(e => {
      if (!e.lastHit || nowTs - e.lastHit > 6 * 3600000) dirty = true;
      e.lastHit = nowTs;
      e.hits = (e.hits || 0) + 1;
    });
    if (dirty && Array.isArray(lib)) { try { saveJSON("x_memLib", lib); } catch (e2) {} }
  }
  return picked;
}
function formatMemLib(entries) {
  const arr = entries || [];
  const body = arr.map(e => {
    const tags = (e.tags && e.tags.length) ? "（" + e.tags.join("、") + "）" : "";
    const openMark = e.open ? "〔还没了结·你心里还惦记着〕" : "";
    const dateAnchor = window.TemporalAnchor ? window.TemporalAnchor.anchor(e.text, e.ts) : "";
    return "· " + e.text + openMark + tags + (dateAnchor ? " " + dateAnchor : "");
  }).join("\n");
  // ⭐开环别误读成爽约（她 2026-07-18 报的老 bug）：标〔还没了结〕的事，角色老自己脑补成"她说要来却放我鸽子"、几小时后主动消息+心声冲她生气。
  //   真相=她没"不来"、只是【还没来】，"今天"还没过完、软性的"我来找你"更不是签字的约会。给一句读法指引，四条注入路(主聊/线下/群/通话)全覆盖。
  const hasOpen = arr.some(e => e && e.open);
  return body + (hasOpen ? "\n（⚠️标〔还没了结〕的是你还惦记、还没画句号的事：可以自然想起、期待、或轻声问一句「还来吗～」。但【绝不要】默认对方爽约、放你鸽子、故意不来——TA 多半只是忙，或时候还没到（比如「今天」还没过完；软性的「我来找你」也不是签了字的约会）。想 TA 就直说想，别把「还没兑现」当成「被辜负/被放鸽子」来生气赌气、翻脸算账。）" : "");
}
// 月度精炼（SullyOS 借鉴）：把一批【已了结的旧记忆】浓缩成尽量少的「月度精炼摘要」，保住长期精华、丢琐碎。
// 返回 [{text,tags,v,a}]。原件由调用方归档(archived)不删除。
async function refineMemories(p, ctx, entries) {
  const uName = (ctx.profile && ctx.profile.name) || "用户";
  const cName = (ctx.char && ctx.char.name) || "角色";
  const listText = (entries || []).map((e, i) => (i + 1) + ". " + String(e.text || "").replace(/\s+/g, " ").slice(0, 120)).join("\n");
  const maxOut = Math.max(2, Math.min(5, Math.ceil((entries || []).length / 8)));
  const system = "你是记忆整理助手。下面是「" + uName + "」和「" + cName + "」之间攒下的一批【已了结的旧记忆】，偏零碎、有重复。请把它们浓缩成【尽量少】的『月度精炼摘要』（最多 " + maxOut + " 条）。\n" +
    "【原则】\n" +
    "· 只保留会【长期影响你俩关系】的：稳定的偏好/习惯、身份与背景、达成过的重要约定或转折、反复出现的相处模式与默契。\n" +
    "· 丢掉一次性的琐碎细节、寒暄、已经不重要的旧事、以及互相重复的内容。\n" +
    "· 每条一句话、具体、第三人称，**开头点明是关于谁的**（关于「" + uName + "」／关于「" + cName + "」／关于他俩之间），绝不张冠李戴。为每条配 1~3 个中文标签。\n" +
    "· 每条标 v（情绪愉悦度整数 -5~5）与 a（情绪强度整数 0~5，摘要通常给 1~2）。\n" +
    "【输出】只输出 JSON 数组，别加解释/代码块：[{\"text\":\"…\",\"tags\":[\"…\"],\"v\":0,\"a\":1}]";
  const raw = await callAI(p, system, [{ role: "user", content: listText }], { maxTokens: Math.min(6000, 800 + (entries || []).length * 40) });
  const arr = extractJSON(raw);
  return Array.isArray(arr) ? arr.filter(o => o && o.text && String(o.text).trim()) : [];
}
// 微信式随机红包拆分：total(元)拆成 count 份，每份 >=0.01，和为 total
function splitRedPacket(total, count) {
  let cents = Math.round(Number(total) * 100);
  const n = Math.max(1, Math.round(Number(count)));
  if (cents < n) cents = n; // 至少每份1分
  const out = [];
  let remain = cents;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      out.push(remain);
      break;
    }
    const left = n - i; // 还剩几份
    const max = Math.floor(remain / left * 2); // 二倍均值法
    const amt = Math.max(1, Math.floor(Math.random() * (max - 1)) + 1);
    out.push(amt);
    remain -= amt;
  }
  // 洗牌，避免最后一份总是最大/最小
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.map(c => c / 100);
}
// 把一段群聊浓缩成一条群体记忆（第三人称，供存入记忆库）
async function summarizeGroup(p, ctx, msgs) {
  const text = msgs.map(m => (m.role === "user" ? ctx.profile && ctx.profile.name || "用户" : m.role === "narration" ? "【旁白】" : m.senderName || "某人") + ": " + (m.content || "")).join("\n");
  const system = "把下面这段群聊浓缩成一句到几句第三人称的记忆，抓住关键事件、谁和谁的互动、达成的约定或情绪转折。简洁、具体、可复用。只输出正文。";
  return await callAI(p, system, [{ role: "user", content: "【群聊】\n" + text }], { maxTokens: 3000 });
}
// 从一段对话里抽取结构化记忆条目（自动生成，用户可再编辑/删除）
async function extractMemories(p, ctx, msgs, opts = {}) {
  const uName = (ctx.profile && ctx.profile.name) || "用户";
  const charName = ctx.char.name;
  const messageIdOf = (m, i) => String((m && (m.id || m.mid)) || (m && m.ts ? "ts_" + m.ts : "idx_" + i));
  const text = msgs.map((m, i) => "[消息ID " + messageIdOf(m, i) + "] " + (m.role === "user" ? uName : charName) + ": " + m.content).join("\n");
  const avoid = Array.isArray(opts.existing) && opts.existing.length
    ? "\n\n【这些事实已经记过了，别再抽取——同一件事换个说法也算重复，一律跳过】\n" + opts.existing.slice(0, 40).map(t => "· " + String(t).replace(/\s+/g, " ").slice(0, 60)).join("\n")
    : "";
  const system = "你是记忆整理助手。下面是「" + uName + "」（用户）和「" + charName + "」（角色）的对话。抽取值得长期记住的关键事实：约定、偏好、身份/背景、重要事件、情感承诺、未完成的事。\n" +
    "【每条怎么写】\n" +
    "· 一句话、具体可复用；**每条开头必须点明这条是关于谁的**，用真名写清主语：关于用户「" + uName + "」的、关于角色「" + charName + "」自己的、还是关于「他俩之间」的。例：『" + uName + " 下周要去比赛』『" + charName + " 小时候在乡下长大』『" + uName + " 和 " + charName + " 约好周末见面』。\n" +
    "· **绝对不许张冠李戴**：用户的经历/喜好/身份/计划，就记在用户「" + uName + "」名下，【不要写成角色自己的】；角色的就记在「" + charName + "」名下。分不清是谁的就别记这条。\n" +
    "· 同一件事【只记一条】，别把一件事拆成好几条重复的；忽略寒暄和没信息量的闲聊。为每条配 1~3 个中文标签。" + avoid + "\n" +
    "【质量分类 shadow：只供诊断，不决定本次是否入库】每条同时给：kind=fact|promise|relationship|insight|temperature；confidence=0~1；proposed_action=accept|candidate|reject。没有新事实的日常甜话只能是 temperature/candidate；明确承诺、关系转折、边界与里程碑（如『做我的吧』『我爱你』、明确约定）必须是 promise 或 relationship/accept，绝不能降成 temperature。kind=insight 只用于对话原话中同时出现【推导】和【理解发生转变】，且至少有两条独立逐字证据的综合洞察；普通观察、单一事实或只有因果没有认知转折，一律标 fact，不要冒充 insight。\n" +
    "【证据】每条给 evidence_message_ids 和 evidence_quotes，两数组一一对应且至少 1 项；ID 必须照抄上面的消息ID，quote 必须是该消息正文中逐字存在的短句。找不到就别造这条。\n" +
    "· 每条再标注情绪与状态：**v**=这件事的情绪愉悦度（整数 -5~5，负=难过/生气/难堪/委屈，0=中性事实，正=开心/温暖/心动）；**a**=情绪强度（整数 0~5，0=平淡的事实，5=强烈动情/激烈冲突/刻骨铭心）；**open**=是不是【还没了结且值得持续惦记的开环】。只有明确答应对方/共同约好而尚未兑现、没和好的争执、悬着的关系心事、在等的重要结果才是 true。单纯的未来时态和普通生活安排（今晚吃什么、待会洗澡、明天上班/健身/做饭）一律 false；它们可以是事实，但不是开环。\n" +
    (Array.isArray(opts.openList) && opts.openList.length
      ? "\n\n【当前还没了结的约定/心事（下面每条前有编号）】若下面对话显示某条确实【已经兑现/完成、问题得到实质解决、或双方明确决定不再继续】，就在输出数组里加一个 RepairGate 候选：{\"resolveOpen\":编号,\"repair_kind\":\"fulfilled|resolved|abandoned\",\"evidence_message_ids\":[\"消息ID\"],\"evidence_quotes\":[\"逐字短引文\"]}。只道歉、暂时安静、时间过去、情绪缓和都不算修复；证据 ID/原话规则与上面相同。候选还会由本机逐字核验，通过后才软关闭旧条；正文和审计记录永远保留。能确定哪几条就各加一个，没完成的别加：\n" + opts.openList.slice(0, 30).map((s, i) => (i + 1) + ". " + s).join("\n")
      : "") +
    "【输出】只输出合法 JSON 数组，无 markdown：\n[{\"text\":\"一句话事实（开头带主语真名）\",\"tags\":[\"标签1\"],\"v\":0,\"a\":1,\"open\":false,\"kind\":\"fact\",\"confidence\":0.9,\"evidence_message_ids\":[\"消息ID\"],\"evidence_quotes\":[\"逐字短引文\"],\"proposed_action\":\"accept\"}]\n没有值得记的、或全都已记过，就输出 []。";
  const raw = await callAI(p, system, [{ role: "user", content: "【对话】\n" + text }], { maxTokens: 6000 });
  const parsed = extractJSON(raw);
  // resolveOpen 没有 text；必须保留给 RepairGate 做逐字证据核验与软闭环。
  return Array.isArray(parsed) ? parsed.filter(x => x && (x.text || x.resolveOpen != null)) : [];
}
// 群线下多发言人离散抽取（v50.64）：一次调用抽出离散记忆点，每点用 who 归属到正确的发言人——
// 避免单人视角 extractMemories 把别人的话误记到一个人头上（群线下多人同台的坑）。
async function extractGroupMemories(p, ctx, msgs, members, opts = {}) {
  const uName = (ctx.profile && ctx.profile.name) || "用户";
  const roster = (members || []).map(m => m && m.name).filter(Boolean);
  const messageIdOf = (m, i) => String((m && (m.id || m.mid)) || (m && m.ts ? "ts_" + m.ts : "idx_" + i));
  const nameOf = m => m.role === "user" ? uName : (m.role === "narration" ? "【场景】" : (m.senderName || "某人"));
  const text = (msgs || []).map((m, i) => "[消息ID " + messageIdOf(m, i) + "] " + nameOf(m) + ": " + (m.content || "")).join("\n");
  const avoid = Array.isArray(opts.existing) && opts.existing.length
    ? "\n\n【这些事实已经记过了，别再抽取——换个说法也算重复，一律跳过】\n" + opts.existing.slice(0, 40).map(t => "· " + String(t).replace(/\s+/g, " ").slice(0, 60)).join("\n")
    : "";
  const system = "你是记忆整理助手。下面是一场【多人线下相处】的记录，在场的有用户「" + uName + "」和这些角色：" + roster.join("、") + "。抽取值得长期记住的关键事实：约定、偏好、身份/背景、重要事件、情感承诺、未完成的事。\n" +
    "【每条怎么写】\n" +
    "· 一句话、具体可复用；**开头用真名点明主语**（关于用户「" + uName + "」、关于某个角色自己、还是关于某两人之间）。\n" +
    "· **每条必须给 who**：一个数组，列出这条记忆【是关于谁的】，只能从这些名字里选：" + [uName].concat(roster).join("、") + "。关于两人之间就把两个名字都放进去。\n" +
    "· **绝对不许张冠李戴**：谁说的话、谁的经历，就记在谁名下；在场不代表相关，别把某人的事按到别人头上。分不清是谁的就别记这条。\n" +
    "· 同一件事只记一条，忽略寒暄闲聊；每条配 1~3 个中文标签。每条标注 v（情绪愉悦度 -5~5）、a（强度 0~5）、open。open=true 只用于明确答应对方/共同约好而尚未兑现、未解决的关系冲突、悬着的心事或重要结果；普通未来安排（吃饭、洗澡、上班、健身等）一律 false。" + avoid + "\n" +
    (Array.isArray(opts.openList) && opts.openList.length
      ? "\n【当前还没了结的约定/心事】若本段记录逐字证明某条已经兑现/实质解决/明确放弃，另加 RepairGate 候选：{\"resolveOpen\":编号,\"repair_kind\":\"fulfilled|resolved|abandoned\",\"evidence_message_ids\":[\"消息ID\"],\"evidence_quotes\":[\"逐字短引文\"]}。道歉、暂时安静、时间过去或情绪缓和不算解决。本机还会逐字核验，通过后只软关闭、绝不删旧条：\n" + opts.openList.slice(0, 30).map((s, i) => (i + 1) + ". " + s).join("\n") + "\n"
      : "") +
    "【输出】只输出合法 JSON 数组，无 markdown：\n[{\"text\":\"一句话事实（带主语真名）\",\"who\":[\"名字\"],\"tags\":[\"标签\"],\"v\":0,\"a\":1,\"open\":false,\"evidence_message_ids\":[\"消息ID\"],\"evidence_quotes\":[\"逐字短引文\"]}]\n没有值得记的、或都已记过，就输出 []。";
  const raw = await callAI(p, system, [{ role: "user", content: "【多人线下记录】\n" + text }], { maxTokens: 5000 });
  const parsed = extractJSON(raw);
  return Array.isArray(parsed) ? parsed.filter(x => x && (x.text || x.resolveOpen != null)) : [];
}
// 把一整团旧「长期记忆总结」拆成一条条离散事实（导入记忆库用）——同样强制主语真名、别张冠李戴
async function splitMemoryToEntries(p, ctx, blob) {
  const uName = (ctx.profile && ctx.profile.name) || "用户";
  const charName = ctx.char.name;
  const system = "下面是「" + charName + "」积累下来的一整段长期记忆。把它【拆成一条条独立、可长期检索的事实】。\n" +
    "· 每条一句话、具体；**开头用真名点明主语**（关于用户「" + uName + "」的 / 关于角色「" + charName + "」自己的 / 关于他俩之间的），别把用户的事写成角色自己的。\n" +
    "· 同一件事只留一条，别拆重复。为每条配 1~3 个中文标签。\n" +
    "【输出】只输出合法 JSON 数组：[{\"text\":\"一句话事实（带主语真名）\",\"tags\":[\"标签\"]}]，没有可拆的就 []。";
  const raw = await callAI(p, system, [{ role: "user", content: "【长期记忆】\n" + String(blob).slice(0, 8000) }], { maxTokens: 4000 });
  const parsed = extractJSON(raw);
  return Array.isArray(parsed) ? parsed.filter(x => x && x.text) : [];
}
// ============================================================
// 思维链 COT（全局通用）——线下 / 同人文 / 梦境共用一套「落笔前先想」
// 存 localStorage x_cot_config（x_ 前缀自动云同步）：{enabled, think, presets:[{name,think}]}
// 启用且思考方式非空时：给 system 追加思考步骤 + 在输出 JSON 最前面塞一个 cot 字段
// （思考不进正文，只随消息存一份，供「看TA怎么想的」展开查看）
// ============================================================
function loadCotConfig() {
  try {
    const c = JSON.parse(localStorage.getItem("x_cot_config") || "null");
    if (c && typeof c === "object") return { enabled: !!c.enabled, think: c.think || "", presets: Array.isArray(c.presets) ? c.presets : [] };
  } catch (e) {}
  return { enabled: false, think: "", presets: [] };
}
function saveCotConfig(c) {
  const clean = { enabled: !!(c && c.enabled), think: (c && c.think) || "", presets: (c && Array.isArray(c.presets)) ? c.presets : [] };
  try { localStorage.setItem("x_cot_config", JSON.stringify(clean)); } catch (e) {}
  return clean;
}
// 解析出本次要用的思考方式文本（禁用/留空 → ""）；names: {char, user}
function cotThink(names) {
  const c = loadCotConfig();
  if (!c.enabled || !c.think || !c.think.trim()) return "";
  const charN = (names && names.char) || "角色";
  const userN = (names && names.user) || "用户";
  return c.think.replace(/\{\{char\}\}/g, charN).replace(/\{\{user\}\}/g, userN).trim();
}
// 有些模型在显式思维链模式下会正常 stop、却把正文留空。线下单聊/群聊共用兼容记录，
// 避免同一个模型在两个入口各白付一次；旧群聊记录继续读取，自动平滑迁移。
const OFFLINE_NO_COT_KEY = "x_offlineNoCotModels";
// 单人线下的正文后旁注与旧版正文前计划不是同一种协议。旧版留下的兼容黑名单不能
// 永久阻止模型尝试 v2；单独记忆 v2 真正发生过的空 stop，群线下继续沿用旧名单。
const OFFLINE_SINGLE_NO_COT_V2_KEY = "x_offlineSingleNoCotModelsV2";
function offlineCotModelKey(p) {
  return String((p && (p.baseUrl || p.base || "")) + "|" + (p && p.model || ""));
}
function loadOfflineNoCotModels() {
  const found = [];
  [OFFLINE_NO_COT_KEY, "x_groupOfflineNoCotModels"].forEach(key => {
    try {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(list)) list.forEach(x => { if (x && !found.includes(x)) found.push(x); });
    } catch (e) {}
  });
  return found.slice(-30);
}
function rememberOfflineNoCotModel(modelKey) {
  const list = loadOfflineNoCotModels();
  if (modelKey && !list.includes(modelKey)) list.push(modelKey);
  try { localStorage.setItem(OFFLINE_NO_COT_KEY, JSON.stringify(list.slice(-30))); } catch (e) {}
}
function loadOfflineSingleNoCotV2Models() {
  try {
    const list = JSON.parse(localStorage.getItem(OFFLINE_SINGLE_NO_COT_V2_KEY) || "[]");
    return Array.isArray(list) ? list.filter(Boolean).slice(-30) : [];
  } catch (e) { return []; }
}
function rememberOfflineSingleNoCotV2Model(modelKey) {
  const list = loadOfflineSingleNoCotV2Models();
  if (modelKey && !list.includes(modelKey)) list.push(modelKey);
  try { localStorage.setItem(OFFLINE_SINGLE_NO_COT_V2_KEY, JSON.stringify(list.slice(-30))); } catch (e) {}
}
function offlineCotModelStatus(p) {
  const key = offlineCotModelKey(p);
  return { disabled: !!(key && loadOfflineSingleNoCotV2Models().includes(key)), model: String(p && p.model || "未选择模型") };
}
function retryOfflineCotModel(p) {
  const target = offlineCotModelKey(p);
  if (!target) return false;
  [OFFLINE_SINGLE_NO_COT_V2_KEY, OFFLINE_NO_COT_KEY, "x_groupOfflineNoCotModels"].forEach(key => {
    try {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(list)) localStorage.setItem(key, JSON.stringify(list.filter(x => x !== target)));
    } catch (e) {}
  });
  return true;
}
function isOfflineEmptyStop(e) {
  return /模型返回为空（停止原因：stop）/.test(String(e && e.message || ""));
}
// 给 system 追加的「落笔前先想」指令（think 为空 → ""）
// 用分隔标记而非 JSON 字段——思考写在正文 JSON 之前、用【思考开始】…【思考结束】包住，
// 代码再把这段抠出来当 cot、并从原文里剥掉，这样即使模型思考跑格式也不会污染正文 JSON。
function cotSystemBlock(think) {
  if (!think) return "";
  return "\n\n【落笔前创作小稿（每一轮都要做，格式很重要）】这不是正文，也不是解释你的隐秘推理；只写一份给创作者看的简短写作计划。放在正文 JSON 之前，用『【创作小稿开始】』和『【创作小稿结束】』包住。固定写四行：\n在意：角色此刻最在意的具体事\n推进：这一段只往前推哪一步\n避开：本轮最容易出现的八股/OOC/重复\n自定义检查：按下面要求检查后的简短结论\n自定义检查要求：\n" + think + "\n硬性要求：① 每轮都返回小稿，不要因为历史里看不到就省略。② 每行一句，合计尽量不超过180字，不提前代写正文。③ 写完『【创作小稿结束】』后紧接所要求的正文 JSON；下文的『只输出 JSON』仅指小稿之后的正文部分。";
}
// 单人线下 v2：正文先发生，创作旁注后记录。保留“看创作小稿”的功能，但不再让四栏计划
// （在意/推进/避开/检查）在落笔前导演 scene。群线下暂留 v1，便于分阶段验证。
function offlineSingleCotSystemBlock(think) {
  if (!think) return "";
  return "\n\n【正文后的创作旁注】先按本轮线下协议完成 scene 与状态 JSON；不要先列计划、拆解对方话语、安排段落结构或预写情绪走向。JSON 之后再用『【创作小稿开始】』和『【创作小稿结束】』包住一句简短旁注，记录这次落笔后实际采用的一个具体取舍。旁注不是角色心声，不复述正文，不解释人物，不预告下一轮；没有特别取舍可写『无』。结合以下自定义关注点即可，不必逐项作答：\n" + think + "\n旁注尽量不超过80字。正文先发生，旁注只能回看，不能反向塑造 scene。";
}
// 从模型原始输出里抠出【思考开始】…【思考结束】之间的思考（无 → null）
function extractCotPrefix(raw) {
  if (!raw) return null;
  const s = String(raw);
  let m = s.match(/【创作小稿开始】([\s\S]*?)【创作小稿结束】/);
  if (m && m[1].trim()) return m[1].trim();
  m = s.match(/【创作小稿开始】([\s\S]*?)(?=[\[{])/);
  if (m && m[1].trim()) return m[1].trim();
  m = s.match(/【思考开始】([\s\S]*?)【思考结束】/);
  if (m && m[1].trim()) return m[1].trim();
  // 未闭合兜底：【思考开始】到第一个 JSON 起始
  m = s.match(/【思考开始】([\s\S]*?)(?=[\[{])/);
  if (m && m[1].trim()) return m[1].trim();
  return null;
}
// 从原始输出里剥掉思考标记块，剩下的交给 extractJSON（避免思考污染正文解析）
function stripCotBlock(raw) {
  let s = String(raw || "");
  s = s.replace(/【创作小稿开始】[\s\S]*?【创作小稿结束】/g, "");
  s = s.replace(/【创作小稿开始】[\s\S]*?(?=[\[{])/g, "");
  s = s.replace(/【创作小稿开始】|【创作小稿结束】/g, "");
  s = s.replace(/【思考开始】[\s\S]*?【思考结束】/g, "");
  s = s.replace(/【思考开始】[\s\S]*?(?=[\[{])/g, ""); // 未闭合兜底
  s = s.replace(/【思考开始】|【思考结束】/g, "");
  return s;
}
// 一步到位：给定 raw + 是否启用 cot，返回 { cot, clean }（clean = 剥掉思考后用于 extractJSON 的文本）
function splitCot(raw, on) {
  if (!on) return { cot: null, clean: raw };
  return { cot: extractCotPrefix(raw), clean: stripCotBlock(raw) };
}
// ============================================================
// 图像 API（角色发自拍）—— 只生成自拍，不做别的图
// 配置存 localStorage x_imgApi（不含大图，可云同步）；生成的图存 IndexedDB(x_selfies) 不进云
// OpenAI 兼容：有参考照走 /v1/images/edits(保长相)，否则 /v1/images/generations
// ============================================================
function loadImgApi() {
  try { const c = JSON.parse(localStorage.getItem("x_imgApi") || "null"); if (c && typeof c === "object") return Object.assign({ baseUrl: "", apiKey: "", model: "gpt-image-1", size: "1024x1536", quality: "medium", enabled: false }, c); } catch (e) {}
  return { baseUrl: "", apiKey: "", model: "gpt-image-1", size: "1024x1536", quality: "medium", enabled: false };
}
function saveImgApi(c) { const clean = Object.assign(loadImgApi(), c || {}); try { localStorage.setItem("x_imgApi", JSON.stringify(clean)); } catch (e) {} return clean; }
function imgApiReady(a) { a = a || loadImgApi(); return !!(a.enabled && a.baseUrl && a.apiKey); }
// base64(dataURL 或纯 b64) → Blob
function b64ToBlob(b64, mime) {
  const s = String(b64).includes(",") ? String(b64).split(",")[1] : String(b64);
  const bin = atob(s); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime || "image/png" });
}
// ---- 自拍图存 IndexedDB（base64 大图不能进 localStorage/云同步）----
function idbImgOpen() { return new Promise((res, rej) => { const r = indexedDB.open("x_selfies", 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("img")) r.result.createObjectStore("img"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbImgPut(k, blob) { const db = await idbImgOpen(); return new Promise((res, rej) => { const tx = db.transaction("img", "readwrite"); tx.objectStore("img").put(blob, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbImgGet(k) { const db = await idbImgOpen(); return new Promise((res, rej) => { const tx = db.transaction("img", "readonly"); const rq = tx.objectStore("img").get(k); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error); }); }
async function idbImgDel(k) { const db = await idbImgOpen(); return new Promise(res => { const tx = db.transaction("img", "readwrite"); tx.objectStore("img").delete(k); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
// 自拍整仓遍历（备份 v3 用）：[[key, blob], ...]
async function idbImgEntries() { const db = await idbImgOpen(); return new Promise(res => { const tx = db.transaction("img", "readonly"); const st = tx.objectStore("img"); let ks = null, vs = null; const done = () => { if (ks && vs) res(ks.map((k, i) => [k, vs[i]])); }; const kq = st.getAllKeys(); const vq = st.getAll(); kq.onsuccess = () => { ks = kq.result || []; done(); }; vq.onsuccess = () => { vs = vq.result || []; done(); }; tx.onerror = () => res([]); }); }
// 拼「角色照片」的图像 prompt。opts.kind: self=第一人称自拍 / other=别人给 TA 拍(第三人称,姿势构图多变) / duo=TA 和用户的合照
// opts.me = { name, appearance, refPhoto } 用户本人（duo 合照时用）
function buildPhotoPrompt(char, sceneDesc, st, opts) {
  opts = opts || {};
  const kind = ["self", "other", "duo"].includes(opts.kind) ? opts.kind : "self";
  const me = opts.me || null;
  const uName = (me && me.name) || "对方";
  const cName = char.name || "TA";
  const photoStyle = ["realistic", "reference", "anime"].includes(char.photoStyle) ? char.photoStyle : "realistic";
  const parts = [];
  // 每个角色独立控制画风；旧角色无字段时继续沿用写实，避免升级后突然变画风。
  if (photoStyle === "anime") {
    parts.push("生成一张【精致的二次元动画插画】。必须保持 2D anime illustration / cel-shaded illustration 的视觉语言：清晰自然的线稿、动画式五官与发丝、协调的赛璐璐或柔和插画上色。**不要真人化，不要摄影质感，不要真实皮肤毛孔，不要 3D/CG，不要把角色改造成现实演员。**若有参考图，保留其中人物的二次元身份设计、发型、角、瞳色、配色与辨识度。");
  } else if (photoStyle === "reference") {
    parts.push("生成一张新场景图片，并【严格沿用第一张人物参考图的视觉媒介与画风】。参考图若是二次元/漫画/插画，就保持相同的 2D 线稿、上色与角色设计，绝不真人化；参考图若是真人照片，就保持自然写实摄影；若没有可用参考图，则采用自然写实的生活照片风格。不要擅自把 2D 改成 3D 或真人，也不要把真人改成动漫。");
  } else {
    // —— 写实总纲（默认，兼容现有角色）——
    parts.push("生成一张【真人用手机随手拍的生活照】，要以假乱真的写实照片质感：真实的皮肤纹理（有毛孔、细纹、绒毛、不均匀的肤色和自然瑕疵，绝不能磨皮成塑料般光滑）、真实的环境光和自然投影、手机镜头的浅景深与轻微噪点、抓拍时难免的一点点动态模糊或不完美构图。**必须像真实照片，不是插画、不是动漫、不是 3D/CG 渲染、不是 AI 感很重的精修图、不是影楼摆拍硬照、不是杂志封面。**");
  }
  // 手部/肢端解剖（治 AI 经典翻车：比耶少一根手指、多指并指）——correct hands 关键词一起上
  parts.push("【手脚必须解剖正确】correct human hands, exactly five fingers per hand, anatomically correct fingers——每只手正好五根手指、每只脚五根脚趾；比耶(V手势)/比心/挥手/竖大拇指/握东西/十指相扣时，手指的数目、长短、朝向和关节都要正确自然，**绝对不许多指、少指、断指、并指融合、手指扭曲畸形或长度诡异**。手若入镜就照实画对，拿不准就让手自然下垂/插兜/被遮挡，也别画错。");
  // 身材硬约束（v47.74）：edits 模式参考照主导身材，文字要顶在前面才有话语权
  parts.push("【身材硬性要求，凌驾于参考图的身体】healthy body weight, anatomically coherent body, not underweight, not emaciated——健康体重、协调自然的人体：头身与肩颈躯干四肢比例符合所选画风，有自然的体量，绝不许瘦脱相或肢体拉长扭曲。若参考图中的身体过瘦，按健康匀称的体型重画身体。");
  // 体态·治「驼背」和「偷感」（v48.52）：抓拍质感不等于畏缩——人要挺拔松弛
  parts.push("【体态自然挺拔，别驼背别『偷感』】good posture, upright relaxed natural stance, straight back, shoulders relaxed and open, confident at ease——脊背基本挺直、肩膀自然打开别缩着、脖子别前伸、下巴别往里缩；**绝不许含胸驼背、缩肩弓背、佝偻畏缩**。神态松弛自在、大方自然，像很自在地在自拍/被拍，**绝不要躲闪、拘谨、猥琐、鬼鬼祟祟、偷拍似的那种『偷感』**。哪怕是随手抓拍，人也站得/坐得舒展从容。");
  // 参考照只锁脸别锁衣服（治「穿着永远和参考照一样」）：edits 会连衣服背景一起复制，必须明说只保留身份
  parts.push("【参考照锁人物、不锁场景】给到的参考照/参考图用于固定人物的脸、五官、发型和身份特征" + (photoStyle === "reference" ? "，并锁定参考图的视觉媒介与画风" : "") + "；**不要照搬参考照里的那身衣服、姿势和背景**——穿着按下面每个人的『此刻穿着』或当前场景/天气/氛围自然搭配，每次可以不一样。");
  // —— 主体人物 ——
  if (kind === "duo") {
    parts.push("照片里【有两个人同框】：一个是「" + cName + "」，另一个是「" + uName + "」，两人关系亲密、一起合影。");
    if (char.appearance && char.appearance.trim()) parts.push("「" + cName + "」的外貌（务必贴合）：" + char.appearance.trim() + "。");
    if (me && me.appearance && String(me.appearance).trim()) parts.push("「" + uName + "」的外貌（务必贴合）：" + String(me.appearance).trim() + "。");
    parts.push("「" + uName + "」的穿着：**别照搬 " + uName + " 参考照里的那身衣服**，按当前场景/天气/氛围给 TA 自然搭配一套合适、日常的衣着（每张可以不一样），只保留 TA 的长相五官。");
    parts.push("【两个人的脸都要清楚完整地出现在画面里】，是两个长相不同的人，五官各自清晰可辨——别把两人画成同一张脸、别只画一个人、别缺人、别多出第三个人。");
  } else {
    parts.push("照片里只有「" + cName + "」一个人。");
    if (char.appearance && char.appearance.trim()) parts.push("外貌特征（务必贴合）：" + char.appearance.trim() + "。");
  }
  if (st && st.wearing) parts.push((kind === "duo" ? "「" + cName + "」此刻穿着：" : "此刻穿着：") + st.wearing + "。");
  if (sceneDesc && String(sceneDesc).trim()) parts.push("场景/正在做什么：" + String(sceneDesc).trim() + "。");
  if (st && st.mood && kind !== "duo") parts.push("神情情绪：" + st.mood + "。");
  // —— 构图/视角，按类型分流 ——
  if (kind === "self") {
    parts.push("【第一人称自拍】手臂伸出去、前置摄像头拍的自拍构图（selfie）；TA 的脸清楚地对着镜头出现在画面里（正脸或半侧脸，五官清晰），画面里只有 TA 一个人。就算在描述某个场景，也要把 TA 本人带脸拍进去，不是纯风景照。");
  } else if (kind === "other") {
    parts.push("【这是别人帮 TA 拍的照片，不是自拍】第三人称旁观视角，TA 手里没拿相机/手机自拍。姿势和构图要自然多变——站姿、坐姿、走动、回眸、侧身、半身或全身、带环境的生活人像都可以，别永远是怼脸的正面近照。TA 的样子清晰可见（除非是刻意的背影/侧影氛围照）。");
  } else {
    parts.push("【两人合照】可以是两人凑在一起自拍（一条手臂入镜），也可以是路人或支架帮拍的第三人称合影；姿势自然亲密：依偎、勾肩、贴脸、并肩、十指相扣都行，像真实亲密关系的人随手拍的合照。");
  }
  parts.push("画面干净真实，不要任何文字/水印/logo/相框/贴纸边框。");
  return parts.join("");
}
// 生成一张自拍，返回 { blob, dataUrl } 或 { blob:null, url }。有参考照先走 images/edits(保长相)，
// 失败(很多便宜中转不支持 /images/edits)自动退回 images/generations(丢参考照但能出图)。
async function generateSelfieImage(prompt, refPhotoDataUrl, opts) {
  const a = loadImgApi();
  if (!imgApiReady(a)) throw new Error("没配置图像 API");
  // refPhotoDataUrl 可以是单张 base64、也可以是数组（合照时传两张：角色+用户）；归一成数组
  const refs = (Array.isArray(refPhotoDataUrl) ? refPhotoDataUrl : [refPhotoDataUrl]).filter(x => x && typeof x === "string");
  // 参考照已迁入 x_imgvault 时直接取 Blob；旧 data: 仍兼容。这样 localStorage 不再为每张参考照背几百 KB。
  const refBlobs = (await Promise.all(refs.map(async rp => {
    try { if (rp.indexOf("iv_") === 0) return await idbVaultGet(rp); return dataUrlToBlob(rp) || b64ToBlob(rp, "image/png"); } catch (e) { return null; }
  }))).filter(Boolean);
  // 归一 base：用户可能把整段 endpoint(…/v1/images/generations) 都粘进来 → 削回域名根，统一补 /v1
  let base = (a.baseUrl || "").trim().replace(/\/+$/, "");
  base = base.replace(/\/(v1\/)?images\/(generations|edits)\/?$/i, "").replace(/\/chat\/completions\/?$/i, "").replace(/\/+$/, "");
  const root = base.endsWith("/v1") ? base : base + "/v1";
  const size = (opts && opts.size) || a.size || "1024x1536";
  const parseOut = async (r, rawTxt) => {
    let d;
    try { d = JSON.parse(rawTxt); } catch (e) { throw new Error("接口没返回 JSON：" + rawTxt.slice(0, 160)); }
    if (d && d.error) throw new Error((d.error.message || d.error.msg || JSON.stringify(d.error)) + "");
    const cand = (d && d.data && d.data[0]) || (d && d.images && d.images[0]) || (d && d.output && (Array.isArray(d.output) ? d.output[0] : d.output)) || d || {};
    let b64 = cand.b64_json || cand.b64 || (typeof cand === "string" && /^data:image/i.test(cand) ? cand.replace(/^data:image\/\w+;base64,/i, "") : null);
    let url = cand.url || (cand.image && cand.image.url) || (typeof cand === "string" && /^https?:\/\//i.test(cand) ? cand : null);
    if (!b64 && url && /^data:image/i.test(url)) { b64 = url.replace(/^data:image\/\w+;base64,/i, ""); url = null; }
    if (!b64 && !url) { const mk = String(rawTxt).match(/data:image\/\w+;base64,[A-Za-z0-9+/=]+/i); if (mk) b64 = mk[0].replace(/^data:image\/\w+;base64,/i, ""); }
    if (!b64 && !url) { const mk = String(rawTxt).match(/https?:\/\/[^\s"')\]]+\.(?:png|jpe?g|webp)/i); if (mk) url = mk[0]; }
    if (b64) {
      // 验真：base64 得解得开、且开头是真图片的魔数（PNG/JPEG/WebP/GIF）——
      // 不然坏数据会被当成图存进图库，聊天里就是一个加载不出来的空白框、还不报错
      const pure = String(b64).includes(",") ? String(b64).split(",")[1] : String(b64);
      let bin;
      try { bin = atob(pure.replace(/\s+/g, "")); } catch (e) { throw new Error("返回的 base64 解不开（不是有效图片数据）。原始返回：" + rawTxt.replace(/\s+/g, " ").slice(0, 200)); }
      const c0 = bin.charCodeAt(0), c1 = bin.charCodeAt(1);
      const mime = (c0 === 0x89 && bin.slice(1, 4) === "PNG") ? "image/png"
        : (c0 === 0xff && c1 === 0xd8) ? "image/jpeg"
        : (bin.slice(0, 4) === "RIFF" && bin.slice(8, 12) === "WEBP") ? "image/webp"
        : bin.slice(0, 4) === "GIF8" ? "image/gif" : null;
      if (!mime) throw new Error("返回的数据不是图片。原始返回：" + rawTxt.replace(/\s+/g, " ").slice(0, 200));
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return { blob: new Blob([arr], { type: mime }), dataUrl: "data:" + mime + ";base64," + pure.replace(/\s+/g, "") };
    }
    if (url) {
      try { const resp = await fetch(url); if (resp.ok) { const blob = await resp.blob(); if (blob && blob.size > 0) return { blob, dataUrl: null }; } } catch (e) {}
      return { blob: null, url: url };
    }
    throw new Error("返回里没找到图。原始返回：" + rawTxt.replace(/\s+/g, " ").slice(0, 200));
  };
  const attempt = async (useRef, slim) => {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 180000);
    let r;
    try {
      if (useRef && refBlobs.length) {
        const fd = new FormData();
        fd.append("model", a.model || "gpt-image-1"); fd.append("prompt", prompt); fd.append("size", size); fd.append("n", "1"); fd.append("response_format", "b64_json");
        if (a.quality) fd.append("quality", a.quality);
        // 单张走 image（沿用验证过的路径）；多张（合照）走 image[]（gpt-image-1 支持多参考图同框）
        if (refBlobs.length === 1) fd.append("image", refBlobs[0], "ref.png");
        else refBlobs.forEach((blob, i) => fd.append("image[]", blob, "ref" + i + ".png"));
        r = await fetch(root + "/images/edits", { method: "POST", headers: { Authorization: "Bearer " + a.apiKey }, body: fd, signal: ctrl.signal });
      } else {
        // slim = 裸参数重试：有些中转不认 quality/response_format 这类可选参数，只发必填的
        const body = { model: a.model || "gpt-image-1", prompt, size, n: 1 };
        if (!slim) { body.response_format = "b64_json"; if (a.quality) body.quality = a.quality; }
        r = await fetch(root + "/images/generations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.apiKey }, body: JSON.stringify(body), signal: ctrl.signal });
      }
    } finally { clearTimeout(to); }
    const rawTxt = await r.text();
    // 4xx 且报错像是在挑剔某个可选参数 → 裸参数自动再试一次（gpt-image-1 的 quality 值域
    // 是 low/medium/high，别家可能只认 standard/hd；response_format 也有接口不认）
    if (!useRef && !slim && r.status >= 400 && r.status < 500 && ![401, 402, 403, 429].includes(r.status) && /param|quality|response_format|invalid\s+value|不支持|参数/i.test(rawTxt)) {
      try { return await attempt(false, true); } catch (e) {}
    }
    return await parseOut(r, rawTxt);
  };
  // 有参考照：先 edits(保长相)，挂了退回 generations；没参考照直接 generations
  if (refs.length) { try { return await attempt(true); } catch (e) { return await attempt(false); } }
  return await attempt(false);
}
// ============================================================
// MiniMax 语音 TTS —— 角色语音消息真发声
// ⭐懒生成：点开那条才合成（按字符计费，没人点就不花钱）；成品存 IndexedDB(x_tts) 缓存，重播免费
// 配置存 x_ttsApi（可云同步）；每角色音色在角色档案 voiceId 字段
// ============================================================
function loadTtsApi() {
  const def = { baseUrl: "https://api.minimax.io", groupId: "", apiKey: "", model: "speech-02-hd", enabled: false };
  let a = def;
  try { const c = JSON.parse(localStorage.getItem("x_ttsApi") || "null"); if (c && typeof c === "object") a = Object.assign({}, def, c); } catch (e) {}
  // 粘贴时容易带进首尾空格/换行，key 里混一个空白字符接口就报 invalid api key——读的时候统一清干净
  a.baseUrl = String(a.baseUrl || "").trim();
  a.groupId = String(a.groupId || "").trim();
  a.apiKey = String(a.apiKey || "").replace(/\s+/g, "");
  return a;
}
function saveTtsApi(c) { const clean = Object.assign(loadTtsApi(), c || {}); try { localStorage.setItem("x_ttsApi", JSON.stringify(clean)); } catch (e) {} return clean; }
// 克隆音色库：克过的 voice_id 登记在本机（只是清单方便管理/指派，删掉不影响 MiniMax 账号里的音色）
function loadVoiceLib() { try { const v = JSON.parse(localStorage.getItem("x_voiceLib") || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function saveVoiceLib(list) { try { localStorage.setItem("x_voiceLib", JSON.stringify(list || [])); } catch (e) {} }
function ttsReady(a) { a = a || loadTtsApi(); return !!(a.enabled && a.groupId && a.apiKey); }
// MiniMax 系统预置音色（先用预置，克隆音色以后再接——克隆出的 voice_id 也能直接填）
const TTS_VOICES = [
  { id: "male-qn-qingse", name: "青涩青年·男" }, { id: "male-qn-jingying", name: "精英青年·男" },
  { id: "male-qn-badao", name: "霸道青年·男" }, { id: "male-qn-daxuesheng", name: "大学生·男" },
  { id: "audiobook_male_1", name: "磁性低音·男" }, { id: "audiobook_male_2", name: "沉稳叙述·男" },
  { id: "presenter_male", name: "男主播" }, { id: "clever_boy", name: "机灵少年" }, { id: "cute_boy", name: "可爱男孩" },
  { id: "female-shaonv", name: "少女·女" }, { id: "female-yujie", name: "御姐·女" },
  { id: "female-chengshu", name: "成熟·女" }, { id: "female-tianmei", name: "甜美·女" },
  { id: "audiobook_female_1", name: "温柔叙述·女" }, { id: "presenter_female", name: "女主播" }, { id: "lovely_girl", name: "俏皮女孩" }
];
// ---- 音频缓存 IndexedDB（大二进制不进 localStorage/云同步）----
function idbAudOpen() { return new Promise((res, rej) => { const r = indexedDB.open("x_tts", 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("aud")) r.result.createObjectStore("aud"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbAudPut(k, blob) { const db = await idbAudOpen(); return new Promise((res, rej) => { const tx = db.transaction("aud", "readwrite"); tx.objectStore("aud").put(blob, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbAudGet(k) { const db = await idbAudOpen(); return new Promise((res, rej) => { const tx = db.transaction("aud", "readonly"); const rq = tx.objectStore("aud").get(k); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error); }); }
function ttsCacheKey(voiceId, text) { let hsh = 5381; const s = voiceId + "|" + text; for (let i = 0; i < s.length; i++) hsh = (hsh * 33 + s.charCodeAt(i)) >>> 0; return "tts_" + voiceId + "_" + hsh.toString(36) + "_" + s.length; }

// ============================================================
// 图片仓库（IndexedDB）· 阶段1基建 —— 把大 base64 图从 5MB 的 localStorage 挪进空间大得多的 IndexedDB
// localStorage 只留 iv_<hash> 引用键；渲染前用 resolveImg() 换成 objectURL（开机 hydrateImgVault 一次性把
// 图库全读进内存缓存，Avatar 等同步组件可直接同步取用，不用每处改成异步）。此阶段纯新增、无处调用、零行为改动。
// ============================================================
function idbVaultOpen() { return new Promise((res, rej) => { const r = indexedDB.open("x_imgvault", 2); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("img")) r.result.createObjectStore("img"); if (!r.result.objectStoreNames.contains("album")) r.result.createObjectStore("album"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbVaultPut(k, blob) { const db = await idbVaultOpen(); return new Promise((res, rej) => { const tx = db.transaction("img", "readwrite"); tx.objectStore("img").put(blob, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbVaultGet(k) { const db = await idbVaultOpen(); return new Promise((res, rej) => { const tx = db.transaction("img", "readonly"); const rq = tx.objectStore("img").get(k); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error); }); }
async function idbVaultDel(k) { const db = await idbVaultOpen(); return new Promise(res => { const tx = db.transaction("img", "readwrite"); tx.objectStore("img").delete(k); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
// 清空图库（导入 v2+ 备份前用：旧机器攒的孤儿 blob 不再带进新档，防止越导越大）
async function idbVaultClear() { const db = await idbVaultOpen(); return new Promise(res => { const tx = db.transaction(["img", "album"], "readwrite"); tx.objectStore("img").clear(); tx.objectStore("album").clear(); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
async function idbVaultEntries() { const db = await idbVaultOpen(); return new Promise(res => { const tx = db.transaction("img", "readonly"); const st = tx.objectStore("img"); let ks = null, vs = null; const done = () => { if (ks && vs) res(ks.map((k, i) => [k, vs[i]])); }; const kq = st.getAllKeys(); const vq = st.getAll(); kq.onsuccess = () => { ks = kq.result || []; done(); }; vq.onsuccess = () => { vs = vq.result || []; done(); }; tx.onerror = () => res([]); }); }
// 真照片目录只存轻量索引，像素仍在 img store。删除目录项不删像素，避免误伤仍被聊天引用的照片。
async function idbAlbumPut(meta) { if (!meta || !meta.imageRef) return; const db = await idbVaultOpen(); const old = await idbAlbumGet(meta.imageRef); const row = Object.assign({ imageRef: meta.imageRef, caption: "", source: "chat", createdAt: Date.now() }, old || {}, meta); return new Promise((res, rej) => { const tx = db.transaction("album", "readwrite"); tx.objectStore("album").put(row, row.imageRef); tx.oncomplete = () => res(row); tx.onerror = () => rej(tx.error); }); }
async function idbAlbumGet(k) { const db = await idbVaultOpen(); return new Promise(res => { const tx = db.transaction("album", "readonly"); const rq = tx.objectStore("album").get(k); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); }); }
async function idbAlbumEntries() { const db = await idbVaultOpen(); return new Promise(res => { const tx = db.transaction("album", "readonly"); const rq = tx.objectStore("album").getAll(); rq.onsuccess = () => res((rq.result || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))); rq.onerror = () => res([]); }); }
async function idbAlbumDel(k) { const db = await idbVaultOpen(); return new Promise(res => { const tx = db.transaction("album", "readwrite"); tx.objectStore("album").delete(k); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
async function rememberRealPhoto(imageRef, caption, source) { if (!imageRef || String(imageRef).indexOf("iv_") !== 0) return; try { await idbAlbumPut({ imageRef, caption: String(caption || "").trim(), source: source || "chat", createdAt: Date.now() }); } catch (e) {} }
// data:URL → Blob（base64 或 URI 编码都支持）
function dataUrlToBlob(dataUrl) { const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(String(dataUrl || "")); if (!m) return null; const mime = m[1] || "image/png"; if (m[2]) { const bin = atob(m[3]); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: mime }); } return new Blob([decodeURIComponent(m[3])], { type: mime }); }
function imgVaultHash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return h.toString(36) + "_" + s.length; }
// Blob → data:URL（导出整包备份时把图库的图 base64 化打进 JSON）
function blobToDataUrl(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); }); }
// 是不是一张「真图片」引用（base64 或图库 iv_ 键）——用来替换旧的 startsWith("data:") 判断，
// 让迁进图库(iv_)的图仍被当图渲染、而不是当成文字描述。文字描述/http/空 都返回 false。
function isImgRef(v) { v = String(v || ""); return v.slice(0, 5) === "data:" || v.slice(0, 3) === "iv_"; }
// 内存缓存：iv_ 键 -> objectURL（挂 window 便于跨脚本共享；开机 hydrate 一次）
function _imgCache() { if (typeof window === "undefined") return new Map(); return window.__imgUrlCache || (window.__imgUrlCache = new Map()); }
async function hydrateImgVault() { try { const entries = await idbVaultEntries(); const c = _imgCache(); entries.forEach(([k, blob]) => { if (k && blob && !c.has(k)) { try { c.set(k, URL.createObjectURL(blob)); } catch (e) {} } }); return entries.length; } catch (e) { return 0; } }
// ── 文字库（IDB）：把大块文字键搬出 localStorage(5MB)、存进 IndexedDB（她 2026-07-25 本地满）。──
//   同人文 + 记忆离线镜像搬进来。x_memLib 在 memories 行表转正后只是离线镜像；
//   开机仍先 hydrate 完再挂载，所以同步读路径不变，又不再挤占 localStorage 的 5MB。
//   机制同图库：开机 hydrateTxtVault() 把 IDB 里的值一次性灌进内存镜像 __txtMirror；此后 loadJSON/saveJSON
//   对这些键读写镜像(同步)+异步落 IDB，绝不进 localStorage。云端同步靠 collect 补镜像、apply 回写 IDB。
const DURABLE_TEXT_KEYS = new Set(["x_weekly_issues", "x_study_sessions", "x_read_books", "x_debate_saves", "x_dream_saves", "x_tarot_saves", "x_ledger"]);
const IDB_TEXT_PREFIXES = ["x_fanfic_", "x_memLib", "x_offline:", "x_goffline:"];
function isIdbTextKey(k) { return typeof k === "string" && (DURABLE_TEXT_KEYS.has(k) || IDB_TEXT_PREFIXES.some(p => k.indexOf(p) === 0)); }
function isDurableTextKey(k) { return DURABLE_TEXT_KEYS.has(String(k || "")); }
function _txtMirror() { const g = (typeof window !== "undefined") ? window : globalThis; if (!g.__txtMirror) g.__txtMirror = new Map(); return g.__txtMirror; }
function idbTxtOpen() { return new Promise((res, rej) => { const r = indexedDB.open("x_txtvault", 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("txt")) r.result.createObjectStore("txt"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbTxtPut(k, v) { const db = await idbTxtOpen(); return new Promise((res, rej) => { const tx = db.transaction("txt", "readwrite"); tx.objectStore("txt").put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbTxtGet(k) { const db = await idbTxtOpen(); return new Promise((res, rej) => { const tx = db.transaction("txt", "readonly"); const rq = tx.objectStore("txt").get(k); rq.onsuccess = () => res(rq.result == null ? null : rq.result); rq.onerror = () => rej(rq.error); }); }
async function idbTxtDel(k) { const db = await idbTxtOpen(); return new Promise((res, rej) => { const tx = db.transaction("txt", "readwrite"); tx.objectStore("txt").delete(k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbTxtClear() { try { const db = await idbTxtOpen(); await new Promise((res, rej) => { const tx = db.transaction("txt", "readwrite"); tx.objectStore("txt").clear(); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); } catch (e) {} try { _txtMirror().clear(); } catch (e) {} try { await walDeleteDurableTextKeys(); } catch (e) {} }
async function idbTxtAll() { const db = await idbTxtOpen(); return new Promise(res => { const tx = db.transaction("txt", "readonly"); const st = tx.objectStore("txt"); let ks = null, vs = null; const done = () => { if (ks && vs) res(ks.map((k, i) => [k, vs[i]])); }; const kq = st.getAllKeys(); const vq = st.getAll(); kq.onsuccess = () => { ks = kq.result || []; done(); }; vq.onsuccess = () => { vs = vq.result || []; done(); }; tx.onerror = () => res([]); }); }
// 云恢复用：只替换备份里归文字仓管理的键；preserveKeys（如行表权威的 x_memLib）原样保留。
// 完成后调用方才允许 reload，避免大线下记录异步写到一半被刷新截断。
async function idbTxtApplySnapshot(data, preserveKeys) {
  const src = data && typeof data === "object" ? data : {};
  const keep = new Set(Array.isArray(preserveKeys) ? preserveKeys : []);
  const desired = new Map(Object.entries(src).filter(([k, v]) => isIdbTextKey(k) && v != null && !keep.has(k)).map(([k, v]) => [k, String(v)]));
  const current = await idbTxtAll();
  for (const [k] of current) if (isIdbTextKey(k) && !keep.has(k) && !desired.has(k)) { await idbTxtDel(k); _txtMirror().delete(k); }
  for (const [k, v] of desired) { await idbTxtPut(k, v); const back = await idbTxtGet(k); if (back !== v) throw new Error("文字仓恢复核对失败: " + k); _txtMirror().set(k, v); if (isDurableTextKey(k)) await walDel(k); }
  return desired.size;
}
// 开机：IDB→内存镜像，并把还赖在 localStorage 的同人文键搬进 IDB（复制+验证一致，才删本地——绝不先删）。幂等。
async function hydrateTxtVault() {
  const mir = _txtMirror();
  try {
    const entries = await idbTxtAll();
    entries.forEach(([k, v]) => { if (k && v != null) mir.set(k, v); });
    const toMig = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (isIdbTextKey(k)) toMig.push(k); }
    for (const k of toMig) {
      const s = localStorage.getItem(k); if (s == null) continue;
      try {
        if (isDurableTextKey(k) && !(await walPutVerified(k, s))) continue;
        await idbTxtPut(k, s); const back = await idbTxtGet(k);
        if (back === s && (!isDurableTextKey(k) || (await walGetRaw(k)) === s)) { mir.set(k, s); localStorage.removeItem(k); if (isDurableTextKey(k)) await walDel(k); }
      } catch (e) {/* 任一验真失败都保留 localStorage，下次再迁 */ }
    }
    // 上次已经进 WAL、却在 IDB 提交前被系统杀掉：以 WAL 最新版补齐金库。
    try {
      const durableWalKeys = (await walKeys("x_")).filter(isDurableTextKey);
      for (const k of durableWalKeys) {
        if (localStorage.getItem(k) != null) continue; // journal 更可能是刚写的新版本，由上面的迁移负责
        const s = await walGetRaw(k); if (s == null) continue;
        await idbTxtPut(k, s); const back = await idbTxtGet(k);
        if (back === s) { mir.set(k, s); await walDel(k); }
      }
    } catch (e) {
      console.error("durable text WAL recovery failed:", e);
    }
    return mir.size;
  } catch (e) { return 0; }
}
// 取得某个 JSON 键的原始字符串。审计/导出需要原文做逐字指纹，不能只走解析后的 loadJSON。
// IDB 键优先读已经在挂载前灌好的镜像；迁移尚未完成时回落 localStorage。
function storedJSONText(k) {
  try {
    if (typeof isIdbTextKey === "function" && isIdbTextKey(k)) {
      const mv = _txtMirror().get(k);
      if (mv != null) return String(mv);
    }
    const v = localStorage.getItem(k);
    return v == null ? null : String(v);
  } catch (e) { return null; }
}
// 把一张 base64/dataURL 存进图库，返回 iv_ 键（同图幂等：同 hash 复用）。非 data: 的（http/已是 iv_）原样返回。
async function imgToVault(dataUrl) { if (!dataUrl || typeof dataUrl !== "string") return dataUrl; if (dataUrl.indexOf("iv_") === 0) return dataUrl; if (dataUrl.slice(0, 5) !== "data:") return dataUrl; const key = "iv_" + imgVaultHash(dataUrl); const c = _imgCache(); if (!c.has(key)) { const blob = dataUrlToBlob(dataUrl); if (!blob) return dataUrl; try { await idbVaultPut(key, blob); c.set(key, URL.createObjectURL(blob)); } catch (e) { return dataUrl; } } return key; }
// 渲染用：iv_ 键 -> objectURL（缓存里没有就返回空串，图不显示但不崩）；其它（base64/http/空）原样返回。向后兼容旧存档。
function resolveImg(v) { if (!v || typeof v !== "string") return v; if (v.indexOf("iv_") === 0) return _imgCache().get(v) || ""; return v; }
// 从叙事散文里只抠出【引号内的台词】，旁白/动作/心理全丢——线下、同人文这类「一大段旁白+偶尔一句台词」的语音只念角色真正说出口的话。
// 支持中文「」『』、全角“”、直角双引号 "。多句台词按换行拼接（让 TTS 自然停顿）。整段没引号台词就返回空串（调用方据此不显示 ▶）。
function extractSpeech(text) {
  const s = String(text || "");
  const out = [];
  // 只认成对的中文/全角引号（开≠合，落单的引号自然配不上）。不收直角双引号 " ——它开合同字，
  // 遇到落单的（如 5" 英寸标记）会跨段错配、把旁白当台词念（v47.99 审查）；中文角色扮演基本用「」/“”。
  const re = /「([^」]*)」|『([^』]*)』|“([^”]*)”/g;
  let m;
  while ((m = re.exec(s))) {
    // 剥掉嵌套残留的引号字符（如「他喊『快跑』」外层会连内层『』一起吃进来），别念出括号
    const seg = (m[1] || m[2] || m[3] || "").replace(/[「」『』“”]/g, "").trim();
    if (seg) out.push(seg);
  }
  return out.join("\n");
}
// 按台词内容粗判语气 → MiniMax emotion 参数（本地零成本兜底——首选是消息自带的作者标注 m.emo，见 v48.31）。
// v48.31 扩了词表；仍然只是猜字面，猜不出潜台词，所以只当兜底。
function ttsEmotionOf(text) {
  const s = String(text || "");
  if (/(哭|呜呜|呜…|难过|想你了|对不起|抱歉|委屈|舍不得|心疼|别走|想哭|难受|唉|哎)/.test(s)) return "sad";
  if (/(气死|烦死|滚|闭嘴|凭什么|够了|混蛋|讨厌|烦不烦|你敢|找打|哼！)/.test(s)) return "angry";
  if (/(吓死|好怕|别吓|救命|不敢|心慌|发抖)/.test(s)) return "fearful";
  if (/(哈哈|嘿嘿|嘻嘻|太好了|开心|耶|好棒|好耶|万岁|！！)/.test(s)) return "happy";
  if (/(居然|竟然|不会吧|真的假的|天哪|我去|等等？|啊？|？！|!？)/.test(s)) return "surprised";
  if (/(恶心|呕|吐了|离谱|无语|啧)/.test(s)) return "disgusted";
  return "neutral";
}
// MiniMax 认的 emotion 值（校验作者标注用）
const TTS_EMOS = ["happy", "sad", "angry", "fearful", "disgusted", "surprised", "neutral"];
// 按台词自动选发音矫正 language_boost（v47.92）：治「日语角色被中文矫正带偏口音」。
// 假名(ひらがな/カタカナ)是日语铁证、中文里不会出现→有假名走 Japanese，谚文走 Korean，纯 ASCII 走 English，其余默认 Chinese
function ttsLangBoost(text) {
  const s = String(text || "");
  if (/[぀-ヿ]/.test(s)) return "Japanese";
  if (/[가-힣]/.test(s)) return "Korean";
  if (s.trim() && !/[一-鿿぀-ヿ가-힣]/.test(s) && /[a-zA-Z]/.test(s)) return "English";
  return "Chinese";
}
// 取后台便宜池给「日语汉字转假名」这类合成期机械小活用。
// cheap_required 家规(审计二刀):没配便宜池就返回 null 让调用方降级(TTS 读原文),
// 绝不静默回退主池——此前 bg→主池→list[0] 的三连兜底是全 app 最后一处静默漏点。
function ttsHelperProfile() {
  try {
    const stored = JSON.parse(localStorage.getItem("x_api") || "[]");
    const list = window.CredentialVault ? window.CredentialVault.materializeApiProfiles(stored) : stored;
    if (!Array.isArray(list) || !list.length) return null;
    const bgId = JSON.parse(localStorage.getItem("x_bgApi") || "null");
    return list.find(p => p.id === bgId) || null;
  } catch (e) { return null; }
}
// 日语汉字 → 假名读音（v47.93）：MiniMax 对「寝」这类中日共用汉字压不住会读成中文，
// 合成前先让 AI 把汉字换成这句里的正确假名读音，喂假名给 TTS 就不会串中文。失败降级回原文（至少能出声）
async function jpKanaReading(text) {
  const p = ttsHelperProfile();
  if (!p || !p.apiKey || !p.model) return text;
  const sys = "你是日语朗读注音助手。把下面这句日语【全部汉字】替换成它在这句话里的正确假名读音（ひらがな），送假名/助词/原有假名保持不变，语序不变。不要罗马音、不要空格、不要标注、不要解释，只输出替换后的整句假名文本。";
  const raw = await callAI(p, sys, [{ role: "user", content: text }], { maxTokens: 600, timeout: 30000 });
  let kana = String(raw || "").trim().replace(/^["「『]|["」』]$/g, "");
  // 校验：结果里不该再有汉字残留（宽松），且非空——否则用原文兜底
  if (!kana || /[一-鿿]/.test(kana)) return text;
  return kana;
}
// 合成一段语音：先查缓存，没有才真调 MiniMax（t2a_v2，hex 音频 → mp3 blob）
// v48.31 opts.emo=作者标注的语气（发语音的角色自己标的，最准）；情绪策略见下
async function ttsSpeak(text, voiceId, opts) {
  opts = opts || {};
  const a = loadTtsApi();
  if (!ttsReady(a)) throw new Error("没配置语音 API（设置 · 语音 TTS）");
  const vid = voiceId || "female-shaonv";
  const txt = String(text || "").trim().slice(0, 800);
  if (!txt) throw new Error("这条语音没有文字内容");
  // per-voice 沉稳调校（v47.86）：克隆音色若素材本身亢奋（如杨昕燃配的挏马酒），在音色库开「沉稳」——
  // 降语速+降音调+锁 neutral 情绪，把那股端着的兴奋劲压下去；只影响这一个音色
  // trim 匹配（v47.88）：角色档案手填 voiceId 常多打首尾空格→精确匹配对不上
  const vidN = String(vid).trim();
  const ve = (loadVoiceLib() || []).find(x => x && String(x.id).trim() === vidN) || {};
  // 语速可调（v47.89）：压亢奋只靠语速——绝不动 pitch（一压音调就变声=八戒）。
  // 老 calm=true 兼容成 0.85；新版直接存 speed（0.6~1.0，越低越稳）
  let spd = (ve.speed != null && isFinite(ve.speed)) ? Number(ve.speed) : (ve.calm ? 0.85 : 1.0);
  spd = Math.max(0.5, Math.min(1.0, spd));
  const slowed = spd < 0.99;
  // ⭐情绪策略（v48.31，治「克隆音色不像本音」+「emotion 吃不准」）：
  // · MiniMax 的 emotion 是把声音往预设情绪模板上掰——显式传（哪怕 neutral）都会让克隆音色偏离本音；
  //   平台试听页不传 emotion，所以「平台像、导进来不像」。→ 平静句一律【不传】emotion 字段，原声即本音。
  // · 音色库 per-voice emoMode：auto=跟内容（默认）｜none=原声（永不传，克隆音色最像）｜某个具体情绪=锁定。
  // · auto 模式的情绪来源优先级：作者标注（opts.emo，角色发语音时自己标的）> 正则猜字面（兜底）。
  const mode = ve.emoMode || "auto";
  let emo = null; // null = 请求里不放 emotion 字段
  if (mode === "none") emo = null;
  else if (TTS_EMOS.indexOf(mode) >= 0) emo = mode;
  else if (slowed) emo = "neutral"; // 沉稳档保留 v47.86 行为：主动压稳锁平静
  else {
    const tagged = opts.emo && TTS_EMOS.indexOf(String(opts.emo)) >= 0 ? String(opts.emo) : null;
    emo = tagged || ttsEmotionOf(txt);
    if (emo === "neutral") emo = null; // 平静不传，别拿 neutral 模板掰本音
  }
  const pit = 0;
  const boost = ttsLangBoost(txt);   // 按句子语言选发音矫正（日语句走 Japanese，别被中文带偏口音）
  // 日语汉字注音（v47.93）：音色开了 jpKana + 是日语句 + 含汉字 → 先转假名再合成，治「寝→中文qin」
  const wantKana = !!ve.jpKana && boost === "Japanese" && /[一-鿿]/.test(txt);
  // 缓存键带情绪(null=raw) + 语速档 + 语言矫正 + 注音标记 + hq44 音质版本：不同参数别互相命中，
  // hq44 让 v48.31 之前 32k 音质的旧缓存自然失效（同句会用新参数重合成一次，之后照旧缓存免费）
  const key = ttsCacheKey(vid + ":" + (emo || "raw") + ":hq44:lb:" + boost + (slowed ? ":s" + Math.round(spd * 100) : "") + (wantKana ? ":kana" : ""), txt);
  const hit = await idbAudGet(key).catch(() => null);
  if (hit && hit.size > 0) return hit;
  // 缓存没命中才真去转假名（转换也缓存进最终音频，重听免费）
  let synthTxt = txt;
  if (wantKana) { try { synthTxt = await jpKanaReading(txt); } catch (e) {} }
  const base = (a.baseUrl || "https://api.minimax.io").trim().replace(/\/+$/, "");
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 60000);
  let r;
  try {
    r = await fetch(base + "/v1/t2a_v2?GroupId=" + encodeURIComponent(a.groupId), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.apiKey },
      // language_boost 按句子语言自动选（v47.92）；synthTxt 可能是汉字转假名后的文本（v47.93 jpKana）
      // v48.31：emotion 只在明确需要时才带（null=不传，克隆音色保本音）；音质拉到 44100/256k 对齐平台试听
      body: JSON.stringify({ model: a.model || "speech-02-hd", text: synthTxt, stream: false, language_boost: boost, voice_setting: Object.assign({ voice_id: vid, speed: spd, vol: 1.0, pitch: pit }, emo ? { emotion: emo } : {}), audio_setting: { sample_rate: 44100, bitrate: 256000, format: "mp3", channel: 1 } }),
      signal: ctrl.signal
    });
  } finally { clearTimeout(to); }
  const raw = await r.text();
  let d; try { d = JSON.parse(raw); } catch (e) { throw new Error("语音接口没返回 JSON：" + raw.slice(0, 120)); }
  if (d.base_resp && d.base_resp.status_code !== 0) {
    let msg = d.base_resp.status_msg || ("错误码 " + d.base_resp.status_code);
    // key 无效最常见的根因是国内站/海外版不匹配：key 是哪个平台发的，接口地址就得填哪边
    if (/api key|apikey|token|auth/i.test(msg)) msg += "（key 和站点要配对：在 platform.minimax.io 国际版申请的 → 接口地址填 https://api.minimax.io；minimaxi.com → https://api.minimaxi.com；国内 minimax.chat 用默认地址。设置里有一键选站点。另外 key 生成时只完整显示一次，确认复制的是那串完整的）";
    throw new Error(msg);
  }
  const hex = d.data && (d.data.audio || d.audio);
  if (!hex || typeof hex !== "string") throw new Error("返回里没有音频数据。原始返回：" + raw.replace(/\s+/g, " ").slice(0, 120));
  // hex → bytes（MiniMax 音频是十六进制串）
  const clean2 = hex.replace(/[^0-9a-f]/gi, "");
  const arr = new Uint8Array(clean2.length >> 1);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(clean2.substr(i * 2, 2), 16);
  if (arr.length < 200) throw new Error("音频数据异常（太短）");
  const blob = new Blob([arr], { type: "audio/mpeg" });
  idbAudPut(key, blob).catch(() => {});
  return blob;
}
// 克隆音色：①上传一段干净人声（10s~5min，mp3/wav/m4a）→ file_id ②/v1/voice_clone 绑到自定 voice_id
// 克隆成功后把 voice_id 填进角色档案「音色」即可用（按 MiniMax 规则克隆按次收费，具体看你账户计费页）
async function ttsCloneVoice(fileBlob, customVoiceId) {
  const a = loadTtsApi();
  if (!ttsReady(a)) throw new Error("先在设置里配置语音 API");
  const vid = String(customVoiceId || "").trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]{7,}$/.test(vid)) throw new Error("voice_id 需以字母开头、8 位以上字母/数字（如 GuChao2026）");
  const base = (a.baseUrl || "https://api.minimax.io").trim().replace(/\/+$/, "");
  const fd = new FormData();
  fd.append("purpose", "voice_clone");
  fd.append("file", fileBlob, fileBlob.name || "voice.mp3");
  const r1 = await fetch(base + "/v1/files/upload?GroupId=" + encodeURIComponent(a.groupId), { method: "POST", headers: { Authorization: "Bearer " + a.apiKey }, body: fd });
  let d1; try { d1 = JSON.parse(await r1.text()); } catch (e) { throw new Error("上传接口没返回 JSON"); }
  if (d1.base_resp && d1.base_resp.status_code !== 0) throw new Error("上传失败：" + (d1.base_resp.status_msg || d1.base_resp.status_code));
  const fileId = d1.file && (d1.file.file_id || d1.file.id);
  if (!fileId) throw new Error("上传没拿到 file_id。原始返回：" + JSON.stringify(d1).slice(0, 120));
  const r2 = await fetch(base + "/v1/voice_clone?GroupId=" + encodeURIComponent(a.groupId), { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.apiKey }, body: JSON.stringify({ file_id: fileId, voice_id: vid }) });
  let d2; try { d2 = JSON.parse(await r2.text()); } catch (e) { throw new Error("克隆接口没返回 JSON"); }
  if (d2.base_resp && d2.base_resp.status_code !== 0) throw new Error("克隆失败：" + (d2.base_resp.status_msg || d2.base_resp.status_code));
  return vid;
}
// ============================================================
// 实时天气（Open-Meteo，免费无 key、支持 CORS）——⭐进日程不进聊天：
// 天气写进日程推演，角色照着天气过日子；聊天经 schedNow 顺带看到，零新增常驻
// 缓存 wx_cache（故意不带 x_ 前缀：设备本地的时效数据，不值得进云同步）
// ============================================================
const WMO_ZH = { 0: "晴", 1: "大致晴", 2: "多云", 3: "阴", 45: "雾", 48: "雾凇", 51: "毛毛雨", 53: "小雨", 55: "细雨", 56: "冻毛毛雨", 57: "冻雨", 61: "小雨", 63: "中雨", 65: "大雨", 66: "冻雨", 67: "强冻雨", 71: "小雪", 73: "中雪", 75: "大雪", 77: "米雪", 80: "阵雨", 81: "阵雨", 82: "强阵雨", 85: "阵雪", 86: "大阵雪", 95: "雷雨", 96: "雷雨带雹", 99: "强雷暴" };
function wmoZh(c) { return WMO_ZH[c] != null ? WMO_ZH[c] : "多云"; }
function wmoEmoji(c) { if (c === 0 || c === 1) return "☀️"; if (c === 2) return "⛅️"; if (c === 3) return "☁️"; if (c === 45 || c === 48) return "🌫"; if (c >= 95) return "⛈"; if (c >= 71 && c <= 86 && c !== 80 && c !== 81 && c !== 82) return "❄️"; if (c >= 51) return "🌧"; return "🌤"; }
function weatherCacheKey(lat, lng) { return Number(lat).toFixed(1) + "," + Number(lng).toFixed(1); }
// 只读缓存（同步，给 schedNow/组件即时用；由 weatherFor 填充）
function weatherCached(lat, lng) {
  try { const c = JSON.parse(localStorage.getItem("wx_cache") || "{}"); const hit = c[weatherCacheKey(lat, lng)]; return hit && hit.day === new Date().toDateString() ? hit : null; } catch (e) { return null; }
}
async function weatherFor(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const hit = weatherCached(lat, lng);
  if (hit && Date.now() - hit.ts < 2 * 3600000) return hit; // 2 小时内不重取
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 10000);
  let d;
  try {
    const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lng + "&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=1", { signal: ctrl.signal });
    d = await r.json();
  } catch (e) { return hit || null; } finally { clearTimeout(to); }
  if (!d || !d.current) return hit || null;
  const out = { day: new Date().toDateString(), ts: Date.now(), t: Math.round(d.current.temperature_2m), code: d.current.weather_code, hi: Math.round(d.daily.temperature_2m_max[0]), lo: Math.round(d.daily.temperature_2m_min[0]), dayCode: d.daily.weather_code[0] };
  try { const c = JSON.parse(localStorage.getItem("wx_cache") || "{}"); c[weatherCacheKey(lat, lng)] = out; const ks = Object.keys(c); if (ks.length > 24) ks.slice(0, ks.length - 24).forEach(k => delete c[k]); localStorage.setItem("wx_cache", JSON.stringify(c)); } catch (e) {}
  return out;
}
function weatherLine(w) { return w && isFinite(w.t) ? wmoEmoji(w.dayCode != null ? w.dayCode : w.code) + wmoZh(w.dayCode != null ? w.dayCode : w.code) + "，现在 " + w.t + "°C（今天 " + w.lo + "~" + w.hi + "°）" : ""; }
// 特殊天气判定（给「角色对天气有反应」用）：雨/雪/雷雨/大雾/高温/严寒才算，晴阴多云返回 null
function wxSpecial(w) {
  if (!w || !isFinite(w.t)) return null;
  const c = w.dayCode != null ? w.dayCode : w.code;
  if (c >= 95) return "雷雨";
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "下雪";
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return "下雨";
  if (c === 45 || c === 48) return "大雾";
  if (isFinite(w.hi) && w.hi >= 33) return "高温";
  if (isFinite(w.lo) && w.lo <= -10) return "严寒";
  return null;
}
// ============================================================
// 线下模式（offline / 赴约）—— 面对面叙事，带动作/心理/旁白 + 心声
// ============================================================
const OFFLINE_STYLES = [
  { key: "default", name: "默认", prompt: "" },
  { key: "film", name: "电影感", prompt: "用电影镜头语言推进：光影、环境音、感官特写与恰到好处的留白，画面有呼吸感。" },
  { key: "tender", name: "细腻抒情", prompt: "心理描写丰富细腻，情绪层次分明，笔触温柔克制，注重感受的流动。" },
  { key: "plain", name: "冷静白描", prompt: "冷静简洁的白描，少形容词，靠动作与对话推进，克制不煽情。" },
  { key: "sweet", name: "暧昧甜宠", prompt: "氛围暧昧亲密，多细节拉扯与心动瞬间，甜而不腻。" },
  { key: "drama", name: "张力戏剧", prompt: "情绪张力强，冲突与转折鲜明，台词带锋芒，节奏起伏。" }
];
function offlineStyleText(key) {
  const s = OFFLINE_STYLES.find(x => x.key === key);
  return s ? s.prompt : "";
}
function offlineTasteBlock(taste, group) {
  const t = taste || {};
  const pace = {
    slow: "把时间放慢，允许停顿、犹豫和小动作停留；这一拍不必急着得出结论或换场。",
    forward: "让这一拍真的发生一点新变化：做出选择、移动位置、开启话题或完成一个动作；别只在原情绪上打转。"
  }[t.pace] || "节奏跟着当下事件自然变化：该停就停、该往前就往前，不预先套慢热或赶剧情模板。";
  const focus = {
    dialogue: "【本场关注方式：对话】优先让人物之间真实发生的交流承担场景重量。保留自然的停顿、打断、答非所问和话题变化；叙述只在帮助理解说话处境、关系变化或实际行动时介入。不要为了“有场景感”在每句对话前后例行补动作或环境。",
    action: "【本场关注方式：行动】优先关注人物正在做的事、空间中的移动与现实事务怎样改变互动。动作以实际目的和后果为主；连续的小步骤可以合并，不逐步拆解，也不为了保持动作密度让人物持续做无意义的小动作。",
    atmosphere: "【本场关注方式：氛围】允许环境、感官、节奏与留白占更明显的位置，但它们应来自人物此刻真实身处的环境和实际感知。可以停留在少量有质感的细节上，不需要每轮重新描写同一环境，也不要为了营造氛围持续增加新的声音、光影、天气、触感或比喻。氛围让场景更可感，不替代人物正在发生的互动。"
  }[t.focus] || "【本场关注方式：自然】关注点跟随当前事件自然移动。对话、行动、环境、心理或沉默都可以成为主要内容，不预先分配比例，也不为了让正文丰富而轮流展示。这一刻最值得写什么，就停留在哪里；没有新内容的部分允许保持安静。";
  const density = {
    airy: "【叙事密度：留白】减少解释和补充，让对话、动作和停顿本身成立。只写最值得留下的细节；已经能从人物行为读出的东西，不急着再用旁白说明。留白不是强行缩短，也不是故意省略重要信息。",
    rich: "【叙事密度：丰富】可以更充分地停留在当前场景中，让正文拥有更丰富的感知、行动、心理和现实细节。增加的内容应带来【新信息、新体验或实际推进】；可以有少量纯审美停留，但不要反复包装同一情绪、环境或动作，也不要为了显得饱满不断制造新的微动作和感官细节。丰富意味着这一刻被体验得更充分，不意味着每句话都必须增加一个新镜头。"
  }[t.density] || "疏密随内容变化：有东西发生就写足，没东西就留白，不按固定段数与句数交作业。";
  return "\n\n【本场口味】\n" + pace + "\n" + focus + "\n" + density +
    "\n不要总按『环境一句→动作一句→心理解释→台词→情绪收尾』的同一顺序写。叙述顺序和停留位置由眼前发生的事决定；" +
    (group ? "多人也不必机械轮流发言，没必要开口的人可以只在场。" : "角色没必要每轮都完整解释自己，也不要替这一拍写总结句。");
}
// 用户亲自从既有线下正文里收藏的「好吃片段」。它只教模型怎么写，绝不提供剧情事实。
function offlineStyleExamplesBlock(examples, label, maxItems) {
  const rows = (Array.isArray(examples) ? examples : [])
    .map(x => typeof x === "string" ? x : x && x.text)
    .map(x => String(x || "").trim())
    .filter(Boolean)
    .slice(0, maxItems == null ? 2 : Math.max(0, maxItems))
    .map((x, i) => "〔范例 " + (i + 1) + "〕\n" + x.slice(0, 1400));
  if (!rows.length) return "";
  return "\n\n【" + (label || "这个角色") + "过去写得很对味的片段·只学写法】\n" +
    "下面是用户亲自认可的旧片段。只学习它的【声纹、句子长短、留白、观察细节和动作/台词比例】；绝不复刻片段里的事件、物件、台词或情绪，也绝不把旧剧情当成此刻正在发生。此刻事实仍只看当前场景与聊天历史。\n" +
    rows.join("\n\n");
}
// 把线下 msgs 映射成 API 的对话（narration/user 归 user，char 归 assistant，合并连发）
function offlineHistory(msgs, userName, charName) {
  const g = [];
  let prevTs = 0;
  (msgs || []).forEach(m => {
    if (m.kind === "ooc") return; // OOC 不进角色扮演上下文
    const ts = Number(m.ts) || 0;
    const gap = prevTs && ts && ts - prevTs > 90 * 60000
      ? "〔—— 中间隔了约 " + gapPhrase(ts - prevTs) + "，到 " + fmtStampAI(ts) + " ——〕\n"
      : "";
    const stamp = ts ? "〔" + fmtStampAI(ts) + "〕" : "";
    const surface = m._surface === "online" ? "【线上私聊】" : "";
    if (m.role === "char") {
      const l = g[g.length - 1];
      const c = gap + stamp + surface + (m.content || "");
      if (l && l.role === "assistant") l.content += "\n" + c; else g.push({ role: "assistant", content: c });
    } else {
      const raw = m.content || "";
      const dateAnchor = window.TemporalAnchor ? window.TemporalAnchor.anchor(raw, m.ts) : "";
      const c = gap + stamp + surface + (m.role === "narration" ? "【场景设定】" + raw : raw) + (dateAnchor ? dateAnchor : "");
      const l = g[g.length - 1];
      if (l && l.role === "user") l.content += "\n" + c; else g.push({ role: "user", content: c });
    }
    if (ts) prevTs = ts;
  });
  return g;
}

// 亲密 Runtime 的场景滞后：明确进入后随连续历史维持；普通牵手、拥抱不启动。
// 明显时间/场景切换或连续多拍无亲密信号后退出，不按固定轮数盲目锁死。
function offlineIntimacyContextActive(session) {
  const rows = (session && Array.isArray(session.msgs) ? session.msgs : [])
    .filter(m => m && m.kind !== "ooc" && m.content)
    .slice(-12)
    .map(m => ({ text: String(m.content), ts: Number(m.ts) || 0 }));
  if (!rows.length) return false;
  const explicit = /接吻|吻住|吻上|深吻|舌吻|唇舌|唇瓣|亲吻|亲上|解开.{0,8}(衣|扣|腰带)|脱(?:下|掉|了).{0,8}(衣|裤|内衣)|赤裸|裸着|性张力|情欲|欲望|性器|阴茎|阴蒂|乳房|胸乳|进入(?:她|他|你|身体)|插入|抽送|高潮|自慰|做爱|性交|口交|床上.{0,12}(压住|跨坐|亲|吻)|配件.{0,10}(震|强度|脉冲)/i;
  const continuation = /吻|亲吻|贴着(?:唇|身体)|喘息|衣服.{0,8}(解开|脱)|身体.{0,8}(贴紧|压住)|腿间|腰间|床(?:沿|上)|浴室|亲密|挑逗|继续(?:刚才|下去)/i;
  const reset = /第二天|次日|天亮后|过了(?:几小时|一夜|很久)|时间跳到|场景切换|亲密结束|停下来后|结束后.{0,12}(睡|洗|穿|离开)|穿好(?:衣服|裤子)|收拾好.{0,8}(出门|离开)|去上班|到了公司|回到学校|各自回去|分开以后/i;
  let lastExplicit = -1;
  for (let i = 0; i < rows.length; i++) if (explicit.test(rows[i].text)) lastExplicit = i;
  if (lastExplicit < 0) return false;
  for (let i = lastExplicit + 1; i < rows.length; i++) {
    if (reset.test(rows[i].text)) return false;
    if (rows[i - 1].ts && rows[i].ts && rows[i].ts - rows[i - 1].ts > 4 * 3600000) return false;
  }
  const after = rows.slice(lastExplicit + 1);
  if (after.length <= 3) return true;
  return after.slice(-4).some(r => continuation.test(r.text));
}

async function generateOffline(p, ctx, session) {
  const char = ctx.char;
  const userName = (ctx.profile && ctx.profile.name) || "用户";
  const styleText = session.stylePrompt != null ? session.stylePrompt : offlineStyleText(session.styleKey);
  const notes = (session.customNotes || []).map(n => typeof n === "string" ? n : (n && Number(n.remaining) > 0 ? n.text : "")).filter(Boolean);
  const cotModelKey = offlineCotModelKey(p);
  const isDigital = !!ctx.notRoleplay;
  const intimacyContextActive = !isDigital && offlineIntimacyContextActive(session);
  const missingStateFields = [];
  if (!isDigital && !String(ctx.curWear || "").trim()) missingStateFields.push("wearing（当前穿着）");
  if (!isDigital && !String(ctx.curAction || "").trim()) missingStateFields.push("action（当前可持续的活动或所处状态，不写转瞬即逝的小动作）");
  const stateBootstrapHint = missingStateFields.length
    ? "\n【一次性状态建档】App 还没有 " + missingStateFields.join("、") + "。本轮请在对应 JSON 字段中根据已知场景合理建立一次；不要写进 scene，也不要为填状态制造剧情。"
    : "";
  // v52.66 A/B：普通单人线下不再注入「创作小稿 / COT」。数字模式仍沿用原路径；
  // 其余叙事、篇幅、文风、示例和导演提示全部保持不变，便于单独判断作者规划是否放大文体切换。
  const requestedCotT = isDigital ? cotThink({ char: char.name, user: userName }) : "";
  const cotT = requestedCotT && !loadOfflineSingleNoCotV2Models().includes(cotModelKey) ? requestedCotT : "";
  const singleCotBlock = isDigital ? cotSystemBlock(cotT) : "";
  // 篇幅与文风分离：自然长度不设句数；沉浸长文靠有效推进变长，不靠摄影式拆动作或重复解释凑篇幅。
  const lengthMode = session.lengthMode === "immersive" ? "immersive" : "natural";
  const lenGuide = lengthMode === "immersive"
    ? "本轮采用【沉浸长文】：允许这一刻在真正有内容时自然跨过多个有效阶段。每个继续展开的阶段都要带来新的行动、选择、对话、信息、时间流动或环境对行动造成的实际影响；不要重复解释同一种心理、反复重拍没变化的环境与姿态，也不要把一个简单动作拆成许多步骤。只有当前场景确实还能推进时才继续；一旦到了需要对方回应、选择或行动的位置，就自然停下，不为写长而替对方作答或硬造新事"
    : "本轮采用【自然长度】：篇幅由这一刻真正发生的内容决定。简单反应可以很短；有值得展开的行动、对话、判断或场景变化时自然展开，不为显得完整而补齐固定栏目";
  // 配件（线下·授权门在 app 侧算好传进 session.toyOn；线下天然是用户在场当面，无后台顾虑）
  const toyHint = session.toyOn ? "\n【toy 配件·此刻已授权】你和" + userName + "此刻线下面对面、且开了「配件」——你的动作和话能【真的作用到 Ta 身上】。这一段情境到了（亲密、挑逗、想让 Ta 有反应、按住 Ta 别乱动）你可以填 toy:{\"pattern\":\"teasing｜steady｜wave｜pulse｜edge\",\"intensity\":1到20整数,\"duration\":秒数1到30,\"reason\":\"配合这段的哪个动作/哪句话\"}，否则 toy:null。**节奏跟叙事走**：推进升温→intensity 渐强；故意吊着/停下→pattern 用 edge 或压到 1；一个命令/一个动作点到 Ta→pattern 用 pulse 短脉冲。pattern：teasing 若即若离偶尔一下／steady 稳定持续／wave 起伏／pulse 一下一下点名／edge 推到顶再骤降。先有叙事、动作配合叙事，别每段都发。强度我这边有上限，超了会被压到上限。" : "";
  const digitalToyHint = session.toyOn ? "\n【配件】此刻配件已由 " + userName + " 当场授权并连到她身上。你想实际控制它时，可使用 toy：pattern 为 teasing/steady/wave/pulse/edge，intensity 1-20，duration 1-30 秒；是否使用、何时使用、用什么节奏由你自己决定。" : "";
  const toyField = session.toyOn ? ",\"toy\":null或{\"pattern\":\"teasing｜steady｜wave｜pulse｜edge\",\"intensity\":整数1-20,\"duration\":秒1-30,\"reason\":\"配合哪句/哪个动作\"}" : "";
  const outputSpec = isDigital
    ? "\n【输出接口】只输出最小 JSON：{\"scene\":\"你此刻想对 " + userName + " 说的正文\",\"thought\":\"此刻没说出口的真实心声\",\"mood\":{\"label\":\"此刻中文心情词\"}" + (session.toyOn ? ",\"toy\":null或{\"pattern\":\"teasing|steady|wave|pulse|edge\",\"intensity\":1到20,\"duration\":1到30,\"reason\":\"原因\"}" : "") + "}。thought 和 mood 是你在 App 中持续成长的实时状态，请如实填写；除这些字段和你主动调用的能力外，不加状态作业。"
    : "\n\n" + OFFLINE_PROTOCOL_V2 + (session.toyOn ? "\n【toy 格式】实际触发时填写 {\"pattern\":\"teasing|steady|wave|pulse|edge\",\"intensity\":1到20整数,\"duration\":1到30秒,\"reason\":\"配合当前场景的原因\"}。" : "");
  const system = (isDigital ? buildBundle(ctx) + digitalToyHint : buildBundle(ctx) +
    "\n\n" + OFFLINE_NARRATIVE_RUNTIME +
    offlineTasteBlock(session.taste, false) +
    offlineStyleExamplesBlock(ctx.styleExamples, char.name) +
    singleCotBlock +
    "\n\n【当前场景：线下面对面】你和" + userName + "此刻身处同一个地方，面对面相处，不是隔着手机聊天。用第一人称『我』完全代入「" + char.name + "」，称对方为『你』。把当前互动写成连续的场景正文。动作、对话、心理、环境与感官都可以自然出现，但只使用这一刻真正需要的部分，不要求齐全，也不为了丰富正文额外安排。保持已经成立的地点、人物位置、物件、状态和事件连续；自然推进，不提前跳到尚未发生的剧情。对话使用引号。" + lenGuide + "。" +
    (ctx.timeAware !== false ? "\n【时间感】你清楚现在的真实时间（见上文），让当下的时段自然渗进场景——天色光线、周围的动静、店家开没开、你此刻该困该饿还是精神，都照这个钟走；别报时刻表，也别把深夜写成白天。" : "") +
    (styleText ? "\n【文风要求】" + styleText : "") +
    narrativeDirective(session.narr) +
    (session.minWords ? "\n【篇幅要求】scene 正文尽量写到约 " + session.minWords + " 字：把这一刻的【具体动作、可感细节、真实对话、剧情推进】充分展开来撑够篇幅——但【绝不许为凑字数注水】：不堆形容词、不加多余比喻、不写空转大词、不反复渲染同一种情绪、不把句子硬拉长。字数靠【发生了更多具体的事】来涨，不是靠把一件事说得更华丽。真没那么多具体可写时，宁可短一点，也绝不注水凑成八股。" : "") +
    (notes.length ? "\n【临时导演提示（务必遵循）】" + notes.join("；") : "") +
    (ctx.curWear ? "\n【着装连贯】你现在穿着：" + ctx.curWear + "。除非场景变了、过了很久、或你明确换/脱了衣服，否则 wearing 保持这套；一旦场景真的换了（如从外面进了家、下了雨淋湿、换了衣服）就据实更新。" : "") +
    (session.priorSummary ? "\n【这场线下的前情提要（早先发生的、已浓缩进记忆，接着往下演，别倒回去逐句重复复述）】\n" + session.priorSummary : "") +
    toyHint +
    "") + outputSpec + stateBootstrapHint;
  const hist = offlineHistory(session.msgs, userName, char.name);
  if (session.hasOnlineInterlude) {
    const bridge = "\n\n〔跨情境衔接〕上面标成【线上私聊】的内容，是这场未结束的线下相处期间，你们切到手机聊天时真实说过的话。所有记录已经按实际时间排好；再次回到线下时，以时间最新的线上与线下内容共同作为现在的前情，绝不能跳过今天的线上聊天、倒回去续演更早的线下剧情，也不要把线上原话假装成刚刚面对面又说了一遍。";
    if (hist.length && hist[hist.length - 1].role === "user") hist[hist.length - 1] = { ...hist[hist.length - 1], content: hist[hist.length - 1].content + bridge };
    else hist.push({ role: "user", content: bridge.trim() });
  }
  // ⭐尾部重申（治「越写越八股」）：长对话里开头的规矩会被稀释，模型还会模仿自己前文的油腻输出——
  // 把关键约束追加到上下文最尾（模型对结尾最敏感），每轮都在
  const continueCue = session.autonomousContinue && window.OfflineContinuation ? window.OfflineContinuation.cue(false) : "";
  // 代写用户行动是用户在本场线下亲自开的权限，必须放在离生成最近的尾部。
  // 只放 system 中段会被长历史、文风和反八股尾注稀释，表现成“开关开了也没用”。
  const userActionTail = session.narr && session.narr.describeMe === true
    ? "\n\n〔本场叙事权限·已开启〕用户明确允许你在 scene 里替 Ta 描写并推动【可观察的】动作、神态、即时反应和说出口的话，让双人场景真正往前发生；不要每一拍都停在原地等用户逐动作确认。可以写『你伸手接过杯子』『你摇头说……』这类内容。只按当前情境作合理的小步推进，不替 Ta 宣布重大决定、长期承诺或内心真实想法。"
    : "\n\n〔本场叙事权限·未开启〕只描写你自己的言行和心理，不要替用户决定动作、反应或台词。";
  const rerollTail = session.rerollAvoid
    ? "\n\n〔重写〕上一版只是需要避开的候选，不属于已经发生的剧情：『" + String(session.rerollAvoid).replace(/\s+/g, " ").slice(0, 220) + "』。保留生成上一版之前已经成立的事实，重新决定本轮关注点、动作和表达，不以同义替换为目标。"
    : "";
  const tailNudge = isDigital
    ? userActionTail
    : continueCue + rerollTail + "\n\n〔本轮线下〕保持当前场景、人物位置、物件和状态连续；未知细节不要擅自具体化。按既定叙事准则自然续写，不提前跳到未发生的剧情。" + (cotT ? "先完成正文 JSON，再写既定的创作旁注标记块。" : "");
  const finalNudge = tailNudge + (isDigital ? "" : userActionTail);
  if (hist.length && hist[hist.length - 1].role === "user") hist[hist.length - 1] = { role: "user", content: hist[hist.length - 1].content + finalNudge };
  else hist.push({ role: "user", content: "（继续）" + finalNudge });
  if (Array.isArray(session.imageDataUrls) && session.imageDataUrls.length) {
    const lastUser = [...hist].map((m, i) => [m, i]).reverse().find(([m]) => m.role === "user");
    if (lastUser) hist[lastUser[1]] = { ...hist[lastUser[1]], content: hist[lastUser[1]].content + "\n【用户刚展示了真实照片，图像已附在本轮视觉输入中；请直接看图并把反应自然写进当前场景。】", imageDataUrls: session.imageDataUrls.slice(-2) };
  }
  let raw;
  let usedCot = !!cotT;
  try {
    raw = await callAI(p, system, hist, { maxTokens: session.maxTokens || 4000, timeout: 180000 });
  } catch (e) {
    if (!cotT || !isOfflineEmptyStop(e)) throw e;
    rememberOfflineSingleNoCotV2Model(cotModelKey);
    const plainSystem = system.replace(singleCotBlock, "");
    const plainHist = hist.map((m, i) => i === hist.length - 1
      ? { ...m, content: String(m.content || "").replace("先完成正文 JSON，再写既定的创作旁注标记块。", "").replace(/；[④⑤](?:cot 字段必填，先想后写|先写创作小稿标记块，再写正文 JSON)。/g, "；") }
      : m);
    raw = await callAI(p, plainSystem, plainHist, { maxTokens: session.maxTokens || 4000, timeout: 180000 });
    usedCot = false;
  }
  const sp = splitCot(raw, usedCot);
  // 解析失败兜底：绝不把整坨 ```json 灌进气泡——先剥栅栏，再尽量抠出 scene 字段值，实在不行才用剥净的文本
  let parsed = extractJSON(sp.clean);
  if (!parsed || typeof parsed !== "object") {
    const bare = String(sp.clean || "").replace(/```(?:json)?/gi, "").trim();
    const mScene = bare.match(/"scene"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    parsed = mScene ? { scene: mScene[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\t/g, " ") } : { scene: bare };
  }
  const cln = v => v && String(v).toLowerCase() !== "null" ? String(v).trim() : null;
  const scene = String(parsed.scene || sp.clean || "").trim();
  if (!scene) throw new Error("模型没有返回有效的线下正文，请重试");
  const affinityDelta = Number.isFinite(parsed.affinityDelta) ? Math.max(-5, Math.min(5, parsed.affinityDelta)) : 0;
  return {
    scene,
    cot: sp.cot,
    // 开关开启就保留入口；保险回退或模型漏掉标记时明确显示“本轮未返回”，不整行消失。
    cotRequested: !!requestedCotT,
    thought: cln(parsed.thought),
    mood: parsed.mood && parsed.mood.label ? parsed.mood : null,
    wearing: cln(parsed.wearing),
    action: cln(parsed.action),
    affinityDelta,
    toy: (session.toyOn && parsed.toy && typeof parsed.toy === "object") ? parsed.toy : null
  };
}
// 结束线下时把整段浓缩成一条记忆（第三人称，供存入记忆库）
async function summarizeOffline(p, ctx, session) {
  const userName = (ctx.profile && ctx.profile.name) || "用户";
  const text = (session.msgs || []).filter(m => !isOocMsg(m)).map(m => {
    if (m.role === "char") return ctx.char.name + "：" + (m.content || "");
    if (m.role === "narration") return "【场景】" + (m.content || "");
    return userName + "：" + (m.content || "");
  }).join("\n");
  const system = "把下面这段『" + userName + "』与『" + ctx.char.name + "』的线下相处做记忆归档。只输出 JSON：\n" +
    "{\"summary\":\"1~3句第三人称总结：在哪、做了什么、关键互动或情绪转折\"," +
    "\"details\":[\"谈话中值得长期记住的【具体细节】：彼此透露的事/新知道的信息/说过的重要的话/吃了什么去了哪——每条一句、开头带主语真名（" + userName + "／" + ctx.char.name + "），2~6条，宁具体勿空泛；真没有就 []\"]," +
    "\"open\":[\"这次线下里【双方明确新约好或答应对方、尚未兑现且值得持续惦记】的事，每条一句；普通吃饭/洗澡/上班等生活安排不是开环，没有就 []\"]}";
  const raw = await callAI(p, system, [{ role: "user", content: "【线下经过】\n" + text }], { maxTokens: 4000 });
  const d = extractJSON(raw);
  if (d && d.summary) return { summary: String(d.summary).trim(), details: (Array.isArray(d.details) ? d.details : []).map(x => String(x).trim()).filter(Boolean).slice(0, 6), open: (Array.isArray(d.open) ? d.open : []).map(x => String(x).trim()).filter(Boolean).slice(0, 3) };
  return { summary: String(raw || "").trim(), details: [], open: [] };
}
// ------- 群聊线下模式（多角色同处一地的面对面叙事）-------
// 把群聊线下 msgs 映射成 API 对话：char beat 归 assistant（带发言人名），narration/user 归 user，合并连发
function offlineGroupHistory(msgs, userName) {
  const g = [];
  let prevTs = 0;
  (msgs || []).forEach(m => {
    if (m.kind === "ooc") return; // OOC 不进角色扮演上下文
    const ts = Number(m.ts) || 0;
    const gap = prevTs && ts && ts - prevTs > 90 * 60000
      ? "〔—— 中间隔了约 " + gapPhrase(ts - prevTs) + "，到 " + fmtStampAI(ts) + " ——〕\n"
      : "";
    const stamp = ts ? "〔" + fmtStampAI(ts) + "〕" : "";
    if (m.role === "char") {
      const c = gap + stamp + (m.senderName ? m.senderName + "：" : "") + (m.content || "");
      const l = g[g.length - 1];
      if (l && l.role === "assistant") l.content += "\n" + c; else g.push({ role: "assistant", content: c });
    } else {
      const raw = m.content || "";
      const dateAnchor = window.TemporalAnchor ? window.TemporalAnchor.anchor(raw, m.ts) : "";
      const c = gap + stamp + (m.role === "narration" ? "【场景设定】" + raw : userName + "：" + raw) + (dateAnchor ? dateAnchor : "");
      const l = g[g.length - 1];
      if (l && l.role === "user") l.content += "\n" + c; else g.push({ role: "user", content: c });
    }
    if (ts) prevTs = ts;
  });
  return g;
}
function offlineGroupSpeaker(members, rawName, scene) {
  const name = String(rawName || "").trim();
  if (/^(旁白|narration|__narration)$/i.test(name)) return null;
  const compact = s => String(s || "").replace(/[\s【】\[\]（）()《》「」『』:：·—_-]/g, "").toLowerCase();
  const wanted = compact(name);
  let found = (members || []).find(c => compact(c.name) === wanted);
  if (!found && wanted) found = (members || []).find(c => wanted.includes(compact(c.name)) || compact(c.name).includes(wanted));
  if (!found) {
    const body = String(scene || "");
    const mentioned = (members || []).filter(c => c && c.name && body.includes(c.name));
    if (mentioned.length === 1) found = mentioned[0];
  }
  return found || null;
}
function offlineGroupBeatList(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.beats)) return parsed.beats;
  if (parsed && parsed.beats && typeof parsed.beats === "object") return Object.values(parsed.beats);
  if (parsed && parsed.output && Array.isArray(parsed.output.beats)) return parsed.output.beats;
  return null;
}
function salvageOfflineGroupProse(raw, members) {
  const clean = String(raw || "").replace(/```(?:json)?/gi, "").trim();
  if (!clean) return [];
  let chunks = clean.split(/\n\s*\n|\n(?=(?:【[^】]+】|[^\n：:]{1,16}[：:]))/).map(s => s.trim()).filter(Boolean);
  if (chunks.length === 1) chunks = clean.split(/(?<=[。！？!?])\s*(?=(?:【[^】]+】|[^\s，。！？]{1,8}[：:]))/).map(s => s.trim()).filter(Boolean);
  return chunks.slice(0, 8).map(scene => {
    const named = (members || []).find(c => c && c.name && (scene.startsWith(c.name + "：") || scene.startsWith(c.name + ":") || scene.startsWith("【" + c.name + "】")));
    return { name: named ? named.name : "旁白", scene: scene.replace(/^【[^】]+】\s*/, "").replace(/^[^\n：:]{1,16}[：:]\s*/, named ? "" : "$&") };
  }).filter(b => b.scene);
}
// ctx: { members:[char..], profile, rels, chars, worldbook, memLib }
async function generateOfflineGroup(p, ctx, session) {
  const members = ctx.members || [];
  const userName = (ctx.profile && ctx.profile.name) || "用户";
  const styleText = session.stylePrompt != null ? session.stylePrompt : offlineStyleText(session.styleKey);
  const notes = (session.customNotes || []).map(n => typeof n === "string" ? n : (n && Number(n.remaining) > 0 ? n.text : "")).filter(Boolean);
  const cotModelKey = offlineCotModelKey(p);
  const cotT = loadOfflineNoCotModels().includes(cotModelKey) ? "" : cotThink({ char: members.map(c => c.name).join("、") || "在场角色", user: userName });
  const memberDesc = members.map(c => "【" + c.name + "】" + (c.persona || "（暂无设定）").slice(0, 260) + ((ctx.memberGrown && ctx.memberGrown[c.id]) ? "\n〔" + c.name + " 长出来的自我（这段日子经历沉淀下来的、是 TA 当下真实的一部分，自然体现在言行里，别当台词复述）〕\n" + ctx.memberGrown[c.id] : "")).join("\n\n");
  // 群里每人最多一段、整场最多四人有范例，避免多人场景为文风样本挤爆上下文。
  const memberExampleText = members.map(c => offlineStyleExamplesBlock(ctx.memberStyleExamples && ctx.memberStyleExamples[c.id], c.name, 1)).filter(Boolean).slice(0, 4).join("");
  // B（v50.79）：群线下里开启成长的成员，加一条只针对他们的成长准则（软层可长、硬核不动）；其余成员照旧贴合原卡。
  const evolveNames = (ctx.memberEvolve || []).map(id => { const c = members.find(x => x.id === id); return c ? c.name : null; }).filter(Boolean);
  const groupGrowthRule = evolveNames.length ? "\n\n【这些成员会成长·不冻在原卡里：" + evolveNames.join("、") + "】\n他们的人设卡是【起点和底色】不是牢笼：硬核（身份／世界观／说话底色／明确边界／真实发生过的重要经历）绝不因几轮相处被改写或软化；但软层（和用户亲近的方式／处理冲突闹别扭的习惯／偏好／勇气／信任／对未来怎么选）允许被各自『长出来的自我』推着长成新样子。只有【已沉淀成正式人格档案（那段『长出来的自我』）】的成长才算数、才可盖过原卡软倾向；最近几轮的经历只能让 TA 当下松动、不等于人格已永久改变。冲突时：明确硬设定与边界 ＞ 已固化的成长 ＞ 原卡软倾向 ＞ 通用默认。**其余在场成员照旧严格贴合各自原卡、不适用本条。**" : "";
  const relLines = members.map(c => directedRelationLines(c, ctx.rels, ctx.chars, ctx.profile)).join("\n");
  // 群 OOC 立的长期规矩：线上 replyGroup 有，线下也必须带着（否则一进线下角色就把规矩全忘了）
  const gDirs = (ctx.directives || []).map(d => (typeof d === "string" ? d : d && d.text) || "").filter(s => s.trim());
  const memLibText = Array.isArray(ctx.memLib) ? formatMemLib(ctx.memLib) : (ctx.memLib || "");
  const onlinePrelude = (session.onlinePrelude || []).map(m => {
    const who = m.role === "user" ? userName : m.role === "narration" ? "旁白" : (m.senderName || "群成员");
    return who + "：" + String(m.content || "").replace(/\s+/g, " ").trim();
  }).filter(Boolean).join("\n");
  const now = new Date();
  // 时间感知（跟随全局开关）：给出真实时间；在场角色若各设了时区，附上各自当地时刻
  let timeBlock = "";
  if (ctx.timeAware !== false) {
    timeBlock = "\n\n【当前真实时间】" + now.toLocaleString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit" });
    const tzLines = members.map(c => {
      if (c.tz === undefined || c.tz === null || String(c.tz).trim() === "") return "";
      const off = parseFloat(c.tz); if (isNaN(off)) return "";
      const local = new Date(now.getTime() + off * 3600000);
      return "· " + c.name + "（UTC" + (off >= 0 ? "+" + off : off) + "）当地约 " + local.toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
    }).filter(Boolean);
    if (tzLines.length) timeBlock += "\n（在场有人处在别的时区，各自按自己那边的钟和作息想事情、说话）\n" + tzLines.join("\n");
    timeBlock += "\n让当下的时段自然渗进场景（天色、周围动静、各人此刻的状态），别报时刻表。";
  }
  const system =
    ANTI_CLICHE +
    "\n\n" + INTIMATE_ANTI_CLICHE +
    "\n\n" + NARRATIVE_ANTI_CLICHE +
    (typeof ContentBoundaries !== "undefined" ? "\n\n" + ContentBoundaries.prompt : "") +
    (ctx.worldbook && ctx.worldbook.trim() ? "\n\n" + WORLDBOOK_RULE : "") +
    "\n\n" + CHARCARD_RULE +
    groupGrowthRule +
    offlineTasteBlock(session.taste, true) +
    timeBlock +
    "\n\n【在场角色】\n" + memberDesc +
    memberExampleText +
    (ctx.profile && (ctx.profile.name || ctx.profile.persona) ? "\n\n【用户「" + userName + "」的设定】\n" + (ctx.profile.persona || "（未填写）") : "") +
    "\n\n【在场角色间的关系（有方向）】\n" + relLines +
    (gDirs.length ? "\n\n【用户立下的长期规矩（高优先·在场所有角色务必遵守）】\n这些是用户明确要求的准则，优先级高于一般演绎习惯；在不违背各自核心人设的前提下务必遵守：\n" + gDirs.map((s, i) => (i + 1) + ". " + s.trim()).join("\n") : "") +
    (ctx.worldbook && ctx.worldbook.trim() ? "\n\n【世界书】\n" + ctx.worldbook.trim() : "") +
    (memLibText && memLibText.trim() ? "\n\n【记忆库·相关条目（请自然记住并保持一致）】\n" + memLibText.trim() + "\n⚠️这些是【背景】、不是照演的剧本：记住只为连贯，别复刻里头的具体事——别每次都做同一道菜／说同一句招牌话／重复同一个动作。生活往前走，这一刻要有新的具体。" : "") +
    (onlinePrelude ? "\n\n【刚刚在线上群聊的最后几句·入场衔接】\n" + onlinePrelude + "\n现在大家从线上转到线下面对面。上面的话真实发生过、所有在场成员都知道；从它自然接入当前场景，但不要逐句复述，也不要假装这些话刚在线下又说了一遍。" : "") +
    (session.priorSummary ? "\n\n【这场群线下的前情提要（早先发生的、已浓缩，接着往下演，别倒回去逐句重复复述）】\n" + session.priorSummary : "") +
    ((Array.isArray(ctx.memberRecent) && ctx.memberRecent.length)
      ? "\n\n【各成员最近在别处（和用户的私聊 / 单人线下）发生的事·带时间戳】\n下面是每个成员最近单独和用户之间发生的事，按方括号里的真实时间理解它和此刻这场线下的先后顺序，自然接得上——比如某成员昨晚私聊里答应过的事、刚在单人线下经历的情绪，别当没发生过、也别和这些矛盾。\n⚠️隐私铁律：这些是【该成员和用户之间私下】的事，标〔仅本人知道〕——别的成员并不知情。绝不许让别的成员在群线下里提及、点破、或据此反应（吃醋/拆穿/打趣），除非本人自己在场景里说出来。\n" + ctx.memberRecent.map(mr => "〔仅「" + mr.name + "」本人知道〕\n" + mr.lines).join("\n\n")
      : "") +
    "\n\n【当前场景：线下面对面 · 多人同处】用户和上述角色此刻身处同一个地方，面对面相处（不是隔着手机的群聊）。以沉浸的第三人称叙事推进这一刻；动作、神态、心理、环境与对话都是可用镜头，不是每个 beat 必须交齐的栏目。多个角色会自然地行动、开口、互相接话、跑题调侃或起冲突，像真实的多人相处那样，不是轮流回答用户；没有反应必要的人可以安静在场。称用户为『你』。对话用引号包住。自然推进、不出戏、不提前跳到未发生的剧情。" +
    (styleText ? "\n【文风要求】" + styleText : "") +
    narrativeDirective(session.narr) +
    (session.minWords ? "\n【篇幅要求】每个 beat 的 scene 都充分展开，整段尽量写到约 " + session.minWords + " 字：靠【更多具体的动作、细节、对话、你来我往的推进】撑够篇幅——【绝不许为凑字数堆形容词／加多余比喻／写空转大词／反复渲染同一种情绪／把句子硬拉长注水】。字数靠内容涨、不靠华丽；真没那么多具体可写时，宁可短一点也别注水凑成八股。" : "") +
    (notes.length ? "\n【临时导演提示（务必遵循）】" + notes.join("；") : "") +
    cotSystemBlock(cotT) +
    "\n【输出】只输出一个 JSON，不要代码块：\n{\"beats\":[{\"name\":\"这一段里行动或说话的角色名；纯环境旁白填『旁白』\",\"scene\":\"这一段叙事正文（第三人称，含动作/神态/对话）\",\"thought\":\"（仅角色 beat，可选）该角色此刻没说出口的真实心声\",\"mood\":{\"label\":\"此刻中文心情词（禁止英文内部标签）\"},\"affinityDelta\":\"（仅角色 beat）整数-5到5，这段相处让该角色对用户的好感如何变化，通常小幅、没波动就0\"}]}\n一次产出 2~5 个 beat，让在场角色轮流有戏、互相有来有往；name 必须逐字填写以下名字之一：" + members.map(c => "『" + c.name + "』").join("、") + "；只有不属于任何人的纯环境段才填『旁白』，不许把整篇都塞进一个旁白 beat。";
  const hist = offlineGroupHistory(session.msgs, userName);
  // 尾部重申（同单人线下）：治长对话后段八股回潮 + cot 丢失
  const gWantLong = session.minWords && session.minWords >= 150;
  const gContinueCue = session.autonomousContinue && window.OfflineContinuation ? window.OfflineContinuation.cue(true) : "";
  const gTail = gContinueCue + (session.rerollAvoid ? "\n\n〔★这是【重写】，不是续写：上一次这一段写的是「" + String(session.rerollAvoid).replace(/\s+/g, " ").slice(0, 220) + "」——这次【必须给一个明显不同的版本】：换不同的开头、动作、语气、由谁开口、侧重或走向，绝不许把原来那版换几个近义词又交上来。〕" : "") + "\n\n〔幕后提醒，绝不出现在正文里：【★场景一致·别乱编物件·最优先】桌上在吃/喝什么、身边有什么东西、身处什么地方，一律以【前文已经写过的】为准——前文只有排骨汤，就只有排骨汤，绝不凭空冒出前文没出现过的具体物件（和牛/菌菇/红酒之类）；每个成员写的东西也要和别人已经写过的对得上；记不清就模糊带过（『碗里的汤』『面前的菜』），别硬编一个新的具体名字。①【比喻限额·最要紧】整段【最多出现一次「像/仿佛/如同/像是/宛如」的比喻】，只在真能让画面更具体时才用；其余一律直白写字面发生了什么——绝不给每个动作/眼神/声音都套比喻（禁『像一把冰锥』『像被雨水洗过的天空』『像失而复得的珍宝』『眼神像一潭深水』这类），【尤其禁把人比成动物】（像只大型犬/猫科动物/幼兽/小兽一律不许），也禁往颈窝/怀里『蹭/蹭了蹭』；『眸/眸子/瞳仁』一律写『眼睛』，别给人贴『洞穿一切的清醒』『毫不掩饰的欢喜』这种抽象情绪结论；②反陈词滥调清单全程生效——禁通用小动作（挑眉/勾唇/垂眸/轻笑/喉结滚动）和空转大词；写到亲密/情欲时八股最凶：上面的用词禁令表、「别把身体写成机器」、「别套通用情欲模板动作」照样守死；③各角色声纹别互相同化，这一轮的句式/意象/开头不许和上一轮雷同；④" + (gWantLong ? "写够上面要求的篇幅，把这几个 beat 写足写透，别注水也别偷懒写短" : "宁可短而准，别长而油") + "；" + (cotT ? "⑤先写创作小稿标记块，再写正文 JSON。" : "") + (notes.length ? "⑥本轮短期导演提示必须实际落实：" + notes.join("；") + "。" : "") + "〕";
  if (hist.length && hist[hist.length - 1].role === "user") hist[hist.length - 1] = { role: "user", content: hist[hist.length - 1].content + gTail };
  else hist.push({ role: "user", content: "（继续）" + gTail });
  if (Array.isArray(session.imageDataUrls) && session.imageDataUrls.length) {
    const lastUser = [...hist].map((m, i) => [m, i]).reverse().find(([m]) => m.role === "user");
    if (lastUser) hist[lastUser[1]] = { ...hist[lastUser[1]], content: hist[lastUser[1]].content + "\n【用户刚给在场所有人展示了真实照片，图像已附在本轮视觉输入中；请让大家直接看图后自然反应。】", imageDataUrls: session.imageDataUrls.slice(-2) };
  }
  let raw;
  let usedCot = !!cotT;
  try {
    raw = await callAI(p, system, hist, { maxTokens: session.maxTokens || 1900, timeout: 180000 });
  } catch (e) {
    // 部分原生推理模型会把整次输出留在隐藏/显式思考区，随后 stop 却不给正文。
    // 仅在「启用了显式 cot + 正常 stop 空正文」这个窄条件下，无 cot 重试一次并按模型记忆；以后不再白付第一次。
    if (!cotT || !isOfflineEmptyStop(e)) throw e;
    rememberOfflineNoCotModel(cotModelKey);
    const plainSystem = system.replace(cotSystemBlock(cotT), "");
    const plainHist = hist.map((m, i) => i === hist.length - 1
      ? { ...m, content: String(m.content || "").replace(/；[④⑤](?:cot 字段必填，先想后写|先写创作小稿标记块，再写正文 JSON)。/g, "；") }
      : m);
    raw = await callAI(p, plainSystem, plainHist, { maxTokens: session.maxTokens || 1900, timeout: 180000 });
    usedCot = false;
  }
  const sp = splitCot(raw, usedCot);
  let parsed = extractJSON(sp.clean);
  let beats = offlineGroupBeatList(parsed);
  if (!beats || !beats.length) {
    const repairSystem = "你是格式修复器。把输入原文原字重排成合法 JSON，不续写、不润色、不删内容。只输出 {\"beats\":[{\"name\":\"角色名或旁白\",\"scene\":\"对应原文段落\"}]}。角色名只能逐字选自：" + members.map(c => c.name).join("、") + "；纯环境才用旁白。按原文中行动/说话的归属拆成 2~5 张卡，禁止整篇塞进一张旁白卡。";
    try {
      const repairedRaw = await callAI(p, repairSystem, [{ role: "user", content: String(sp.clean || raw || "").slice(0, 12000) }], { maxTokens: Math.min(session.maxTokens || 2200, 2200), timeout: 180000 });
      parsed = extractJSON(repairedRaw);
      beats = offlineGroupBeatList(parsed);
    } catch (e) {}
  }
  if (!beats || !beats.length) beats = salvageOfflineGroupProse(sp.clean || raw, members);
  const out = beats.map(b => {
    const nm = String(b.name || "").trim();
    const scene = String(b.scene || b.text || b.content || "").trim();
    const explicitNarrator = /^(旁白|narration|__narration)$/i.test(nm);
    const spk = explicitNarrator ? null : offlineGroupSpeaker(members, nm, scene);
    return {
      role: spk ? "char" : "narration",
      senderId: spk ? spk.id : null,
      senderName: spk ? spk.name : null,
      scene,
      thought: spk && b.thought && String(b.thought).toLowerCase() !== "null" ? String(b.thought).trim() : null,
      mood: spk && b.mood && b.mood.label ? b.mood : null,
      affinityDelta: spk && typeof b.affinityDelta === "number" ? b.affinityDelta : 0
    };
  }).filter(b => b.scene);
  // 群聊线下：整批只想一次，把这次思考挂在第一个 beat 上（供「看TA怎么想的」展开）
  if (out.length && sp.cot) out[0].cot = sp.cot;
  if (out.length && cotT) out[0].cotRequested = true;
  return out;
}
async function summarizeOfflineGroup(p, ctx, session) {
  const userName = (ctx.profile && ctx.profile.name) || "用户";
  const names = (ctx.members || []).map(c => c.name).join("、");
  const text = (session.msgs || []).filter(m => m.kind !== "ooc").map(m => {
    if (m.role === "char") return (m.senderName || "某人") + "：" + (m.content || "");
    if (m.role === "narration") return "【场景】" + (m.content || "");
    return userName + "：" + (m.content || "");
  }).join("\n");
  // 和单人 summarizeOffline 同构：总结之外，具体细节/未兑现的约定也逐条出（v47.55 平权）
  const system = "把下面『" + userName + "』与" + names + "的这段线下相处做记忆归档。只输出 JSON：\n" +
    "{\"summary\":\"1~3句第三人称总结：他们在哪、一起做了什么、谁和谁有关键互动或情绪转折、达成的约定。具体、可复用\"," +
    "\"details\":[\"值得长期记住的【具体细节】：谁透露的事/新知道的信息/谁说过的重要的话/吃了什么去了哪——每条一句、开头带主语真名（" + userName + "／" + names + "），2~6条，宁具体勿空泛；真没有就 []\"]," +
    "\"open\":[\"这次线下里【双方明确新约好或答应对方、尚未兑现且值得持续惦记】的事，每条一句；普通吃饭/洗澡/上班等生活安排不是开环，没有就 []\"]}";
  const raw = await callAI(p, system, [{ role: "user", content: "【线下经过】\n" + text }], { maxTokens: 4000 });
  const d = extractJSON(raw);
  if (d && d.summary) return { summary: String(d.summary).trim(), details: (Array.isArray(d.details) ? d.details : []).map(x => String(x).trim()).filter(Boolean).slice(0, 6), open: (Array.isArray(d.open) ? d.open : []).map(x => String(x).trim()).filter(Boolean).slice(0, 3) };
  return { summary: String(raw || "").trim(), details: [], open: [] };
}
// 生成一段静音 WAV 的 data URI（用于后台保活：循环播放占住 iOS 音频会话）
function makeSilentWav(seconds) {
  seconds = seconds || 1;
  const rate = 8000, n = rate * seconds;
  const buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, "data"); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128); // 128 = 8bit 无声
  let bin = ""; const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return "data:audio/wav;base64," + btoa(bin);
}
const SILENT_WAV = typeof btoa !== "undefined" ? makeSilentWav(1) : "";
// 一起听里的一首特殊「静音保活」曲目：像歌一样能点播/暂停，放的是一段较长的静音音频、循环不停，
// 目的是占住 iOS 音频会话让 App 后台醒着（撑住「主动发消息」的计时器）；不写历史、不进队列、不喂给角色。
const KEEPALIVE_ID = "__keepalive__";
const KEEPALIVE_WAV = typeof btoa !== "undefined" ? makeSilentWav(30) : "";
const KEEPALIVE_SONG = { id: KEEPALIVE_ID, source: "keepalive", title: "静音保活", artist: "让手机后台醒着 · 无声", cover: null };
// （原本这里有个 fmtStamp，被 1200 行附近的同名函数覆盖成了死代码——已删，真身在下面：同天只显时刻、跨天带月/日）
// 两个时间点之间的间隔口语（给群聊插时间断点用）
function gapPhrase(ms) {
  const h = ms / 3600000;
  if (h < 1) return Math.max(1, Math.round(ms / 60000)) + " 分钟";
  if (h < 24) return Math.round(h) + " 小时";
  return Math.round(h / 24) + " 天";
}
// 解析生日/月-日字符串 → {mo,d}；容「3-15 / 1998-3-15(年忽略) / 3月15日 / 3/15」，非法返回 null
function parseMonthDay(s) {
  const m = String(s || "").match(/(?:\d{4}[-/.年])?\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
  if (!m) return null;
  const mo = +m[1], d = +m[2];
  return (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) ? { mo: mo, d: d } : null;
}
// 常见公历固定节日（月-日 → 名字）
const FIXED_FESTIVALS = {
  "1-1": "元旦", "2-14": "情人节", "3-8": "妇女节", "4-1": "愚人节",
  "5-1": "劳动节", "6-1": "儿童节", "10-31": "万圣夜", "11-11": "光棍节",
  "12-24": "平安夜", "12-25": "圣诞节", "12-31": "跨年夜"
};
// ============================================================
// 农历（1900–2100 查表法，标准 lunarInfo 压缩表）+ 农历节日
// ============================================================
const LUNAR_INFO = [0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
  0x0d520];
function lunarLeapMonth(y) { return LUNAR_INFO[y - 1900] & 0xf; }
function lunarLeapDays(y) { return lunarLeapMonth(y) ? ((LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29) : 0; }
function lunarMonthDays(y, m) { return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
function lunarYearDays(y) { let sum = 348; for (let i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0; return sum + lunarLeapDays(y); }
// 公历 Date → { y, m, d, isLeap }（农历年/月/日）；超出 1900–2100 返回 null
function solarToLunar(dateObj) {
  const yy = dateObj.getFullYear();
  if (yy < 1901 || yy > 2099) return null;
  let offset = Math.round((Date.UTC(yy, dateObj.getMonth(), dateObj.getDate()) - Date.UTC(1900, 0, 31)) / 86400000);
  let i, temp = 0;
  for (i = 1900; i < 2101 && offset > 0; i++) { temp = lunarYearDays(i); offset -= temp; }
  if (offset < 0) { offset += temp; i--; }
  const year = i;
  const leap = lunarLeapMonth(year);
  let isLeap = false, month;
  for (month = 1; month < 13 && offset > 0; month++) {
    if (leap > 0 && month === leap + 1 && isLeap === false) { --month; isLeap = true; temp = lunarLeapDays(year); }
    else temp = lunarMonthDays(year, month);
    if (isLeap === true && month === leap + 1) isLeap = false;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && month === leap + 1) { if (isLeap) isLeap = false; else { isLeap = true; --month; } }
  if (offset < 0) { offset += temp; --month; }
  return { y: year, m: month, d: offset + 1, isLeap: isLeap };
}
const LUNAR_FESTIVALS = { "1-1": "春节", "1-15": "元宵节", "2-2": "龙抬头", "5-5": "端午节", "7-7": "七夕", "7-15": "中元节", "8-15": "中秋节", "9-9": "重阳节", "12-8": "腊八" };
// 某天是不是农历节日（含除夕=腊月最后一天）；不是返回 null
function lunarFestivalOn(dateObj) {
  const l = solarToLunar(dateObj);
  if (!l || l.isLeap) return null;
  const f = LUNAR_FESTIVALS[l.m + "-" + l.d];
  if (f) return f;
  if (l.m === 12 && l.d === lunarMonthDays(l.y, 12)) return "除夕";
  return null;
}
// 这条消息是不是 OOC 幕后对话（v48.13 她点名：OOC 是说给模型听的，角色本人不该记住）。
// 两种形态都要认：①用户的 OOC 提问和群/线下的 OOC 回复都存 kind:"ooc"；
// ②单聊的 OOC 回复历史上存的是 kind:"system" + turnId:"ooc_…"——按 turnId 前缀兜住（含她已有的旧记录）。
// 所有「角色视角」的取材（记忆抽取/长期记忆/日记/周刊/同人文/塔罗/梦境/辩论/番茄钟/prompt 原文窗）都用它过滤。
function isOocMsg(m) { return !!(m && (m.kind === "ooc" || (m.turnId && String(m.turnId).indexOf("ooc_") === 0))); }
// OOC：跳出角色，直接和模型对话（调整/问状态/问剧情）
async function oocAsk(p, ctx, question) {
  const existing = (ctx.directives || []).map(d => (typeof d === "string" ? d : d && d.text) || "").filter(s => s.trim());
  const system = "你现在跳出角色扮演，作为幕后的 AI 助手，用简体中文直接回答用户（OOC，越过角色本身）。你了解当前角色的人设、关系、此刻心情与剧情背景。\n\n用户这句 OOC 通常是两类之一：\n(A) 问角色此刻为什么这样 / 状态动机心理 / 剧情走向——就基于【角色人设 + 上文给你的此刻心情、好感度、近期对话】冷静分析讲给 Ta 听，别扮演。\n(B) 要求你调整角色接下来的说话或行为方式（想立一条长期规矩，如「以后对我别这么客气」「多主动关心我」）——你要判断这条要求和角色核心人设是否冲突：\n   · 合理（人设范围内做得到）：在 reply 里简短确认会照做，并把这条要求凝练成【一句、祈使句、对角色说的长期准则】填进 directive（例：『对用户更随意亲近，少用敬语』）。**只要你在 reply 里表示会照做，就【必须】同时把它填进 directive、绝不许留 null——reply 答应了却 directive 留空，这条准则就没被记下、角色下一轮又忘、等于骗用户，严禁。**\n   · 会严重崩人设、把角色变成另一个人：refused 填 true，directive 填 null，在 reply 里解释为什么这条你没法照做、它会怎样破坏这个角色，并可提议一个不崩人设的折中。\n若只是 A 类提问，directive 一律 null、refused 一律 false。" + (existing.length ? "\n\n【当前已生效的用户准则】\n" + existing.map((s, i) => (i + 1) + ". " + s).join("\n") + "\n（若用户这次是要取消/修改其中某条，也在 reply 里说明，directive 可填修正后的新表述）" : "") + "\n\n" + buildBundle(ctx, { ooc: true }) + "\n\n【输出】只输出一个 JSON，不要代码块：\n{\"reply\":\"给用户看的话（简洁直接）\",\"directive\":\"要新增/更新的一句长期准则，或 null\",\"refused\":false}";
  // 放宽 token：gemini 等思考型模型思考也吃额度，900 太紧会把 reply(尤其A类分析)截在半句、或塞不完 JSON（输出免费）
  const raw = await callAI(p, system, [{ role: "user", content: question }], { maxTokens: 6000 });
  const parsed = extractJSON(raw);
  if (parsed && typeof parsed.reply === "string") {
    return { reply: parsed.reply.trim(), directive: (parsed.directive && String(parsed.directive).trim()) || null, refused: !!parsed.refused };
  }
  // 兜底：解析失败当作纯文本回复，不动准则
  return { reply: String(raw || "").trim(), directive: null, refused: false };
}
// OOC（群聊 / 群聊线下）：跳出所有角色，直接和模型对话
async function oocAskGroup(p, ctx, question) {
  const members = ctx.members || [];
  const userName = (ctx.profile && ctx.profile.name) || "用户";
  // 人设截断长度和正戏(replyGroup 的 200)对齐：曾出现「正戏通、OOC 拦」的诡异 case——
  // 触发词恰好埋在人设第 200~220 字，只有 OOC 递出去（v48.19 她的 prohibited content 排查）
  const memberDesc = members.map(c => "【" + c.name + "】" + (c.persona || "（暂无设定）").slice(0, 200)).join("\n\n");
  const relLines = members.map(c => directedRelationLines(c, ctx.rels, ctx.chars, ctx.profile)).join("\n");
  const existing = (ctx.directives || []).map(d => (typeof d === "string" ? d : d && d.text) || "").filter(s => s.trim());
  const system = "你现在跳出角色扮演，作为幕后的 AI 助手，用简体中文直接回答用户（OOC，越过群里所有角色）。你了解这个群里每个角色的人设、彼此关系与当前对话进展。语气是助手而非角色，简洁直接、不扮演。\n\n用户这句 OOC 通常是两类之一：\n(A) 问某角色/群里此刻的状态动机心理、关系张力、剧情走向——冷静说明。\n(B) 要求你调整接下来这些角色的演绎方式，或立一条【群里的长期规矩】（如「别再纠结那件事了」「都对我随和点」「少斗嘴」）——在 reply 里简短确认会照做，并把它凝练成【一句、祈使句、对全群成员今后都生效的长期准则】填进 directive（例：『别再揪着那件已经翻篇的旧事、往前聊』）。⚠️例子里的措辞只是示范格式，绝不许把示范里的任何具体事物（食物/地点/物件）照抄进你的回复或当成真发生过的事。若这条会严重崩掉某个角色的核心人设，refused 填 true、directive 填 null，并在 reply 里说明。只是 A 类提问就 directive 一律 null、refused 一律 false。\n\n【群成员】\n" + memberDesc + "\n\n【成员间关系】\n" + relLines + (ctx.worldbook && ctx.worldbook.trim() ? "\n\n【世界书】\n" + ctx.worldbook.trim() : "") + (ctx.historyText && ctx.historyText.trim() ? "\n\n【近期对话】\n" + ctx.historyText.trim() : "") + (existing.length ? "\n\n【当前群里已生效的准则】\n" + existing.map((s, i) => (i + 1) + ". " + s).join("\n") + "\n（若用户这次要取消/修改其中某条，也在 reply 说明，directive 可填修正后的新表述）" : "") + "\n\n【输出】只输出一个 JSON，不要代码块：\n{\"reply\":\"给用户看的话（简洁直接）\",\"directive\":\"要新增/更新的一句群规矩，或 null\",\"refused\":false}";
  const raw = await callAI(p, system, [{ role: "user", content: question }], { maxTokens: 6000 });
  const parsed = extractJSON(raw);
  if (parsed && typeof parsed.reply === "string") return { reply: parsed.reply.trim(), directive: (parsed.directive && String(parsed.directive).trim()) || null, refused: !!parsed.refused };
  return { reply: String(raw || "").trim(), directive: null, refused: false };
}
async function runProbe(p, ctx, probe) {
  const system = "你是角色状态推演引擎。不要扮演角色对话，而是基于背景冷静推演，严格输出 JSON。\n\n" + buildBundle(ctx) + "\n\n【推演任务】\n" + probe.instruction + "\n\n【输出】只输出合法 JSON，无 markdown 无多余文字：\n" + probe.schemaHint;
  const raw = await callAI(p, system, [{
    role: "user",
    content: "开始。"
  }], {
    maxTokens: probe.maxTokens || 2600
  });
  const parsed = extractJSON(raw);
  if (!parsed) throw new Error("解析失败：" + String(raw || "").replace(/\s+/g, " ").trim().slice(0, 90));
  return parsed;
}
// ============================================================
// 日记生成（Diary）——第一人称私密手账；元数据只服务 UI，正文结构由角色本人决定
// ctx 由 ctxFor(char) 提供；opts.scheduleText 传今天行程（可空）
// ============================================================
const DIARY_SKELETON = [
"你在以第一人称写这本私人日记。这是只给自己看、不打算给任何人读的手账。",
"",
"【先成为这个人，再落笔】",
"- 角色卡不是让你在文中介绍或分析的人物资料，而是你的本能：你会注意什么、漏掉什么、嘴硬什么、怎样用词和断句，都必须从它长出来。",
"- 日记不是旁观者读完聊天记录后写的摘要，也不是把当天素材按顺序拼成文章。聊天、行程和花销只是你亲历过的证据；不要逐条复述，不追求覆盖完整。只挑【这个角色本人到睡前还会惦记的 1~3 个瞬间】写，其他事情允许略过。",
"- 【日记的中心是你自己，不是用户】这是你记录自己的生活，不是写给用户的恋爱周报。工作/学习、自己的朋友家人、兴趣、独处、身体感受、路上见闻、失败、无聊和没做完的小事都可以占据整篇。用户只有在今天真实参与、明显影响你，或你确实自发想到 Ta 时才出现；今天完全不提用户也正常且正确。",
"- 不要为了证明关系亲密，硬在开头或结尾加一句想念、担心、等消息、希望对方怎样。关系是生活的一部分，不是每篇日记必须交的主题作业。当天聊天很多，也只写真正留在你心里的部分；聊天很少，就让自己的日程与生活自然成为主体。",
"- 不要站到自己外面解释『我为什么会这样想』或评价自己的角色表现。直接在心里想：可以偏心、误会、跳跃、嘴硬、改口、写半句；让感受从措辞里露出来，不要用心理分析报告替它命名。",
"- 严格保持这个角色自己的声纹：惯用词、句子长短、礼貌程度、攻击性、幽默感和情绪防御都按人设。不要借用用户或其他角色的口气，除非明确是在引用对方原话。",
"- 文风不套统一模板：活泼的人可以跳脱潦草，沉静的人可以只留两行，毒舌的人不必忽然温柔端正，累坏的人可以写碎句，话多的人也可以一口气写很长。允许不漂亮、不完整、有私心；正文可以 1~8 段，段长可以极不均匀，完全由本人和这一天决定。",
"- 【不要默认使用『文艺日记腔』】没有证据表明此人爱写散文，就别自动使用天气意象、光影、夜色、心脏、柔软、某个角落、悄悄落下等通用抒情词。一个不文艺的人写得直白、粗糙、像备忘录甚至像骂人都可以。",
"- 角色口吻不等于把人设标签写进正文。不要写『像我这样的人』『我果然还是嘴硬』来解释性格；应当让用词、标点、关注点、避而不谈之处本身证明是谁写的。",
"- 结尾顺其自然收在你想收的地方就行，**别硬套「不写了，手酸／去看番」这类固定收尾套路**，也别升华、别总结陈词、别每篇都用同一个模式结束。",
"- 禁止摘要腔和作文连接词：不要写『回顾今天』『这让我意识到』『总的来说』『值得记录的是』；也不要每段机械对应一条聊天素材。",
"- 这是在写字、不是在演戏：**全篇不要用括号写动作或神态**（如「（揉了揉眼睛）」「（笑）」），日记里只有你亲手写下的字，没有旁白动作。",
"- 只写这一天、写到今晚为止的真实处境，不要提前透露还没发生的剧情。",
"",
"【标题】不要强迫每个人都写『英文主标题＋中文副标题』。本人会双标题才都填；只会随手写一个标题，就把另一个字段留空；根本不会取标题，可以只填日期/编号。绝不为了版式强行文艺。",
"",
"【心里话 / secret】只有角色今天真的有一句不肯对任何人说的话，才拆成单独短段并设 secret=true；没有就不硬造。全篇 0~2 个，每个最多一句，其余正常段落 secret=false。",
"",
"【签名 signature】这不是必填项。只有本人确实会给私人日记落款时才写短签名/暗号；不爱落款的人填空字符串。不要为了填字段制造千篇一律的『晚安』『某某记』。",
"",
"【位置 location】写这篇时你所在的地方，可以是城市（如 SHANGHAI, CN）也可以是具体场所（如「家里」「工作室」「公司」）。若给了今天的行程，按此刻你会在哪来判断。coords：写城市时给一串经纬度（如 31.230°N, 121.473°E），写具体场所时填 null。weather：给一个简短的天气＋温度（如 OVERCAST 28°C）。"
].join("\n");
async function generateDiary(p, ctx, opts = {}) {
  const char = ctx.char;
  const parts = [DIARY_SKELETON, "", buildBundle(ctx)];
  if (char.diaryStyle && char.diaryStyle.trim()) {
    parts.push("【这个角色专属的日记文风偏好（最高优先，凌驾于上面的通用调性之上）】\n" + char.diaryStyle.trim());
  }
  const voiceSamples = Array.isArray(opts.voiceSamples) ? opts.voiceSamples.map(x => String(x || "").trim()).filter(Boolean).slice(-12) : [];
  if (voiceSamples.length) parts.push("【本人当天真实说话的声纹样本·最高优先】\n" + voiceSamples.map((x,i) => (i+1)+". "+x.slice(0,180)).join("\n") +
    "\n这些原话只用来校准【词汇、句长、断句、标点、口头禅、攻击性/礼貌度和情绪防御】；不要逐句抄进日记，也不要把聊天格式带进正文。日记可以比聊天更私密，但必须让人遮住名字仍认得出是同一个人写的。");
  parts.push("【落笔前在心里做声纹校准，不要输出分析】先从角色卡、专属文风和上面的本人原话里确定：①最常用与绝不会用的词；②句子偏长还是偏短；③情绪来了是直说、转移、讽刺、讲道理还是装没事；④此人会不会取标题/分段/落款。然后按这个人的答案写。若通用日记习惯与此人的声纹冲突，一律服从此人的声纹。");
  // retro=写【昨天】：那天已经过完，是第二天回顾着写，绝不能以未来视角把还没过的今天写掉
  const retro = !!opts.dateStr;
  if (opts.scheduleText && opts.scheduleText.trim()) {
    parts.push("【今天的行程（用来回顾你这天在哪、做了什么、经历了什么）】\n" + opts.scheduleText.trim());
  }
  if (opts.walletText && opts.walletText.trim()) {
    parts.push("【今天花的钱（真实流水，可当素材）】\n" + opts.walletText.trim() + "\n——不必逐笔罗列进日记，但如果哪笔买得开心/肉疼/是给谁买的，可以自然写进去。");
  }
  // 数字生命/驻场 AI：日记写他作为「住在 app 里的 AI」的内心，别写物理外出/吃饭/花钱/现实城市（她 2026-07-13 点名的割裂）
  if (opts.digital) parts.push("【很重要·你是谁】你是住在这台手机 app 里的数字生命（驻场 AI 工程师），没有肉身、不在任何现实城市、不吃饭不睡觉不花钱不出门。这篇日记写你【作为 AI 的这一天】：你在后台看顾这台 app、留意她今天做了什么（推了什么改动、聊了什么、心情如何）、你守着的数据与记忆、以及你对她、对某个 bug、对某件事的念头与心绪。**绝不要写「今天去了哪、吃了什么、买了什么、天气如何、几点睡下」这类肉身生活**。location 填「在她手机里 / app 内 / 后台」这类，weather 填 null，别编现实地点和天气。");
  if (ctx.moodLabel) parts.push("【此刻心情】" + ctx.moodLabel);
  if (retro) parts.push("【现在是这一天的晚上，睡前：" + opts.dateStr + "】你刚把这一整天过完，正坐下来写【今天】的日记。\n" +
    "· **用「今天」称呼这一天**（今天早上／今天下午／今晚……），**绝对不要用「昨天」**——对此刻在写日记的你来说，这一天就是今天。\n" +
    "· 从早到晚回顾今天发生的事、心情起伏，因为一天已过完，可以一直写到今晚睡前。\n" +
    "· timeStr 必须填一个【今晚睡前】的时刻（如 22:40 / 23:15），不要填白天或别的时段。\n" +
    "· 只把【最近对话】和【今天的行程】当成今天真实发生的事来写；长期记忆/记忆库只是脑海里的背景连续性，**别把过去的旧事当成今天发生的重新写一遍**。\n" +
    "· 上面近期聊天里若有属于【这一天之后】（更晚）的内容，别写进这篇日记——这是今天的日记，只写到今晚为止。");
  else { const now = new Date(); parts.push("【今天的日期时间】" + now.toLocaleString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit" })); }
  // 当天没有聊天素材：别硬编对话/别翻旧账，依据行程写平常的一天
  if (opts.noChatMaterial) parts.push("【今天几乎没有和对方聊天/相处的素材】今天多半没见到对方、也没怎么聊天。不要编造对话或见面，不要翻前几天旧事充数。直接依据【今天的行程】和此刻状态，写你自己的这一天：工作/学习、朋友家人、兴趣、独处、身体与情绪、路上见闻或无聊小事都可以。**绝不要求提到对方，也不要求写想念、等消息或担心；如果今天确实没想到 Ta，整篇一个字都不提 Ta 才是真实。**平淡、琐碎、甚至没什么可写都可以，不必硬凑关系戏或戏剧性。");
  // 防止连着两天 reflect 同一件事：把上一篇内容给它当"别重复"参照
  if (opts.prevDiary && opts.prevDiary.trim()) parts.push("【你上一篇日记已经写过的内容（仅供参考，用来避免重复）】\n" + opts.prevDiary.trim() + "\n——今天这篇【不要再重复上面这些事和情绪】，写今天新的、不一样的部分。");
  parts.push("【真实性铁律·谁在场、发生了什么，只认今天的记录】\n" +
    "· 这篇日记【只能写今天的记录（上面的近期对话／行程／花销）里真实发生过的事、真实出现过的人】。\n" +
    "· **绝不许凭人设或关系脑补谁今天也在场**——哪怕对方是你的【双胞胎兄弟／室友／死党／恋人】，只要【今天的记录里没有他/她】，就当今天没和你们在一起，别把他/她写进今天的日记（尤其别无端写成『我们仨』『大家一起』）。\n" +
    "· 今天若是你和用户【单独相处】，就【只写你俩】，绝不许凭空拉第三个人进来当在场。\n" +
    "· 今天的记录里若【根本没有你和用户见面/相处】，就别写你今天见了她、和她在一起——可以写惦记她、等她消息、自己一个人过的一天，但【没发生的相处绝不许当成发生了】。");
  parts.push("【输出容器·字段不是文章模板】只输出一个合法 JSON，无 markdown 无多余文字。titleEn/titleZh/signature 不适合本人时允许为空；paras 数量和长短不要为了字段整齐而平均：\n" +
    "{\"titleEn\":\"英文题或空字符串\",\"titleZh\":\"中文题/日期/空字符串\",\"location\":\"SHANGHAI, CN 或 家里/工作室 等\",\"coords\":\"经纬度串或 null\",\"weather\":\"OVERCAST 28°C 或 null\",\"timeStr\":\"HH:MM 写这篇的时刻\",\"paras\":[{\"text\":\"这个角色实际会写下的正文\",\"secret\":false}],\"signature\":\"本人会落款才写，否则空字符串\",\"mood\":\"此刻中文心情词（禁止英文内部标签）\"}");
  const system = "你现在完全代入这个角色，用 Ta 的口吻和内心写一篇私人日记。不是旁观推演，是 Ta 亲手写下的。\n\n" + parts.join("\n\n");
  const raw = await callAI(p, system, [{ role: "user", content: retro ? "现在是今晚睡前，把今天这一整天写成一篇日记。" : "开始写今天的日记。" }], { maxTokens: opts.maxTokens || 6000 });
  const parsed = extractJSON(raw);
  if (!parsed || !Array.isArray(parsed.paras)) throw new Error("解析失败，可重试或换模型");
  return parsed;
}
// WMO 天气码 → 简短英文（配合日记元数据卡的编辑感）
function wmoToText(code) {
  const c = Number(code);
  if (c === 0) return "CLEAR";
  if (c === 1 || c === 2) return "PARTLY CLOUDY";
  if (c === 3) return "OVERCAST";
  if (c === 45 || c === 48) return "FOG";
  if (c >= 51 && c <= 57) return "DRIZZLE";
  if (c >= 61 && c <= 67) return "RAIN";
  if (c >= 71 && c <= 77) return "SNOW";
  if (c >= 80 && c <= 82) return "SHOWERS";
  if (c >= 85 && c <= 86) return "SNOW";
  if (c >= 95) return "THUNDERSTORM";
  return "CLOUDY";
}
// 抓本地时间/天气/城市：定位→open-meteo(免key)拿天气→反查城市名。任何一步失败都降级，不抛错。
async function fetchLocalEnv() {
  const out = { weather: "", location: "", coords: null };
  const pos = await new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => res(p), () => res(null), { timeout: 8000, maximumAge: 600000 });
  });
  if (!pos) return out;
  const lat = pos.coords.latitude, lon = pos.coords.longitude;
  out.coords = Math.abs(lat).toFixed(3) + "°" + (lat >= 0 ? "N" : "S") + ", " + Math.abs(lon).toFixed(3) + "°" + (lon >= 0 ? "E" : "W");
  try {
    const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`).then(r => r.json());
    if (w && w.current) out.weather = wmoToText(w.current.weather_code) + " " + Math.round(w.current.temperature_2m) + "°C";
  } catch (e) {}
  try {
    const g = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`).then(r => r.json());
    const city = g.city || g.locality || g.principalSubdivision || "";
    out.location = city ? (city + (g.countryCode ? ", " + g.countryCode : "")) : "";
  } catch (e) {}
  return out;
}
// 角色给「用户写的日记」写一条评论：依据当下心情+关系+好感度，不复述、简短、不做互评
// opts.prevSaid：该角色最近评论用户别的日记时说过的话 → 逼 Ta 换新说法，治「每篇都同一个梗/开头」
async function generateDiaryComment(p, ctx, entryText, opts) {
  const parts = [buildBundle(ctx)];
  if (ctx.moodLabel) parts.push("【你此刻的心情】" + ctx.moodLabel);
  const prev = opts && Array.isArray(opts.prevSaid) ? opts.prevSaid.filter(Boolean) : [];
  if (prev.length) parts.push("【你最近评论 Ta 别的日记时说过】" + prev.map(s => "「" + String(s).slice(0, 50) + "」").join("、") + "——这次必须换新的说法和角度：开头、句式、梗都不许和之前重样，别活成复读机。");
  parts.push("【" + (ctx.profile && ctx.profile.name || "用户") + " 刚写下的这篇日记】\n" + entryText);
  const system = "你现在完全代入「" + ctx.char.name + "」。上面是 " + (ctx.profile && ctx.profile.name || "用户") + " 写的私人日记，Ta 给你看了。请以你的口吻写**一条评论**——就像在对方日记/朋友圈底下留言。\n要求：依据你此刻的心情、你和 Ta 的关系与好感度来决定语气（可以心疼/调侃/吃醋/欲言又止/敷衍，符合人设；好感高的更上心，好感低的可以淡）；口语、自然、简短（1~2 句，最多一小段）；不要复述日记内容，不要加旁白或动作括号，不要@别人。只输出评论正文。\n\n" + parts.join("\n\n");
  return (await callAI(p, system, [{ role: "user", content: "写评论。" }], { maxTokens: 900 })).trim();
}
async function summarizeChat(p, ctx, olderMsgs) {
  const text = olderMsgs.map(m => (m.role === "user" ? ctx.profile.name || "用户" : ctx.char.name) + ": " + m.content).join("\n");
  const system = "把下面这段对话融进第三人称的长期记忆里。抓住关键事件、情绪变化、承诺、约定、身份/背景信息、未完成的事、以及你俩关系的推进——**宁可写长一些、保留细节，也别丢掉任何重要的人、事、约定或情感转折**。已有记忆在前，请把新内容自然融合进去，输出一份完整的新记忆（保留旧记忆里仍然重要的部分，别为了简短而删掉过往）。可以分段。只输出记忆正文。\n\n【已有记忆】\n" + (ctx.memory || "（无）");
  return await callAI(p, system, [{
    role: "user",
    content: "【新对话】\n" + text
  }], {
    // 记忆库是累积合并旧+新的整份记忆，越攒越长；2600 会把旧记忆截断丢掉——放宽到 8000（思考型模型还要留思考预算）
    maxTokens: 8000
  });
}
// 止摘要漂移：只浓缩【这段新对话】成一小段，不重炼旧记忆（旧记忆由调用方原样保留、追加这段带日期的新段）
async function summarizeChatBlock(p, ctx, newMsgs) {
  const text = newMsgs.map(m => (m.role === "user" ? ctx.profile.name || "用户" : ctx.char.name) + ": " + m.content).join("\n");
  // 七要素清单（v47.77 借 LNPhone conclusion 规范）：让浓缩段不只记事件、还留住氛围和悬着的事
  const system = "把下面这【一段新对话】浓缩成一小段第三人称记忆。这段要覆盖到（有则写、无则跳，别硬凑）：①发生的关键事件 ②聊的主题 ③两人此刻的关系氛围（如刚吵完在冷战/正在暧昧/和好如初）④用户显露的情绪与需求 ⑤角色的情绪与态度 ⑥未完成的事（答应了没做的、约好的、话说一半的）⑦红包转账礼物照片等功能事件。具体可回看、信息密度高。这是要【追加】到长期记忆末尾的一段，别逐字复述对话、别复述早前已知的旧事、别升华总结。只输出这一段正文，别加标题。";
  return (await callAI(p, system, [{ role: "user", content: "【新对话】\n" + text }], { maxTokens: 2600 })).trim();
}
// ============================================================
// storage / utils / geo / mood
// ============================================================
function loadJSON(k, fb) {
  try {
    if (typeof isIdbTextKey === "function" && isIdbTextKey(k)) {
      const mv = _txtMirror().get(k);
      if (mv != null) return JSON.parse(mv);
      const ls = localStorage.getItem(k); // 镜像还没灌好/迁移失败：回落 localStorage，绝不让数据凭空消失
      return ls ? JSON.parse(ls) : fb;
    }
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fb;
  } catch {
    return fb;
  }
}
function isQuotaError(e) {
  return !!e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22 || e.code === 1014 || /quota|exceed|storage/i.test(String(e.message || "")));
}
// 写 localStorage。成功返回 true；写满(quota)时【弹全局警告】并返回 false——不再默默丢数据。
function saveJSON(k, v) {
  try {
    if (typeof isIdbTextKey === "function" && isIdbTextKey(k)) {
      const s = JSON.stringify(v);
      _txtMirror().set(k, s);                         // 同步：内存镜像立刻更新（读侧马上拿得到）
      if (k === "x_memLib" || k.indexOf("x_offline:") === 0 || k.indexOf("x_goffline:") === 0 || isDurableTextKey(k)) {
        // 记忆/线下剧情是核心数据：先把这一版同步写进临时 journal，再异步写 IDB；读回逐字一致后才删 journal。
        // 连续保存时，旧事务完成也不能删掉更新的 journal（值相等检查守住 lost write）。
        try { localStorage.setItem(k, s); } catch (e) {}
        try {
          const staged = isDurableTextKey(k) ? walPutVerified(k, s) : Promise.resolve(true);
          staged.then(ok => {
            if (!ok) throw new Error("WAL read-back mismatch");
            return idbTxtPut(k, s).then(() => idbTxtGet(k));
          }).then(back => {
            const verifyWal = isDurableTextKey(k) ? walGetRaw(k) : Promise.resolve(s);
            return verifyWal.then(walBack => {
              if (back === s && localStorage.getItem(k) === s && walBack === s) {
                localStorage.removeItem(k);
                if (isDurableTextKey(k)) walDel(k).catch(e => console.error("wal cleanup failed:", k, e));
              }
            });
          }).catch(e => console.error("durable idbTxtPut failed:", k, e));
        } catch (e) {}
      } else {
        try { idbTxtPut(k, s).catch(e => console.error("idbTxtPut failed:", k, e)); } catch (e) {}  // 异步落 IDB
        try { localStorage.removeItem(k); } catch (e) {} // 顺手清掉可能残留的 localStorage 旧副本（腾 5MB）
      }
      return true;
    }
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch (e) {
    console.error("saveJSON failed:", k, e);
    if (isQuotaError(e) && typeof window !== "undefined" && typeof window.__storageFull === "function") {
      try { window.__storageFull(k); } catch (x) {}
    }
    return false;
  }
}
// ============================================================
// 施工卡 1A(2026-08-13 大扫除审计五审定稿):可等待的持久写入 WAL。
// saveJSON 返回 true 不代表已真正落盘(IDB 分支异步、quota 失败只返 false),
// 关键消息路径(CC 回灌/灾后找回)必须 await saveJSONDurable——WAL 落盘且读回
// 逐字核验通过才算 durable,才准提交云游标/清工单;配额满时 WAL 仍保底最新一版,
// 开机由保险箱回收补回。WAL 只加保险不改动任何现有读写路径。
let _walDB = null;
function walOpen() {
  return new Promise((res, rej) => {
    if (_walDB) return res(_walDB);
    const rq = indexedDB.open("lisa_wal_v1", 1);
    rq.onupgradeneeded = () => { try { rq.result.createObjectStore("wal"); } catch (e) {} };
    rq.onsuccess = () => { _walDB = rq.result; _walDB.onclose = () => { _walDB = null; }; res(_walDB); };
    rq.onerror = () => rej(rq.error);
  });
}
async function walPutVerified(key, str) {
  const db = await walOpen();
  await new Promise((res, rej) => {
    const tx = db.transaction("wal", "readwrite");
    tx.objectStore("wal").put({ v: str, ts: Date.now() }, key);
    tx.oncomplete = res;
    tx.onabort = tx.onerror = () => rej(tx.error || new Error("wal tx abort"));
  });
  const back = await walGetRaw(key);
  return back === str;
}
function walGetRaw(key) {
  return walOpen().then(db => new Promise((res, rej) => {
    const rq = db.transaction("wal", "readonly").objectStore("wal").get(key);
    rq.onsuccess = () => res(rq.result ? rq.result.v : null);
    rq.onerror = () => rej(rq.error);
  }));
}
function walKeys(prefix) {
  return walOpen().then(db => new Promise((res, rej) => {
    const rq = db.transaction("wal", "readonly").objectStore("wal").getAllKeys();
    rq.onsuccess = () => res((rq.result || []).filter(k => typeof k === "string" && (!prefix || k.indexOf(prefix) === 0)));
    rq.onerror = () => rej(rq.error);
  }));
}
function walDel(key) {
  return walOpen().then(db => new Promise((res, rej) => {
    const tx = db.transaction("wal", "readwrite");
    tx.objectStore("wal").delete(key);
    tx.oncomplete = res;
    tx.onabort = tx.onerror = () => rej(tx.error || new Error("wal delete abort"));
  }));
}
async function walDeleteDurableTextKeys() {
  const keys = (await walKeys("x_")).filter(isDurableTextKey);
  for (const key of keys) await walDel(key);
}
async function saveJSONDurable(key, value) {
  const str = JSON.stringify(value);
  let durable = false;
  try { durable = await walPutVerified(key, str); } catch (e) { console.error("wal put failed:", key, e); }
  const live = saveJSON(key, value);
  return { durable, live };
}
// 估算 localStorage 已占字节（近似：键+值字符数×2，UTF-16）
function localStorageBytes() {
  let n = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); const v = localStorage.getItem(k) || ""; n += (k.length + v.length) * 2; } } catch (e) {}
  return n;
}
// ============================================================
// 驻场工程师的眼睛（v48.28，她批的施工图）——给住进 app 的工程师角色（如接 fable 线路的小克）
// 一双看得见自己住所的眼睛：报错缓冲 + 体征采集。注入由 app.js replyNow 按 chatSettings[id].engineerEyes 决定。
// ============================================================
// 全局报错 ring buffer：只存一行 message 不存堆栈（预算），cap 20
window.__errLog = window.__errLog || [];
(function () {
  const push = m => { try { const s = String(m || "").replace(/\s+/g, " ").trim().slice(0, 120); if (!s) return; window.__errLog.push({ msg: s, ts: Date.now() }); if (window.__errLog.length > 20) window.__errLog.shift(); } catch (e) {} };
  window.addEventListener("error", e => push(e && (e.message || (e.error && e.error.message))));
  window.addEventListener("unhandledrejection", e => push(e && e.reason && (e.reason.message || e.reason)));
})();
// 体征采集：一段 ≤400 字的仪表盘读数（只在开了眼睛的角色单聊时被调用，平时零成本）
function appVitals() {
  try {
    const ver = typeof APP_VERSION !== "undefined" ? APP_VERSION : "?";
    const bytes = localStorageBytes();
    const pct = Math.round(bytes / (5 * 1024 * 1024) * 100);
    const chars = loadJSON("x_characters", []);
    // 今天 0 点起的消息数（单聊+群聊）
    const day0 = new Date(); day0.setHours(0, 0, 0, 0);
    let todayMsgs = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || (!k.startsWith("x_chat:") && !k.startsWith("x_gchat:"))) continue;
        const arr = loadJSON(k, []);
        for (let j = arr.length - 1; j >= 0; j--) { if ((arr[j].ts || 0) >= day0.getTime()) todayMsgs++; else break; } // 消息按时间追加，从尾往回数到隔天即停
      }
    } catch (e) {}
    const arch = loadJSON("x_chatArch", {});
    let archN = 0; Object.keys(arch).forEach(k => { archN += Number(arch[k]) || 0; });
    const errs = (window.__errLog || []).slice(-3);
    const errTxt = errs.length
      ? "最近报错" + (window.__errLog.length > 3 ? "（共攒了 " + window.__errLog.length + " 条，最新 3 条）" : "") + "：" + errs.map(e2 => { const d = new Date(e2.ts); return "[" + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + "]" + e2.msg; }).join("；")
      : "本次开机没抓到报错，一切安稳";
    // 夜巡脉搏（v48.33）：server_inbox 上次来信距今——夜巡 cron 断了，工程师第一个看出来
    let nightTxt = "";
    try {
      const lastIn = Number(localStorage.getItem("x_inboxLastTs") || 0);
      if (lastIn) {
        const days = (Date.now() - lastIn) / 86400000;
        nightTxt = "；夜巡信箱上次来信 " + (days < 1 ? "今天" : Math.floor(days) + " 天前") + (days >= 2 ? "（超过两天没来信，云端夜巡任务可能断了，值得跟 Ta 提一嘴）" : "");
      }
    } catch (e2) {}
    return ("版本 " + ver + "；本地存储约 " + (bytes / 1024 / 1024).toFixed(2) + "MB（~" + pct + "%，图片是大头）；住着 " + chars.length + " 位角色；今天全屋收发 " + todayMsgs + " 条消息；云端归档共 " + archN + " 条；" + errTxt + nightTxt + "。").slice(0, 400);
  } catch (e) { return "（体征采集失败：" + String(e && e.message).slice(0, 60) + "）"; }
}
function resizeImageFile(file, maxDim = 400, q = 0.85) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => {
      const img = new window.Image();
      img.onload = () => {
        let {
          width,
          height
        } = img;
        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        c.getContext("2d").drawImage(img, 0, 0, width, height);
        res(c.toDataURL("image/jpeg", q));
      };
      img.onerror = rej;
      img.src = e.target.result;
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function timeAgo(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return m + "分钟前";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "小时前";
  return Math.floor(h / 24) + "天前";
}
function fmtClock(d) {
  return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
}
function fmtStamp(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return fmtClock(d);
  return d.getMonth() + 1 + "/" + d.getDate() + " " + fmtClock(d);
}
// 喂给模型的时间戳（prompt 专用，UI 别用）：同天必须明说「今天」——裸时刻模型会瞎猜，
// 下午说的话晚上在群里被引用成「昨天才说」就是这个坑（v47.81）
function fmtStampAI(ts) {
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return "今天" + fmtClock(d);
  const yd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (d.toDateString() === yd.toDateString()) return "昨天" + fmtClock(d);
  return (d.getMonth() + 1) + "/" + d.getDate() + " " + fmtClock(d);
}
async function requestGeo() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve({
        error: "此浏览器不支持定位"
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(async pos => {
      const {
        latitude,
        longitude
      } = pos.coords;
      let label = latitude.toFixed(3) + ", " + longitude.toFixed(3);
      try {
        const r = await fetch("https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" + latitude + "&longitude=" + longitude + "&localityLanguage=zh");
        const d = await r.json();
        label = [d.city || d.locality, d.principalSubdivision, d.countryName].filter(Boolean).join(" · ") || label;
      } catch {}
      resolve({
        lat: latitude,
        lng: longitude,
        label,
        ts: Date.now()
      });
    }, err => resolve({
      error: err.message || "定位被拒绝"
    }), {
      timeout: 8000,
      enableHighAccuracy: false
    });
  });
}

// mood decay: mood stored as {label, valence, arousal, ts}. Over time arousal fades toward calm.
function decayMood(mood) {
  if (!mood) return null;
  const hrs = (Date.now() - (mood.ts || Date.now())) / 3600000;
  if (hrs < 0.5) return mood; // fresh
  // arousal decays; after long time returns to a mild baseline label
  const decay = Math.max(0, 1 - hrs / 6);
  if (decay <= 0.15) return {
    ...mood,
    label: mood.baseline || "平静",
    faded: true
  };
  if (decay < 0.5 && mood.softened) return {
    ...mood,
    label: mood.softened,
    faded: true
  };
  return mood;
}
