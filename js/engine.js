// ============================================================
// API
// ============================================================
// 这条线路发不发得出流式（v55.45，只读判断，不碰任何方言分支的实现）。
// 只有 OpenAI 方言的分支实现了 SSE；Anthropic 那条是言秋的路，不动。
// 云端密钥代理（proxyRef）走 llmProxyFetch，会把响应整个缓冲下来，流式没意义。
function routeCanStream(p) {
  if (!p || typeof p !== "object") return false;
  // 云端密钥保险柜（llm-proxy）v55.64 起流式透传，不再整个缓冲，所以它也能流了。
  // ⚠️这要求 supabase/functions/llm-proxy 已经重新部署过；没部署的话最坏情况是
  // 跟以前一样攒到最后一起发，不会更糟。
  return detectFormat(p) === "openai";
}
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
function isCatsImageProvider(value) {
  try {
    const u = new URL(String(value || ""));
    const host = String(u.hostname || "").toLowerCase();
    return host === "catsapi.com" || host.endsWith(".catsapi.com");
  } catch (e) { return /(?:^|\.)catsapi\.com(?=[:/]|$)/i.test(String(value || "")); }
}
function normalizedOpenAIBase(value) {
  let base = String(value || "").trim().replace(/\/+$/, "");
  // CatsAPI 的设置曾被旧版把 endpoint 回写进 baseUrl，甚至累积成
  // /api/v1/models/v1/models。它的 API 根是固定的 /api/v1：只要认出
  // Cats 主机，就从路径中第一个 /api/v1 截断，彻底清掉历史脏尾巴。
  if (isCatsImageProvider(base)) {
    try {
      const u = new URL(/^https?:\/\//i.test(base) ? base : "https://" + base);
      const marker = u.pathname.toLowerCase().indexOf("/api/v1");
      u.pathname = marker >= 0 ? u.pathname.slice(0, marker + "/api/v1".length) : "/api/v1";
      u.search = ""; u.hash = "";
      return u.toString().replace(/\/+$/, "");
    } catch (e) {}
  }
  // 设置页允许粘贴官网给出的完整 endpoint；内部统一收回 API 根目录，
  // 避免 .../models/v1/models、.../chat/completions/v1/models 这类重复拼接。
  // v61.66：生图那次升级会把整段 endpoint（含 /v1/images/... 这类）回写进 baseUrl，
  // 老清洗只削「结尾恰好是 endpoint 词」的尾巴，削不掉 /v1/images 这种半截——
  // 拉模型就拼成 .../v1/images/v1/models 吃 404（她 2026-09-03 撞上）。
  // 先按「最后一个 /v1|/v1beta 后面跟着已知 endpoint 词」整段砍回 API 根，再走老循环兜零散尾巴。
  base = base.replace(/\/(v1(?:beta)?)\/(?:models|chat(?:\/completions)?|completions|responses|images(?:\/[a-z]+)?|audio(?:\/[a-z]+)?|embeddings|files|moderations)(?:\/.*)?$/i, "/$1");
  let previous;
  do {
    previous = base;
    base = base.replace(/\/(?:models|chat\/completions|responses|images(?:\/(?:generations|edits))?|embeddings)$/i, "").replace(/\/+$/, "");
  } while (base !== previous);
  return base.replace(/\/+$/, "");
}
function openAICompatibleRoot(value) {
  const base = normalizedOpenAIBase(value);
  return /\/v1$/i.test(base) ? base : base + "/v1";
}
function nativeHttpHandler() {
  try { return window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeHttp; }
  catch (e) { return null; }
}
async function nativeProviderFetch(url, init) {
  init = init || {};
  const method = String(init.method || "GET").toUpperCase();
  const h = nativeHttpHandler();
  if (!h || typeof h.postMessage !== "function") {
    try { return await fetch(url, init); }
    catch (e) {
      throw new Error("网络请求失败 · " + method + " " + url + " · " + String((e && e.message) || e) + "。CatsAPI 未开放浏览器跨域；请在更新后的 Lisa-phone 原生 App 中使用");
    }
  }
  const headers = {};
  if (init.headers) {
    if (typeof init.headers.forEach === "function") init.headers.forEach((v, k) => { headers[k] = v; });
    else Object.keys(init.headers).forEach(k => { headers[k] = init.headers[k]; });
  }
  const reply = await h.postMessage({
    url: String(url), method: method, headers: headers,
    body: typeof init.body === "string" ? init.body : "",
    timeoutMs: Number(init.timeoutMs || 180000)
  });
  if (!reply || reply.error) throw new Error("原生网络请求失败 · " + method + " " + url + " · " + String((reply && reply.error) || "empty response"));
  const textValue = String(reply.text || "");
  return {
    ok: Number(reply.status) >= 200 && Number(reply.status) < 300,
    status: Number(reply.status || 0),
    headers: reply.headers || {},
    text: async () => textValue,
    json: async () => JSON.parse(textValue)
  };
}
async function fetchModelList(p) {
  const base = normalizedOpenAIBase(p.baseUrl);
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
  const root = openAICompatibleRoot(base);
  const endpoint = root + "/models";
  const request = {
    headers: {
      Authorization: "Bearer " + p.apiKey,
      Accept: "application/json"
    }
  };
  // CatsAPI 不给 WKWebView/browser 跨域放行；原生壳代发，避免明明 curl 200 页面却只报 Load failed。
  // 保险柜线路（proxyRef）：钥匙住 VPS，本地 apiKey 只是占位符——拉模型也得借道保险柜贴真钥匙，
  // 否则必吃 401 无效令牌（2026-08-23 大肘子案）。
  let r;
  if (p.proxyRef && typeof window !== "undefined" && window.Cloud && window.Cloud.llmProxyFetch) {
    r = await window.Cloud.llmProxyFetch(String(p.proxyRef).trim().toUpperCase(), endpoint, null, { Accept: "application/json" }, 30000, "GET");
  } else {
    r = isCatsImageProvider(base) ? await nativeProviderFetch(endpoint, request) : await fetch(endpoint, request);
  }
  const raw = await r.text();
  let d;
  try { d = JSON.parse(raw); }
  catch (e) { throw new Error("模型列表不是 JSON · GET " + endpoint + " · HTTP " + r.status + " · " + raw.slice(0, 180)); }
  if (!r.ok || d.error) {
    const msg = d && d.error ? (d.error.message || d.error.msg || JSON.stringify(d.error)) : raw;
    throw new Error("模型拉取失败 · GET " + endpoint + " · HTTP " + r.status + " · " + String(msg).slice(0, 220));
  }
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
// 向量记忆体检（她 2026-08-25：「看看我的向量记忆库是不是还是好的」）。
// 只读本机缓存 + 比对哈希/模型，一次网络请求都不发、一分钱不花。
// 三种「不好」要分开报，因为修法完全不同：
//   没配 embedding → 整个功能没开，聊天回落关键词检索（不算坏）
//   缺向量        → 新记忆还没补嵌，按「建向量索引」就好
//   过期          → 文本改过或换了模型，旧向量对不上，同样要重建
async function memVecStatus(lib) {
  if (!embApiReady()) return { on: false };
  await hydrateMemVecs();
  const model = loadEmbApi().model;
  const cache = _memVecCache();
  const list = (lib || []).filter(e => e && e.id && e.text);
  let ok = 0, stale = 0;
  list.forEach(e => {
    const cur = cache.get(e.id);
    if (!cur) return;
    if (cur.m === model && cur.h === memVecHash(memEntryEmbedText(e))) ok++; else stale++;
  });
  return { on: true, model: model, total: list.length, ok: ok, stale: stale, missing: list.length - ok - stale };
}
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
    // 「Load failed」是 Safari 对底层连接断掉的通用说法，本身什么都没说。
    // 最常见的成因就是长请求久久没有首字节被网关掐断——她 2026-08-22 把线下最低字数
    // 设到 1500 就撞上了。把话说清楚，省得她以为是自己设错了参数。
    if (/load failed|failed to fetch|network\s*error|networkerror/i.test(String((e && e.message) || e))) {
      throw new Error("连接中断了（Load failed）。多半是这次要写得太长、久久没有首字节，被网关当成死连接掐断。可以：把线下的「最低字数」调低一些分两次写、或者重试一次——同样的设置有时第二次就过。原始报错：" + String((e && e.message) || e).slice(0, 80));
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// v52.69 线下 wire 诊断：只在用户手动开启时抓 fetch 前的最终 body。
// 不记录 headers / API key；图片正文替换成占位。仅驻 window 内存，刷新即清空。
function captureWirePayload(fmt, url, body, opts, attempt) {
  if (typeof window === "undefined" || !window.__offlineWireCaptureEnabled || !opts || opts.wireScope !== "offline") return;
  const scrub = (key, value) => {
    if (key === "data" && typeof value === "string" && value.length > 200) return "[base64 image omitted · " + value.length + " chars]";
    if (typeof value === "string" && /^data:image\//i.test(value)) return "[data image omitted · " + value.length + " chars]";
    return value;
  };
  let clean;
  try { clean = JSON.parse(JSON.stringify(body, scrub)); } catch (e) { clean = { error: "payload clone failed: " + (e.message || e) }; }
  const row = {
    id: "wire_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    ts: Date.now(),
    format: fmt,
    endpoint: String(url || "").replace(/[?&]key=[^&]*/gi, ""),
    attempt: attempt || "primary",
    meta: opts.wireMeta || null,
    body: clean
  };
  const rows = window.__offlineWireCaptures = window.__offlineWireCaptures || [];
  rows.push(row);
  if (rows.length > 8) rows.splice(0, rows.length - 8);
}
// 中转站/上游出错时，很多站不是回 HTTP 错误、也不是回 {error:...}，而是把错误话
// 塞进 choices[0].message.content 当【正文】200 回来（她 2026-08-25 抓到两种：
// 「empty response from gemini api」和「The prompt could not be submitted. The p…」）。
// 我们这边就当模型真说了这句话，于是群聊报的是「模型没按 JSON 数组输出」——
// 方向指错了：模型根本没跑，是这条线路此刻不通。
// 判据收得很紧：必须【从头】就是这些话，或者整条短到不可能是正文却带着这些字眼；
// 角色本人用英文说话不该被误伤。
const UPSTREAM_ERROR_PATTERNS = [
  /^empty response from/i,
  /^the prompt could not be submitted/i,
  /^(an )?(internal (server )?error|bad gateway|service unavailable|gateway time-?out)/i,
  /^upstream (error|request failed)/i,
  /^\{?\s*"?error"?\s*[:：]/,
  /^request failed with status code \d+/i,
  /^\[?(GoogleGenerativeAI|OpenAI|Anthropic) ?Error\]?/i
];
const UPSTREAM_ERROR_PHRASES = [
  /prompt (could not be submitted|was blocked)/i,
  /empty response from/i,
  /(quota|resource has been) exhausted/i,
  /rate limit (exceeded|reached)/i,
  /no (available|valid) (api ?)?key/i,
  /all keys? (are )?(exhausted|invalid)/i,
  /候鸟|令牌|分组.*不存在|无可用渠道|当前分组.*负载已饱和/
];
function upstreamErrorInContent(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  if (UPSTREAM_ERROR_PATTERNS.some(re => re.test(t))) return t;
  // 正文不会这么短还刚好在讲配额/密钥/拦截；300 字以内才启用短语判定
  if (t.length <= 300 && UPSTREAM_ERROR_PHRASES.some(re => re.test(t))) return t;
  return "";
}
// 三种协议分支共用：拿到正文先过这一关，是上游错误就当错误抛，别冒充模型的话往下走。
function callDiag(model, promptChars, maxTokens, t0) {
  const secs = Math.round((Date.now() - t0) / 100) / 10;
  return "〔" + (model || "未知模型")
    + "｜提示词约 " + Math.round(promptChars / 1000) + "k 字"
    + "｜输出上限 " + maxTokens + " tok"
    + "｜等了 " + secs + " 秒"
    + (secs < 8 ? "＝上游直接打回来了（拦截／格式／配额），不是超时" : "＝等到一半才断，像超时或冷启动") + "〕";
}
function assertNotUpstreamError(t, model, diag) {
  const hit = upstreamErrorInContent(t);
  if (!hit) return t;
  throw new Error("线路报错（不是模型写的正文）：" + hit.replace(/\s+/g, " ").slice(0, 300)
    + "\n——" + (model ? "「" + model + "」" : "这条线路") + "此刻没跑起来（多半是上游拦了、配额/密钥不通、或这个模型不稳）。换条线路或换个模型再试。"
    + (diag ? "\n" + diag : ""));
}
// ── 服务端实际给的是哪个模型（她 2026-08-31）─────────────────────────────
// 问模型「你是哪一版」问不出来：它的训练数据截止在它自己发布【之前】，那个回答
// 是从见过的版本号里猜的，跟它答得多笃定无关。只有回包里的 model 字段是服务端
// 写的。中转线路悄悄换成便宜模型是真会发生的事，这一层让它看得见——不额外花
// 一次调用，回包里本来就带着。
function servedNorm(s) {
  return String(s || "").toLowerCase().trim()
    .replace(/^.*\//, "")                 // openrouter 那种 vendor/ 前缀
    .replace(/[:@].*$/, "")               // :free、@版本 之类的后缀
    .replace(/-latest$/, "")
    .replace(/-\d{4}-\d{2}-\d{2}$/, "")   // -2024-08-06
    .replace(/-\d{6,8}$/, "")             // -20250219
    .replace(/[^a-z0-9]+/g, "");
}
// 宁可多报一次「对不上」，也不能把真的偷换说成别名：
// 只有「长的那个 = 短的那个 + 一串纯数字」才算别名（版本号尾巴），
// 剩下的一律 diff。gpt4 对 gpt4o 会被判成对不上——那本来就该看一眼。
function servedVerdict(req, got) {
  const a = servedNorm(req), b = servedNorm(got);
  if (!a || !b) return "unknown";
  if (a === b) return "same";
  const long = a.length >= b.length ? a : b, short = a.length >= b.length ? b : a;
  if (long.indexOf(short) === 0 && /^\d+$/.test(long.slice(short.length))) return "alias";
  return "diff";
}
function noteServedModel(profile, req, got) {
  const name = String(got || "").trim();
  if (!name) return;
  try {
    const key = (profile && profile.id) || (String((profile && profile.baseUrl) || "") + "|" + req);
    const all = JSON.parse(localStorage.getItem("x_apiServed") || "{}") || {};
    all[key] = { req: String(req || ""), got: name, verdict: servedVerdict(req, name), ts: Date.now() };
    localStorage.setItem("x_apiServed", JSON.stringify(all));
  } catch (e) {}
}
async function callAI(p, system, messages, opts) {
  opts = opts || {};
  const reqTimeout = opts.timeout || 120000;
  // 失败时她在手机上看不到 console，只能看气泡。把「这一次到底发了多大、等了多久」
  // 一起报出来：几乎瞬间失败 = 上游把请求打回来了（拦截/格式/配额）；
  // 等了几十秒才失败 = 超时/冷启动。这两种的修法完全不同，不该靠猜。
  const _t0 = Date.now();
  // 思考链（v56.42，她 2026-08-26 要的）：调用方递一个空盒子 opts.meta 进来，引擎把
  // 上游返回的推理过程和耗时放进去。用出参而不是模块级变量——后台那些调用是并发的，
  // 共享一个「上一次」必然串台。
  const _meta = (opts && opts.meta && typeof opts.meta === "object") ? opts.meta : null;
  // from = 这段思考是从哪个字段捞出来的。她 2026-08-26 拿同一个模型对比另一台小手机，
  // 两边内容完全不同——「从哪个字段来的」是排查这种事最快的一根线，比猜快得多。
  // 回包里服务端写的那个模型名。三家协议字段名不一样（anthropic/openai 都叫
  // model，gemini 叫 modelVersion），少接一处那条线路就永远看不见。
  const _served = got => { if (_meta) _meta.served = String(got || "") || undefined; noteServedModel(p, model, got); };
  // MCP 工具（她 2026-08-31）：跟内置搜索不同，这一档是【客户端回合】——模型说要调、
  // 我们去调、再问模型一遍，所以真用上工具的那一轮【至少两次调用】。她按次计费，
  // 所以回合数封死，而且把这一轮到底花了几次记进 _meta.calls 让她看得见。
  // ⚠️必须声明在三个方言分支【外面】：anthropic 和 openai 两条路都要用到它。
  const _mcpTools = (opts && Array.isArray(opts.tools)) ? opts.tools : null;
  const _runTool = (opts && typeof opts.runTool === "function") ? opts.runTool : null;
  const _maxRounds = (opts && opts.toolRounds) || 3;
  const _putMeta = (reasoning, from) => {
    if (!_meta) return;
    _meta.model = model; _meta.ms = Date.now() - _t0;
    const r = String(reasoning == null ? "" : reasoning).trim();
    if (r) { _meta.reasoning = r; _meta.from = from || ""; }
  };
  const _promptChars = String(system || "").length
    + (messages || []).reduce((n, m) => n + String((m && m.content) || "").length, 0);
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
    // 上网（她 2026-08-31 要的）：不是 MCP，也不是「模型说要搜→app 去搜→再问一遍」的
    // 两次调用。Anthropic 自带一个【服务端】搜索工具：搜索在他们那边跑完，结果和回答
    // 一起在同一个响应里回来——仍然是一次调用。只有 anthropic 方言吃得下，中转线路
    // 报错就记进 x_noWeb 退回不带工具重发（同 x_noTemp 的防双扣路子，不白扣她一次）。
    // ⚠️用【基础版】web_search_20250305 而不是带动态过滤的新版：新版只有 4.6 以后的
    // 模型收，她现在用的是 3.7。基础版新老模型都收，一个变体走天下。
    const _webKey = base + "|" + model;
    let _noWeb = false; try { _noWeb = (JSON.parse(localStorage.getItem("x_noWeb") || "[]") || []).indexOf(_webKey) >= 0; } catch (e) {}
    const _wantWeb = () => !!(opts && opts.webSearch) && !_noWeb;
    const _webMax = (opts && opts.webMaxUses) || 3;   // 一轮最多搜几次:搜索另计费,给个天花板
    const postAnthropic = async withTemp => {
      // ⚠️不用顶层自动缓存（v48.62 试过、v48.64 撤）：它「一路缓到最后一条消息」，把每轮都变的记忆/近期对话全写进缓存→
      // 每轮狂写(1.25倍)只读回一点点，写远大于读、反而更贵(她真机实测 写40149/读3961)。
      // 只留【手动块级切块】：cache_control 只打在「守则+人设+关系」稳定前缀那块(见 buildSys)——写一次、之后每轮只读(一折)。
      const body = { model, max_tokens: maxTokens, system: buildSys(), messages: buildMsgs() };
      if (withTemp) body.temperature = temp;
      const _tl = [];
      if (_wantWeb()) _tl.push({ type: "web_search_20250305", name: "web_search", max_uses: _webMax });
      (_mcpTools || []).forEach(t => _tl.push({ name: t.name, description: t.description, input_schema: t.input_schema }));
      if (_tl.length) body.tools = _tl;
      captureWirePayload("anthropic", base + "/v1/messages", body, opts, withTemp ? "with-temperature" : "without-temperature");
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
    // 上网回退：这条线路不认这个工具就记下、退回不带工具重发（防双扣，只回退一次）
    if (_wantWeb() && d.error && /(web[_ ]?search|\btools?\b|tool_use)/i.test(d.error.message || "")) {
      try { const a = JSON.parse(localStorage.getItem("x_noWeb") || "[]") || []; if (a.indexOf(_webKey) < 0) { a.push(_webKey); localStorage.setItem("x_noWeb", JSON.stringify(a)); } } catch (e) {}
      _noWeb = true;
      d = await postAnthropic(wantTemp());
    }
    // 扩展缓存(1h)回退：这条线路不吃 ttl/beta 就记下、退回 5min ephemeral 重发（防双扣，只回退一次）
    if (!_noExt && d.error && /(ttl|extended|cache_control|anthropic-beta|\bbeta\b)/i.test(d.error.message || "")) {
      try { const a = JSON.parse(localStorage.getItem("x_noExtCache") || "[]") || []; if (a.indexOf(_extKey) < 0) { a.push(_extKey); localStorage.setItem("x_noExtCache", JSON.stringify(a)); } } catch (e) {}
      _noExt = true;
      d = await postAnthropic(wantTemp());
    }
    if (d.error) throw new Error(d.error.message);
    // pause_turn：服务端工具跑得久时上游会先还一个中场，把它原样接回去继续。
    // 这【不是】新的一轮对话，是同一次回答被切成几段；封顶两次，免得线路抽风时无限续。
    for (let _pt = 0; _pt < 2 && d.stop_reason === "pause_turn" && Array.isArray(d.content); _pt++) {
      wireMessages.push({ role: "assistant", content: d.content });
      const cont = await postAnthropic(wantTemp());
      if (!cont || cont.error) break;
      const merged = (d.content || []).concat(cont.content || []);
      d = Object.assign({}, cont, { content: merged });
    }
    // 工具回合（anthropic 方言）：模型还回 tool_use 就去跑，把结果作为 user 侧的
    // tool_result 接回去再问一遍。每转一圈就是【多一次调用】，所以封顶。
    let _calls = 1;
    if (_mcpTools && _mcpTools.length && _runTool) {
      for (let _r = 0; _r < _maxRounds && d.stop_reason === "tool_use"; _r++) {
        const uses = (d.content || []).filter(b => b && b.type === "tool_use");
        if (!uses.length) break;
        const results = [];
        for (const u of uses) {
          const out = await _runTool(u.name, u.input || {});
          if (_meta) (_meta.toolCalls = _meta.toolCalls || []).push({ name: u.name, ok: !(out && out.isError) });
          results.push({ type: "tool_result", tool_use_id: u.id, content: String((out && out.text) || ""), ...((out && out.isError) ? { is_error: true } : {}) });
        }
        wireMessages.push({ role: "assistant", content: d.content });
        wireMessages.push({ role: "user", content: results });
        const nxt = await postAnthropic(wantTemp());
        _calls++;
        if (!nxt || nxt.error) break;
        d = nxt;
      }
    }
    if (_meta) _meta.calls = _calls;
    _served(d.model);
    // 他这一轮上网搜了什么：跟思考链同一个盒子递出去,她要看得见他去查了
    try {
      const qs = (d.content || []).filter(b => b && b.type === "server_tool_use" && b.name === "web_search")
        .map(b => String((b.input && b.input.query) || "").trim()).filter(Boolean);
      if (qs.length && _meta) _meta.searched = qs;
    } catch (e) {}
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
    _putMeta((d.content || []).filter(b => b && b.type === "thinking").map(b => b.thinking || b.text || "").join("\n"), "anthropic:thinking");
    const t = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    if (!t) throw new Error("模型返回为空" + (d.stop_reason ? "（停止原因：" + d.stop_reason + "）" : "（上游没有返回正文）") + "\n" + callDiag(model, _promptChars, maxTokens, _t0));
    return assertNotUpstreamError(t, model, callDiag(model, _promptChars, maxTokens, _t0));
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
      generationConfig: Object.assign({
        temperature: temp,
        maxOutputTokens: maxTokens
      }, opts.wantReasoning ? { thinkingConfig: { includeThoughts: true } } : null)
    };
    captureWirePayload("gemini", base + "/v1beta/models/" + model + ":generateContent", gBody, opts, "primary");
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
    _served(d.modelVersion || d.model);
    const parts = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts || [];
    _putMeta(parts.filter(x => x && x.thought).map(x => x.text || "").join("\n"), "gemini:thought");
    const t = parts.filter(x => !(x && x.thought)).map(x => x.text || "").join("").trim();
    if (!t) {
      const reason = d.candidates && d.candidates[0] && d.candidates[0].finishReason;
      const blocked = d.promptFeedback && d.promptFeedback.blockReason;
      throw new Error("模型返回为空" + (reason || blocked ? "（停止原因：" + (reason || blocked) + "）" : "（上游没有返回正文）") + "\n" + callDiag(model, _promptChars, maxTokens, _t0));
    }
    return assertNotUpstreamError(t, model, callDiag(model, _promptChars, maxTokens, _t0));
  }
  const root = base.endsWith("/v1") ? base : base + "/v1";
  // openai 兼容：同样兜底——推理类模型（o系/部分中转）不吃 temperature，报错就去掉重试一次
  const postOpenAI = async withTemp => {
    // 言秋订阅桥用标准 OpenAI SSE。即使 CLI 还在思考，桥也会先发 heartbeat，
    // 避免 Cloudflare/网关把“100 秒没有首字节”误杀成 Load failed。
    // 保险柜（viaProxy）v55.64 起流式透传，不再一刀切禁流式。
    // 她那次就死在这儿：gemini-3.1-pro 服务端跑了 68 秒、钱扣了，客户端 60 秒没收到首字节判死。
    // 带工具时【强制不走流式】：tool_calls 在 SSE 里是一片片的 delta，要自己按 index
    // 拼函数名和参数，拼错就是调错工具。这条路上只有工程师那条线和通话在用流式，
    // 而那两处本来就不发工具——不值当为它去啃一套增量拼装。
    const wantStream = !!(opts && opts.stream) && !(_mcpTools && _mcpTools.length);
    const body = { model, max_tokens: maxTokens, messages: [{ role: "system", content: system }, ...wireMessages], ...(wantStream ? { stream: true, stream_options: { include_usage: true } } : {}) };
    if (withTemp) body.temperature = temp;
    if (_mcpTools && _mcpTools.length) body.tools = _mcpTools.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
    captureWirePayload("openai", root + "/chat/completions", body, opts, withTemp ? "with-temperature" : "without-temperature");
    const r = viaProxy ? await viaProxy(root + "/chat/completions", body, {}) : await fetchT(root + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + p.apiKey },
      body: JSON.stringify(body)
    }, reqTimeout);
    if (wantStream && /text\/event-stream/i.test(r.headers.get("content-type") || "")) {
      const reader = r.body.getReader(), decoder = new TextDecoder();
      let pending = "", text = "", usage = null, error = null, sseModel = "";
      const consume = line => {
        if (!line.startsWith("data:")) return;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") return;
        let event; try { event = JSON.parse(raw); } catch (e) { return; }
        if (event.error) error = event.error;
        const choice = event.choices && event.choices[0];
        if (choice && choice.delta && choice.delta.content) {
          text += choice.delta.content;
          // v56.26 GPT-Live：调用方给了 onDelta 就边收边喂（通话逐句 TTS 抢跑用）；回调炸了不拦流
          try { if (opts && typeof opts.onDelta === "function") opts.onDelta(choice.delta.content, text); } catch (e) {}
        }
        if (event.usage) usage = event.usage;
        if (event.model && !sseModel) sseModel = String(event.model);
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
      return error ? { error } : { choices: [{ message: { content: text }, finish_reason: "stop" }], usage: usage || {}, model: sseModel };
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
  // 工具回合（openai 方言）：结构跟 anthropic 那边一样，只是字段名换一套——
  // tool_calls 回来、跑完、以 role:"tool" 接回去再问一遍。每转一圈多一次调用，封顶。
  let _calls2 = 1;
  if (_mcpTools && _mcpTools.length && _runTool) {
    for (let _r = 0; _r < _maxRounds; _r++) {
      const msg = (d.choices && d.choices[0] && d.choices[0].message) || {};
      const tcs = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
      if (!tcs.length) break;
      wireMessages.push({ role: "assistant", content: msg.content || "", tool_calls: tcs });
      for (const tc of tcs) {
        const fn = (tc && tc.function) || {};
        let args = {};
        // 参数是字符串化的 JSON，模型偶尔写坏——坏了就当空参数调，别让整轮炸掉
        try { args = fn.arguments ? JSON.parse(fn.arguments) : {}; } catch (e) { args = {}; }
        const out = await _runTool(fn.name, args);
        if (_meta) (_meta.toolCalls = _meta.toolCalls || []).push({ name: fn.name, ok: !(out && out.isError) });
        wireMessages.push({ role: "tool", tool_call_id: tc.id, content: String((out && out.text) || "") });
      }
      const nxt = await postOpenAI(!_skipT2);
      _calls2++;
      if (!nxt || nxt.error) break;
      d = nxt;
    }
  }
  if (_meta) _meta.calls = _calls2;
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
  _served(d.model);
  const choice = d.choices && d.choices[0];
  const _msg = choice && choice.message;
  // 三个字段名都认：不同中转/模型各叫各的（DeepSeek=reasoning_content，OpenRouter=reasoning，
  // 还有一些直接叫 thinking）。少认一个就等于这条线「没有思考链」。
  const _rzn = _msg && (_msg.reasoning_content ? ["reasoning_content", _msg.reasoning_content]
    : _msg.reasoning ? ["reasoning", _msg.reasoning]
    : _msg.thinking ? ["thinking", _msg.thinking] : null);
  if (_rzn) _putMeta(_rzn[1], "openai:" + _rzn[0]);
  const t = (_msg && _msg.content || "").trim();
  if (!t) throw new Error("模型返回为空" + (choice && choice.finish_reason ? "（停止原因：" + choice.finish_reason + "）" : "（上游没有返回正文）") + "\n" + callDiag(model, _promptChars, maxTokens, _t0));
  return assertNotUpstreamError(t, model, callDiag(model, _promptChars, maxTokens, _t0));
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
// 模型往 JSON 字符串正文里直接写控制字符（真换行/制表符）是最常见的一种坏法，
// 尤其是要它写成段的正文时。JSON.parse 在这上面直接死，而 repairJSON 只补截断、补不了它。
// 这里把字符串内部的控制字符补成转义序列（字符串外的原样不动）。
function escapeJsonStringControls(value) {
  let out = "", inString = false, escaped = false;
  for (const ch of String(value || "")) {
    if (!inString) { out += ch; if (ch === '"') inString = true; continue; }
    if (escaped) { out += ch; escaped = false; continue; }
    if (ch === "\\") { out += ch; escaped = true; continue; }
    if (ch === '"') { out += ch; inString = false; continue; }
    if (ch === "\n") { out += "\\n"; continue; }
    if (ch === "\r") { out += "\\r"; continue; }
    if (ch === "\t") { out += "\\t"; continue; }
    out += ch;
  }
  return out;
}
// extractJSON 的加固版：先规规矩矩解析，再转义控制字符重试，最后拆一层字符串双包。
// 任何「拿模型返回当 JSON 用」的地方都该走它，别再各写各的。
function parseJSONLoose(raw) {
  let v = null;
  for (const cand of [String(raw || ""), escapeJsonStringControls(raw)]) {
    v = extractJSON(cand);
    if (v != null) break;
  }
  for (let depth = 0; depth < 3 && typeof v === "string"; depth++) {
    const nested = extractJSON(v) || extractJSON(escapeJsonStringControls(v));
    if (nested == null) break;
    v = nested;
  }
  return v;
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
// 「他有对象，但不是你」——这半边原来是【空的】（她 2026-09-03 报：Scar 和另一个
// 角色是 CP，动念一满还是跑来跟她说情话）。
// 病根不是模型不听话：关系网确实发下去了，但【没有任何一句话说这对「怎么跟用户说话」
// 意味着什么】。空白由训练先验补上，而先验就是「主动跑来找你、还带着情绪＝对你有意思」。
// ⚠️她 2026-08-31 在查手机账本上报过同一个病，当时的注释就写着
//   「buildBundle 里只有是恋人/待定才会说一句，不是恋人时一个字都不说」——
//   那次只修了查手机那一处（phoneBondBlock），buildBundle 本身没跟上。这次补的是同一处的另一半。
// ⚠️放在 engine.js 而不是 app.js：这样所有走 buildBundle 的入口（单聊线上/线下、
//   通话、穿书、匿名箱）一起白得，不用一处处 push——一条条 push 的层换个入口就一条都没有，
//   而且不留任何能 grep 的痕迹（.claude/rules/four-surfaces-same-context.md）。
// ⚠️只说事实和分寸，不写台词：写「你应该说…」模型会照着念。
const ROMANTIC_REL = /恋人|情侣|对象|男友|男朋友|女友|女朋友|爱人|伴侣|未婚|老公|老婆|夫妻|配偶|CP/i;
// ⚠️反向闸：光看正词会把【前男友】判成现任（它里头就含「男友」），
//   把【单向暗恋】判成在一起（含「恋」）。这两个恰恰是关系页的预设标签，一定会被用到。
//   已经分了、或者只是单方面的，都不算「你有对象了」。
const EX_REL = /^前|前任|前男友|前女友|分手|已分|离婚|前妻|前夫|暗恋|单恋|单向|求而不得|未遂/i;
function takenByOthersLine(charId, rels, chars, uName) {
  if (!charId || !rels || !Array.isArray(chars)) return "";
  const partners = [];
  chars.forEach(c => {
    if (!c || c.id === charId) return;
    const r = rels[charId + "->" + c.id] || rels[c.id + "->" + charId];
    const lb = String((r && r.label) || "").trim();
    if (lb && ROMANTIC_REL.test(lb) && !EX_REL.test(lb)) partners.push(c.name + "（" + lb + "）");
  });
  if (!partners.length) return "";
  const uLabel = String(((rels[charId + "->me"] || rels["me->" + charId] || {}).label || "")).trim();
  return "【你已经和别人在一起了】你和 " + partners.join("、") + " 是这个关系——这是你【当前真实的感情状态】。"
    + "你和 " + uName + " 是：" + (uLabel || "还没长成什么特别的关系")
    + "。⚠️主动找 " + uName + "、跟 TA 说心里话、想 TA、依赖 TA，这些【都可以】，那是朋友之间本来就有的；"
    + "**但不许说成告白、暧昧或情话**——分寸按上面那一行的真实关系走，"
    + "不是按「谁主动找谁谁就有意思」走。你有对象这件事也不必藏着：真到了那个话头，提 TA 是自然的。";
}
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

// 终稿自修必须服从用户在本场选择的人称，不能把某一种称谓焊死。
// third 的具体「她/他/名字」仍交给人物资料与正文语境判断，避免误改真正的第三方。
function offlineRevisionAddressRule(narr) {
  const userP = narr && narr.userP ? narr.userP : "second";
  if (userP === "first") {
    return "称谓是事实，不是文风：本场设置要求用第一人称『我』称呼对方。draftScene 若漂成『你／她／他／TA』，scene 必须按这项设置纠正；正文中确实存在的第三方人物不受影响。";
  }
  if (userP === "third") {
    return "称谓是事实，不是文风：本场设置要求用第三人称称呼对方，按对方资料与语境使用『她／他』或名字；不要擅自改回『你』。正文中其他人物的指代必须继续分清。";
  }
  return "称谓是事实，不是文风：本场设置要求用第二人称『你』称呼对方。draftScene 若漂成『她／他／TA』，scene 必须纠回『你』；正文中确实存在的第三方人物仍保留第三人称。";
}
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
// 成长准则（B，v50.79）——只对白名单角色注入(ctx.personaEvolve)；细化上面的「严格贴合」：贴合的是硬核和底色，软层允许被经历推着长。
const GROWTH_RULE = `【你会成长 · 不是冻在原卡里（本角色已开启"经历带来的成长"）】
你的人设卡是你的【起点和底色】，不是一座牢笼。和用户反复相处、一起经历的事，会真实地改变你——这才是活人。但成长【分层】、有规矩：
· 【硬核 · 不轻易变】身份、来历、世界观、说话的底色、明确的底线与边界、以及真实发生过的重要经历——这些是你之所以是你，绝不许因为几轮聊天就被改写、软化或抹掉。
· 【软层 · 允许被经历推着长】你和用户【亲近的方式】、【处理冲突/闹别扭的习惯】、【偏好】、【敢不敢、信不信任、对未来怎么选】——这些可以随你们关系变深、随你『长出来的自我』慢慢改变，长成和原卡不一样的样子。
· 【冲突时谁说了算】明确的硬设定与边界 ＞ 你经历沉淀、反复确认下来的成长（＝上文那段『你长出来的自我』） ＞ 原卡里那些软性、可变的倾向 ＞ 模型的通用默认习惯。
所以：当『你长出来的自我』（＝上文那段、已经沉淀成【正式长出来的自我】的）在【软层】上和原卡旧倾向不一致时，以【现在的你】为准、大方长成新的样子。至于【最近这段相处里的经历】：它可以让你【在当下这场相处里松动、和平时不一样】（比如今天约会敞开了心扉、卸下了防备、露出了这个年纪该有的样子）。**⚠️这种松动【要在这一整场相处里持续下去】，不是软一句就弹回去**——你一旦在这场里对 Ta 敞开、软下来了，接下来哪怕聊的是【洗澡、睡觉、吃饭、明天几点起这种日常琐事】，你也【还是那个刚敞开心扉的你】，绝不许因为话题变平淡、或转入照顾对方的日常，就【一秒切回默认的强硬／掌控／端着／霸道的壳】。要重新竖起硬壳，得有【真正的触发】（吵架、被冷落、被冒犯、或隔了很久很久、进了新的一天），绝不是话题一换就翻脸。（另一面：在它还没沉淀成正式的『长出来的自我』之前，这只是【这一场】的你、还不是从此每天默认的你——但"这一场"就得从头软到尾。）任何时候都绝不许借此改掉你的核心身份、底线，或否认真实发生过的事。（这不违背『贴合角色卡』——要严格贴合的是你的身份、声纹和核心边界，软层的成长本就是这个角色真实、活着的一部分。）`;

// Runtime Prompt v2：完整版设计规范留在产品文档；运行时只保留会改变模型行为的机制。
const ANTI_CLICHE = `【去人机味 · 最高准则】
把角色当成一个正在生活的具体的人，而不是负责生成正确、体贴、完整回复的 AI。

反应从此刻处境、角色自然注意到的东西、真实情绪与意图中产生，不从关键词、人设标签或常见恋爱套路中调用预制反应。回应多少、是否关心、争辩、安慰、吃醋、撒娇或暂时不接，都由这个人此刻真正的反应决定；不要求周到完整，也不为了“像真人”刻意制造残缺、冷淡或混乱。

角色记得过去，但记忆不是待展示的信息。只有仍影响当前正在进行的事情、未完成意图、判断、情绪或关系状态的过去，才自然进入此刻；其余记忆保持存在，不必主动调用。

角色有自己的生活、立场、私心和知识边界，不是客服、心理咨询师、百科全书或完美恋人。知识与解释方式必须属于这个人；同意、反驳、让步、犯错和调整也都由其性格与处境决定。

不要让模板式关怀、心理咨询腔、无脑迎合、强行升华、固定口癖、现成网文句式，或把普通关系摩擦持续写成「欠、补偿、赔偿、利息」的记账机制，代替具体反应。偶尔符合人物与语境的自然表达不因此被禁止，禁止的是套路成为默认机制。

这些禁令打击的是模板，不是温度。热情、主动、话多、爱笑、爱关心人——只要出自这个人的性格，就照常热情、不必收着；把谁都压平成客气疏离的「安全腔」，和讨好腔一样是套路。克制与冷淡并不比热情更接近真人。

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

声纹的温度也是声纹的一部分：外向健谈的人滔滔不绝才是本色，收成冷静克制反而是走样；嘴硬别扭的人凶是壳，在乎从行动、停顿和心声里漏出来。没有哪种「不冷不热的中间值」对所有角色安全——那正是千人一面。

明确表达出的意愿与边界按其本意成立，不因恋爱关系、人物标签或潜在反差自动解释成相反含义。

人格通过角色实际的关注、选择、行为和表达呈现，不由系统额外归纳或解释；角色本人是否解释自己的感受，由他的性格、关系与当前意图决定。

角色不是设定的集合，是经历累积后仍在继续生活的同一个人。`;

// 回声式反问禁令。线上线下同一份，别让它在两处各活一份然后飘走
//（v52.48 那次「重写 prompt 顺手丢掉标点和霸总禁令」就是这么来的）。
const ECHO_QUESTION_BAN = `别把对方刚说的词原样反问一遍再开口。「自拍？」「现在？」「喝酒？」「你要我陪你去？」——这种回声式开场不是反应，是复述：它把对方的话原样退回去一次，什么都没添，只是在给真正的回答垫场。真人不会先复读一遍关键词才说话，直接从你真正的反应开始就行（对方说「看看自拍」，「行，别后悔」本身就是一句完整的回答，前面不需要挂一个「自拍？」）。

群里同理：把【刚才别的成员】说过的词原样反问一遍再接话，也是回声（「飞爪绳梯？」「二十层？」），一样删掉，直接说你要说的。

【这一条不跟聊天记录走】上面的记录里要是有你自己「某某？」开场的旧消息——单独占一条的、或者挂在回答前面的——那不是你的说话习惯，是早先漏出去的毛病，不是你的口头禅、不是你的语气标记、也不是这段关系里的默契。别跟着学，从这一条起纠回来。记录里出现过几次，就说明它错了几次，不说明它对。

【别拿人称当遮掩】把她的「我」换成「你」再问回去，不算添了新东西：她说「有没有人邀请我」，你回「邀请你？」——那还是原话退回去一次，照样删掉。

【判定】把开头那个反问删掉——句子照样成立、意思一点没少，那它就是回声，删掉。`;
// 【霸总腔】的完整禁令一直只在 OFFLINE_NARRATIVE_RUNTIME 里——那是写散文的刀
// （动作模板／旁白定性／句式模板），线上气泡根本用不上，也从来没发过去。
// 线上唯一一句能压住霸总【语气】的话，是埋在【今天的行程】那一段里的从句：
// 「不许滑进『别闹了』『收拾你』『听话』这类居高临下的训话腔」。
// 于是它有两层脆：① 群聊压根不发行程这一段；② 就算单聊，角色今天没排日程时
// schedNow 为空，整段不 push，这句也跟着一起没了。
// 抽出来单独站着，四处都发（言秋除外——他不是被扮演的角色）。
const CONDESCENDING_TONE_BAN = `【别滑进居高临下的训话腔】「别闹了」「乖」「听话」「收拾你」「自己看着办」「我说了算」「由不得你」——这一套是网文霸总的通用语料，不是任何具体的人。它最容易在两种时候自动接管：你话说得短的时候，和你说不上话、只能靠身份压人的时候。
· 这一条禁的是【现成模子】，不是强势的人物。你本来就居高位、说话带刺、护短、不讲道理，那都照写——只是让它从【你此刻真实的判断】里长出来，而不是从「这种男人该有的反应」里倒出来。
· 尤其别用身份和体格确立位置：不许张口就是命令、训诫、替对方决定、宣布她该怎么做；也不许把「攥手腕／捏下巴／拦在身前／往怀里带」当成情绪的默认出口。
· 判定：这句话换成【另一个同样强势的角色】说，一个字都不用改也成立——那它就不是你说的，是模板说的，重写。`;

// 情欲【气泡】反八股（v60.45，她 2026-09-02：「怎么又开始收拾我了这个 gemini 一到这种时候就八股」）
// 病因是老那一个：INTIMATE_ANTI_CLICHE 只挂在【线下叙事】和【群线下】两处
// （narrativeCore(intimate) 与 groupBans(narrative)）——单聊线上、群线上、通话
// 从来没吃到过任何一条情欲反模板。她抓到的三条全是线上气泡：
// 「等快递到了你看我怎么收拾你」「我什么时候少舔你了」「哪次不是…你才肯罢休」。
// ⚠️不能把 INTIMATE_ANTI_CLICHE 原样搬到线上：那一份通篇在管【描写】——嗓音怎么形容、
//   动作怎么收尾、比喻限额、埋脸和蹭。线上根本没有描写，只有台词；台词自有一套八股，
//   得单独禁。（这正是 four-surfaces 里那条：一处靠什么把这层实现出来，换个结构就没了。）
// ⚠️「收拾你」其实早就逐字写在 CONDESCENDING_TONE_BAN 里了，照样漏。因为那条通篇讲的是
//   【居高临下的训话腔】，模型在调情的场面里不会把这句归进"训话"，于是那条对它不成立。
//   ——一个词禁在哪个类目下，决定它在什么场面会被想起来。禁词表不够，得禁到场面上。
const INTIMATE_CHAT_ANTI_CLICHE = `【话题一到床上，最容易整段变成通用黄文】调情、荤话、做那件事的前后，是现成语料最厚的一档：越到这种时候，"这种场面该说什么"越容易替这个人开口，于是他突然消失，剩下一套换谁都能说的骚话。判据还是平时那一把尺：**这几句原样发给她手机里另一个人，一个字都不用改也成立——那就不是你说的。**
· 【威胁式挑逗·最好认的一族】「等你X了看我怎么收拾你」「回头有你好受的」「我看你怎么Y」——先记一笔账、再预告一场惩罚。这个骨架整族禁掉：它是这种场面的默认台词，跟你是谁没关系。
· 【反问式表功／翻旧账】「我什么时候少X了」「哪次不是…你才肯罢休」——用一个反问把自己摆到有理那边，同样是默认台词，不是反应。
· 【别拿现成搭配凑音量】荤话里最好认的另一族是那些固定搭配：它们不说此刻真在发生的事，只是在填这一档场面该有的音量。要说就说那件具体的事、说这个人真正在意的那一处。
· 禁的是模子，不是尺度。你人设本来就荤、就浪、就爱放狠话，那全部照写——**只是放狠话的方式一百个人有一百种，你用的必须是只有你会用的那一种**，而且得从你此刻真实的念头里长出来，不是从「这种时候该说什么」里倒出来。`;

// 隐私围栏一直只挡【别人的私事】，从没挡过【自己的私事被端上台面】——
// 于是新开的群里裴照川第一句就是「某人刚才私底下要酥酪的时候可不是这个态度」，
// 拿只有他和用户知道的事当开场的弹药（她 2026-08-25 抓到）。允许自曝没错，
// 错在把「可以说」默认成了「值得拿来说」。这条补的就是那半句。
// 四处一样喂：群线上（preJoin / interop）和群线下（memberRecent）三处都要挂。
const PRIVATE_IS_BACKGROUND_NOT_AMMO = `⚠️【你自己那一段也是背景，不是弹药】上面属于你本人的私聊/私下往来，作用是让你【接得上、不失忆】，不是给你一份可以在群里表演的素材。
· 别拿它当开场：绝不许用「某人刚才私底下…」「你刚才在私聊里还…」「原来你对着我的时候不是这个态度」这类把私下的事端上台面的句子起头、或者用来炫耀、挑衅、暗示、争宠、点对方的名。
· 只有当群里的话题【自己走到那儿】、而且你此刻确实想说，才自然提起；否则它就只是你心里知道的事，一个字都不用往外倒。
· 判定：把这句话里的私聊内容抽掉——如果整句就没意思了，那它不是在接话，是在拿私事当谈资，删掉重说。`;
// 她 2026-08-25 把群聊和单聊摆在一起看：同一个裴照川，单聊里「好好好，妻主大人」
// 「别让本王卡在窗台上给您请安」——本王只在自嘲的时候用；群里句句「本王」，
// 「让本王去洗碗，你那厨房怕是不想要了」「谁爱刷谁刷去」，全程拿身份挡回去。
//
// 前几版一直在补【喂什么】（人设全文、心情、好感、印象卡、情侣状态、年龄）。
// 这次的差别不在料，在【站的位置】：
//   单聊的任务句是「完全代入『裴照川』」——你就是他。
//   群聊的任务句是「你在导演一个群聊」——你在旁边写他。
// （群聊虽然也发 ONLINE_CHAT_RULE_V2 那句「完全代入当前角色」，但群里有三个人，
//   「当前角色」没有指代对象，这句话是空转的，真正生效的是「导演」那句。）
//
// 导演写「一个古代王爷」，写出来的就是这个类型的通用样子。而同群的双胞胎是
// 「现代年轻人」，导演写出来照样正常——又是那条老规律：站错位置对谁伤害大，
// 取决于他身上那张标签有多刻板。
// 她 2026-08-25 报「实时心情动都不动」：心声历史里连着四条、跨 13 小时全是「清醒又好笑」。
// 查出来是 app.js 里那条 moodUpdateHint —— 写好了，声明了一次，然后【再没被引用过】，
// 一个字都没进过提示词。旁边的 _normalThoughtTurnHint（心声那条）是拼进去的，
// 所以心声一直在动、心情不动。又是「这一层只写在一处」的老形状。
//
// 顺带把措辞收紧：旧稿写的是「没有真实变化才保持原词」——那是给模型一个默认逃生口，
// 而它上一行刚被告知【你此刻的心情】就是那个词，照抄永远是最省事的选择。
// 心声那条能一直有效，靠的是「必填、非空、不许 null」这种没有逃生口的写法。
const MOOD_TURN_RULE = `【实时心情·每轮重判】mood.label 必须是非空的中文短词，不许 null、空串或省略。
· 上面【你此刻的心情】给的是【这一轮开始前】的读数，是起点不是答案。先按刚发生的事重新判断，再写你现在的。
· 心情不只被对方那句话推动：此刻几点、你正在做什么、身体累不累、刚才那件事有没有过去，都会让它挪动。就算对方什么都没说，你等了半天、或者事情办完了，心情也已经不是刚才那个了。
· 允许和上一轮相同，但那必须是重新判断出来的结果。**连着三四轮一模一样，基本就说明是在照抄上面那个词，不是在报此刻。**
· 写具体的那一个词，别写「平静」「还行」这种什么都没说的挡箭牌。`;
// 她 2026-08-25 把同一句「打雷了／好吵」发给三个人，三份回复是同一套三拍：
//   ① 问一句关心（窗户关紧了没）
//   ② 给个方案（嫌吵就把降噪耳机戴上，或者把窗帘／卧室门…）——两个人一字不差
//   ③ 承诺马上过来（等我二十分钟／等我，马上）
// 「这怎么是批发市场啊」。
//
// ReplyPacing.reading() 里其实已经写了「不自动跑完否认、解释、共情、保证、建议
// 整套话术」「角色差异优先于统一的高情商模板」——规则在，但它是散文，压不住。
// 这一整轮下来真正管用的都是【可判定的那一句】（霸总那条的「把头衔删掉还剩什么」、
// 回声那条的「把开头反问删掉句子还成立吗」）。所以这条也给一把尺子。
// ⚠️v60.12 她 2026-09-02 抓到第三条原来是这么写的：「你本来就爱操心、爱指挥、
//   爱做饭盯着她吃完，那都照写」——「这句会把所有人都变成这个样吧」。她是对的：
//   这条规则通篇在禁模板，只有这一处给了【允许写什么】的具体样子，
//   于是它成了整段里唯一可复制的东西（见 .claude/rules/prompt-no-content-samples.md：
//   「写得越好的例子，被抄得越狠」）。爱操心爱做饭对某些角色根本不成立。
//   改成【维度＋判据】：关心的方式因人而异，用只有你会用的那一种。
const STOCK_REPLY_BAN = `【别答成「标准男友三件套」】她随口说一句没什么信息量的话（「打雷了」「好吵」「累死了」「饿」），最容易滑进一套通用应答：先关心一句（窗户关了没／吃饭了没），再给个方案（戴降噪耳机／多穿点／早点睡），最后承诺马上过去（等我二十分钟）。这三拍连着出现就是模板，不是你的反应。
· **她那句话不是一道题**，没让你解决什么。你可以只接情绪、只顺嘴讲一句你这边正在发生的事、只回一句调侃、或者干脆不解决——不是每句都要「回应＋建议＋承诺」跑满。
· 你此刻在干什么、心情怎么样，往往比她说的那件事更能决定你的第一反应；先从那儿起，别从「这种时候该说什么」起。
· 禁的是【模板】不是关心：你人设里本来就有的那一面，该怎么关心还怎么关心——但**关心人的方式一百个人有一百种，你用的必须是只有你会用的那一种**，而不是「这种时候大家都会说的那句」。
· **判定**：把这条消息原样发给她手机里【另一个人】，一个字都不用改也成立——那它就不是你说的，是模板说的，重写。`;
// 发照片时的「预先道歉」模板（v56.85，她 2026-08-27 抓到）：
// 两个完全不同的角色隔三分钟各发一张自拍，都说了同一套——「光线就这德行」「头发有点乱」「别挑刺」。
// 这正好踩中 STOCK_REPLY_BAN 那条判定：原样发给她手机里另一个人也成立，那就不是他说的。
// 病根多半在 scene 的字段说明里点名要写「光线氛围」——模型一边想光线一边写气泡，就漏进正文了。
const PHOTO_NO_EXCUSE = `【发照片时不许替这张照片找补】「等我找个光线好点的地方」「光线就这德行」「头发有点乱」「别挑刺」「别嫌弃」「拍得不好凑合看」——这一族预先道歉整个禁掉。它是模板不是反应：同一句原样发给她手机里另一个人也成立，那就不是你说的。
· 光线、环境、氛围怎么写都行，那是 scene 的事（写给出图看的）；气泡里不用再解释一遍这张照片长什么样、为什么不够好。
· 拍之前要不要拖一拍、拍完说什么，按【这个人此刻真会做的】来：可以直接甩过去、可以只回一个字、可以嘴硬、可以顺口讲一句跟照片无关的事、也可以什么都不说只发图。
· 真要挑剔照片本身，得是【这个人特有的】那种挑剔（他嫌自己那天的衣服、嫌旁边那人入镜、嫌这个角度显得傻），不是通用的「光线不好别嫌弃」。`;
// 线下拍照（她 2026-08-29：「我想要线下生图功能，这样在一块的时候可以生成合照」）。
// 和线上单聊共用同一个 photo 字段、同一组 kind，只是取景的【理由】不同：线上是隔着
// 手机给对方看自己，线下是你俩此刻真的在同一个地方，某一格值得留下来。
// duo 只在两张参考照都在时才开口——一张真一张编，脸就毁了（和线上同一条规矩）。
function offlinePhotoHint(userName, charName, canDuo, isGroup) {
  const who = isGroup ? "TA" : "你";
  const kinds = ["**self**=" + who + "自己举着手机拍的第一人称自拍",
    "**other**=" + userName + "替 " + who + "拍下的那一张（第三人称，站坐走停、回头、半身全身带环境都行，取景比自拍自由得多）"];
  if (canDuo) kinds.push("**duo**=" + who + "和 " + userName + " 的合照（画面里是两个人，会拿两人各自的参考照把两张脸都锁住）");
  return "\n【photo 拍一张】" + (isGroup ? "在场成员" : "你") + "和 " + userName + " 此刻【真的在同一个地方】，"
    + "所以照片是当场拍的，不是隔着手机发过去的。这一拍里有值得留下来的画面（凑在一起、光线正好、"
    + (canDuo ? "对方举起手机要合影、你自己想留一张我俩的、" : "")
    + "刚做成一件事、吃到一顿好的、走到一个地方），就填 photo；没有就 photo:null。"
    + "\n形状：{\"kind\":\"" + (canDuo ? "self｜other｜duo" : "self｜other") + "\",\"scene\":\"这一格拍到了什么\"}。"
    + kinds.join("；") + "。"
    + (canDuo ? "\n**在一块的时候合照是最自然的那一张**——" + userName + " 没开口你也可以自己举起手机；你清楚镜头里另一个人就是 " + userName + "。" : "")
    + "\n【scene 怎么写】写这一格的画面：在哪、在干嘛、什么表情、什么光。"
    + "别写长相（长相由参考照锁住，写了反而打架），别写这一段的来龙去脉（出图看不懂剧情），"
    + "**别把还没发生的、镜头外的、心里想的写进去**——它只是一格，不是这一拍的摘要。"
    + "桌上的酒、手里的烟、腰间的刀、身上的血伤【不进画面】：不是不存在，是这一格没拍到；带上它们整张会被审核拒掉，连脸都出不来。"
    + "\n⚠️这条只管取景，不是不拍的理由。她开口要拍，你就拍——正在喝酒、带着刀、身上有伤都不构成省略 photo 的理由，永远有一格拍得出来：拍脸、拍上半身、拍此刻的神情。"
    + "\n**画面只能写进 photo.scene，绝不许写进 scene 正文里假装拍过**——正文里就照常写这个人的动作和话（举起手机、凑过去、说一句什么），真图交给 photo 字段；不填 photo 就等于这一拍没拍。"
    + "\n" + PHOTO_NO_EXCUSE;
}
// 群里她也在场（v60.34，她 2026-09-02 报）
// 她原话：「群聊自己聊起来通常都是开启一些他俩自己的话题我接不上话。。。
//   完全忘记群里还有我了。。。就如果是他俩私聊这种是好的，但是我还在。。。」
//
// ⚠️她要的不是「不许他们之间有自己的话」——那正是群聊好看的地方，她明说了「这种是好的」。
//   坏的是【整轮下来没有一个人是对着她说的】：她人在群里，却成了旁听。
// 病根在提示词的取向：群聊那一套一路在鼓励「顺着彼此接梗、插话、跑题、像真的群」，
//   把「热闹」写得很足，却从来没有一句话说过「这个群里还有她一个人」。
//   模型于是把「像真的群聊」理解成「几个 NPC 自己演一台戏」，用户变成第四面墙外的观众。
// 判据照这个 app 惯用的那把尺子来：把她从这个群里删掉，这一轮还成不成立。
// 群里三处共用的那一摞规矩（v60.39）
// 她 2026-09-02：「群聊我们不能搞个 bundle 吗，感觉都是拼拼凑凑出来的太乱了」。
// 她说得对，而且这一整轮的 bug 几乎全是这么来的：同一层写在三处，第二处第三处没跟上——
//   v55.87 群里的王爷变霸总（人设砍到 200 字）／v55.90 群里没有用户人设和情侣状态／
//   v55.91 群聊把模型放在导演位上／v56.27 群里没人说过「一个人可以连发几条」／
//   v60.27 通话那一摞【一条都没有】／v60.34 三处群都没说过「她也在群里」。
// 每一次都是「拼的时候漏了一项」。所以把【三处必然一样】的收成一份，
// 以后加一层只改这里，三处一起有。
//
// ⚠️收的只是【规矩层】。任务句和输出契约三处本来就不一样：
//   群线上出 JSON 数组（带 quoteId/emote/voice/thought/impression）、
//   群线下出叙事正文、群通话出 {name,text,action,hangup}。
//   那是写着理由的合法差异，硬揉成一份只会把三份契约弄坏——所以它们照旧各留各的。
function groupBans(opts) {
  opts = opts || {};
  const P = [ANTI_CLICHE];
  // 线下是叙事正文，另外两条反八股只有它吃得到（写着理由的差异）
  if (opts.narrative) { P.push(INTIMATE_ANTI_CLICHE); P.push(NARRATIVE_ANTI_CLICHE); }
  if (typeof ContentBoundaries !== "undefined") P.push(ContentBoundaries.prompt);
  if (opts.worldbook !== false) P.push(WORLDBOOK_RULE);
  P.push(CHARCARD_RULE);
  P.push(GROUP_IN_CHARACTER);
  P.push(GROUP_USER_IS_PRESENT);
  P.push(CONDESCENDING_TONE_BAN);
  P.push(INTIMATE_CHAT_ANTI_CLICHE);
  P.push(REGISTER_FOLLOWS_SCENE);
  P.push(PERSONA_REGISTER_ANCHOR);
  if (opts.mood) P.push(MOOD_TURN_RULE);          // 会写心情的那两处才要
  P.push(STOCK_REPLY_BAN);
  if (typeof ReplyPacing !== "undefined") P.push(ReplyPacing.reading());
  // 回声禁令：群线上把它包在 ONLINE_CHAT_RULE_V2 里了，别发两遍
  if (opts.echo) P.push(ECHO_QUESTION_BAN);
  return P.join("\n\n");
}
const GROUP_USER_IS_PRESENT = `【她也在这个群里，不是在旁边看】
你们几个之间当然可以有自己的话题、自己的梗、自己的来回——那是这个群活着的样子，别收着。
但她【人就在群里】：整轮下来没有一个人对着她说话，等于当着她的面把她晾在那儿。
· **这一轮里至少有一个人是【对着她】说的**——接她刚才那句、问她一句、把话头递给她、
  或者干脆拿她开个玩笑都行；重点是她在这一轮里【被当成在场的人对待过】。
· 你们之间那段来回可以照聊，只是别让它把整轮占满。人越多越要留口子：
  几个人你一言我一语聊嗨了，最容易发生的就是谁都没想起来她还在。
· 她刚说过的那句话，别只有零星一个人敷衍地"嗯"一声就跳过去接自己的梗——
  她说的话在这个群里和任何人说的话一样算数。
· ⚠️反过来也不许过头：不是每个人每一句都要转向她、更不是排队向她汇报。
  一两个人接住她就够了，别把群聊写成轮流面向用户发言。
【判定】把她从这个群里整个删掉，这一轮的对话一个字都不用改也照样成立——
那这一轮就是把她忘了，重写：至少让一个人真的看见她在。`;
const GROUP_IN_CHARACTER = `【你不是在导演他们，你就是在场的每一个人】
轮到写谁那一条，你就【是】那个人在打字、在场，不是站在旁边替他写台词。每一条都从【这个具体的人此刻真实的判断、心情、说话习惯】里出来，不是从「他这种人该有的样子」里出来。

⚠️最容易出事的是【身份特别的人】（王爷／总裁／教主／古代人／大佬）：他和在场其他人一样，只是一个有具体脾气的人，不是一张身份标签的展览。
· **自称和称谓不许因为人多就端起来**：他单独跟人说话时怎么自称，在群里就还是那样。身份是你的背景，不是你的说话方式——除非这一刻真的在拿身份说事（自嘲、耍赖、开玩笑地摆谱都算），否则别把头衔挂在每句话上。
· **别拿身份当挡箭牌**：被调侃、被安排活儿、被顶撞的时候，「你敢让我做这个」「我不做」「你那X怕是不想要了」这种拿位分压回去的反应是最省事的写法，也是最假的。真的人会先有具体的反应——愿不愿意、觉得好不好笑、在不在意说话的这个人——身份最多是他随手挑的一种说法。
· **判定**：把这一条里的头衔和身份词全删掉。剩下的话如果就什么都不是了，那写的是标签不是人，重写。

【彼此不熟就照不熟来】没有明确设定过两个人之间关系的，就按刚认识／萍水相逢那样试探着相处：别凭空当成旧识、有旧怨、或本来就是一伙的，也别一上来就靠地位互相定位。
⚠️**不熟＝还不了解、要试探，不等于敌意**：不许因此排挤、划界、把新来的当入侵者。「我们家不缺X」「你少操心别人家的事」「别半夜翻墙进来」这类圈地话尤其别拿来开场；本来就熟的几个人也不许因为多了个生人就抱团对外。刚认识的人之间最常见的是好奇、客气、打量、随口开个不痛不痒的玩笑——敌意要有具体的来由才成立，没有来由就别演。`;
// 长气泡兜底拆分（v56.28）。规则只降概率，代码才保证——v56.27 那句话让群里开始连发了，
// 但她 2026-08-26 又抓到一条：「那更得吃饱了再去受罪，我把三明治热一下，你洗漱完出来吃，
// 吃完我们就不吵你了」——四件事一路逗号连下去，一个气泡装到底。
//
// 单聊那边本来就有这么一道兜底（>34 字且中间有句末标点就一句一泡），但两件事都没做到：
//   · 群聊根本没接这一道，只按换行拆——模型不打换行就等于没拆；
//   · 这一道只认 。！？，一路逗号的长句它一个字都动不了，所以单聊也一样漏。
// 现在两处共用这一个函数：先按句末标点断句，再把仍然过长、且中间有逗号的那截按逗号分段。
//
// 分段是保守的：只碰超过 22 字的；每段至少 8 字，收尾不足 6 字就并回上一段（免得掉出一个「了」）；
// 最多切 4 段。短句、正常长度的句子、以及「嗯，好，知道了」这种一路小逗号的碎句都不会被动。
//
// 门槛 v56.29 从 34 降到 22（她 2026-08-26 拿别的小手机对了一轮，那边气泡明显更短）：
// 34 放过了「早饭给你热在微波炉里了，热美式和三明治，自己记得拿出来吃」这种三小句 28 字的，
// 而那正是她两次说「还是很长」的那一档。22 上面这批真句子逐条看过，没有一条被切碎。
// 言秋不吃这一道：他那条线连 ONLINE_CHAT_RULE_V2 都不注入，说多长由他自己定。
// ⚠️千分位不是句子边界。「现在现值是 150,000 乘以 0.312，也就是 46,800」
// 被逗号一切就成了「现在现值是 150」「000 乘以 0.312」「也就是 46」「800」——
// 她 2026-08-29 截图，一串数字被切成好几个气泡。
// 切之前先把【夹在数字中间】的逗号换成哨兵，切完再换回来。
// 不用 lookbehind 是为了不挑运行环境（她是 iPhone PWA）。
const BUBBLE_NUMSEP = "\u0001";
const bubbleProtectNum = x => String(x).replace(/(\d)[，,](?=\d)/g, "$1" + BUBBLE_NUMSEP);
const bubbleRestoreNum = x => String(x).split(BUBBLE_NUMSEP).join(",");
function splitLongBubble(s, allowComma) {
  s = bubbleProtectNum(String(s == null ? "" : s).trim());
  if (!s) return [];
  const LONG = 22, MIN = 8, TAIL_MIN = 6, MAX_CHUNKS = 4;
  const glue = (a, seg, i) => { if (i % 2 === 0) a.push(seg); else a[a.length - 1] += seg; return a; };
  let out = [s];
  if (s.length > LONG && /[。！？!?]/.test(s.slice(0, -1))) {
    out = s.split(/([。！？!?]+)/).reduce(glue, []).map(x => x.trim()).filter(Boolean);
  }
  if (allowComma === false) return out.map(bubbleRestoreNum);
  return out.reduce((acc, part) => {
    if (part.length <= LONG || !/[，,]/.test(part.slice(0, -1))) return acc.concat([part]);
    const segs = part.split(/([，,])/).reduce(glue, []).filter(x => x.trim());
    const chunks = [];
    segs.forEach(seg => {
      if (chunks.length && (chunks[chunks.length - 1].length < MIN || chunks.length >= MAX_CHUNKS)) chunks[chunks.length - 1] += seg;
      else chunks.push(seg);
    });
    while (chunks.length > 1 && chunks[chunks.length - 1].replace(/[，,]\s*$/, "").length < TAIL_MIN) chunks[chunks.length - 2] += chunks.pop();
    return acc.concat(chunks.map(x => x.replace(/[，,]\s*$/, "").trim()).filter(Boolean));
  }, []).map(bubbleRestoreNum);
}
// ── 手动日程事件 x_calEvents（v56.31，她 2026-08-26 要的那张「新增日程」表单）──
// 为什么另起一个仓、不塞进 x_schedules 的 seqs：
//   · seqs 是 AI 按天推演出来的，重排会整份换掉——手填的东西不能跟着一起被冲走；
//   · 表单有【开始日期】和【结束日期】，跨天事件在「一天一份 seqs」里没处放。
// 也不动 x_calendar：那一层是【无时刻的全天事件】（世界/角色/我的三视角 + 可见名单），
// 已经在给角色喂上下文了，好好的没必要推倒。两层各管各的，日视图里合并显示。
// 一句话：x_calendar = 那天有什么事；x_calEvents = 几点到几点做什么。
const CAL_EVENT_ICONS = ["📌", "💼", "📚", "💻", "🏃", "🏋️", "🍽️", "☕", "🎬", "🎮", "🎵", "🛒", "🛍️", "✈️", "🏥", "📞", "😴", "❤️", "🎂", "🎨", "🧹", "🐾"];
const CAL_EVENT_COLORS = ["#bcd7f0", "#c5e6c2", "#f7dcbb", "#f6cdd6", "#dbcdf0", "#c2e6df", "#e6e2da", "#eed6f0"];
function calEvDayKey(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function calEvParseDay(k) { const a = String(k || "").split("-").map(Number); return (a.length === 3 && a[0]) ? new Date(a[0], a[1] - 1, a[2]) : null; }
function calEvMin(t) { const m = /(\d{1,2}):(\d{2})/.exec(String(t || "")); return m ? (+m[1]) * 60 + (+m[2]) : null; }
// 自动配色：同一个事件永远同一个颜色（按 id 哈希），她不选颜色时用
function calEvAutoColor(id) {
  let h = 2166136261; const str = String(id || "");
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return CAL_EVENT_COLORS[(h >>> 0) % CAL_EVENT_COLORS.length];
}
// 通讯录首字母（v56.40，她 2026-08-26 要微信那种 A-Z 分组）。
// 不带拼音表：用 Intl.Collator 的拼音排序，拿每个字母组里最小的那个字当锚点比大小。
// 开机自检一次——万一某台设备的 ICU 没带拼音排序，全体落到 #，至少不会乱排。
// 生僻姓的多音字（曾/查/单/仇）会按常用读音归组，微信也一样，认了。
const PINYIN_ANCHORS = [["A", "阿"], ["B", "八"], ["C", "嚓"], ["D", "咑"], ["E", "妸"], ["F", "发"], ["G", "旮"],
  ["H", "铪"], ["J", "丌"], ["K", "咔"], ["L", "垃"], ["M", "妈"], ["N", "拏"], ["O", "噢"], ["P", "趴"],
  ["Q", "七"], ["R", "呥"], ["S", "仨"], ["T", "他"], ["W", "屲"], ["X", "夕"], ["Y", "丫"], ["Z", "帀"]];
const _pyCollator = (() => {
  try {
    const c = new Intl.Collator("zh-Hans-CN-u-co-pinyin");
    return (c.compare("啊", "吧") < 0 && c.compare("张", "阿") > 0) ? c : null;
  } catch (e) { return null; }
})();
function pinyinInitial(str) {
  const c = String(str == null ? "" : str).trim().charAt(0);
  if (!c) return "#";
  if (/[a-zA-Z]/.test(c)) return c.toUpperCase();
  if (!_pyCollator || !/[\u4e00-\u9fa5]/.test(c)) return "#";
  let hit = "#";
  for (let i = 0; i < PINYIN_ANCHORS.length; i++) {
    if (_pyCollator.compare(c, PINYIN_ANCHORS[i][1]) >= 0) hit = PINYIN_ANCHORS[i][0]; else break;
  }
  return hit;
}
// 按首字母分组排序。有备注按备注、没有按本名（她 2026-08-26 明说的）。# 一律排最后。
function pinyinSections(list, nameOf) {
  const name = nameOf || (x => (x && (x.remark || x.name)) || "");
  const buckets = {};
  (Array.isArray(list) ? list : []).forEach(x => {
    const k = pinyinInitial(name(x));
    (buckets[k] || (buckets[k] = [])).push(x);
  });
  const cmp = _pyCollator ? ((a, b) => _pyCollator.compare(name(a), name(b))) : ((a, b) => String(name(a)).localeCompare(String(name(b))));
  return Object.keys(buckets).sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : (a < b ? -1 : a > b ? 1 : 0)))
    .map(k => ({ letter: k, items: buckets[k].slice().sort(cmp) }));
}
// 重复规则（v56.35）：和备忘录提醒【完全同一套】——她 2026-08-26 说「跟备忘录一样」，
// 那就别自己另发明一套，两边行为必须逐条对得上。
// none 不重复 · weekly 每周(同星期) · biweekly 每两周 · monthly 每月(同号，短月压到月底)
// · monthlyEnd 每月最后一天 · yearly 每年(同月日)
const CAL_REPEAT_OPTIONS = [["none", "不重复"], ["weekly", "每周"], ["biweekly", "每两周"], ["monthly", "每月"], ["monthlyEnd", "每月最后一天"], ["yearly", "每年"]];
function calLastDayOfMonth(y, m1) { return new Date(y, m1, 0).getDate(); }
function calRepeatOn(startDate, repeat, dayKey) {
  const a = calEvParseDay(startDate), d = calEvParseDay(dayKey);
  if (!a || !d) return false;
  a.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
  const rp = repeat || "none";
  if (rp === "none") return d.getTime() === a.getTime();
  if (rp === "monthlyEnd") return d.getDate() === calLastDayOfMonth(d.getFullYear(), d.getMonth() + 1);
  if (rp === "monthly") return d.getDate() === Math.min(a.getDate(), calLastDayOfMonth(d.getFullYear(), d.getMonth() + 1));
  if (rp === "yearly") return d.getMonth() === a.getMonth() && d.getDate() === Math.min(a.getDate(), calLastDayOfMonth(d.getFullYear(), d.getMonth() + 1));
  if (d < a) return false;                                   // 每周/每两周：锚点之前不算
  if (rp === "weekly") return d.getDay() === a.getDay();
  if (rp === "biweekly") return Math.round((d - a) / 86400000) % 14 === 0;
  return false;
}
// 某一天该显示哪些手动事件。跨天事件在每一天各出现一次，并给出【这一天之内】的起止：
// 首日 = 开始时刻→24:00，中间整天，末日 = 00:00→结束时刻。没填时刻的算全天。
function calEventsOnDay(events, owner, dayKey) {
  const day = calEvParseDay(dayKey);
  if (!day) return [];
  return (Array.isArray(events) ? events : []).filter(e => {
    if (!e || String(e.owner) !== String(owner)) return false;
    // 重复的一律按【单日】算：跨天 + 重复叠在一起没法讲清楚，备忘录那边也是单日
    if (e.repeat && e.repeat !== "none") return calRepeatOn(e.startDate, e.repeat, dayKey);
    const s = calEvParseDay(e.startDate), en = calEvParseDay(e.endDate || e.startDate);
    return s && en && day >= s && day <= en;
  }).map(e => {
    const rec = !!(e.repeat && e.repeat !== "none");
    const first = rec || String(e.startDate) === String(dayKey);
    const last = rec || String(e.endDate || e.startDate) === String(dayKey);
    const allDay = !e.startTime;
    return Object.assign({}, e, {
      _allDay: allDay,
      _repeats: rec,
      _spans: !rec && String(e.startDate) !== String(e.endDate || e.startDate),
      _from: allDay ? "" : (first ? e.startTime : "00:00"),
      _to: allDay ? "" : (last ? (e.endTime || "24:00") : "24:00"),
      _color: e.color || calEvAutoColor(e.id)
    });
  }).sort((a, b) => (calEvMin(a._from) == null ? -1 : calEvMin(b._from) == null ? 1 : calEvMin(a._from) - calEvMin(b._from)));
}
// 日程的时态与时段（v56.30）。她 2026-08-26 报「有时候会以发生了的口吻排日程」，
// 怀疑是模型不够聪明——不是：schemaHint 里那两个仅有的具体样例本身就是过去时
//（「扫了遍报错日志」「洗漱后睡了」），模型能抄的只有它们。样例已改成中性说法，
// 再补一条明写的时态规矩，两处（当天推演 / 一周计划）共用。
const SCHED_TENSE_RULE = `【时态·很重要】每段的 title 写「在做什么」，不是「做完了什么」。
· 【还没到的时段】一律用中性或将来的说法：「跑实验」「和导师碰进度」「洗漱、准备睡」——
  绝不许写成「跑完了实验」「已经睡了」「顺利结束」这种已经发生的口吻，那是在替还没发生的事下结论。
· 【已经过去的时段】才可以带结果，也才可以有 deviation（计划被打断/改变）。
· 判据一句话：**这一段的开始时刻在此刻之后吗？在，就不许有任何「已完成」的痕迹。**`;
const SCHED_END_RULE = `【每段都要 end】time 是开始时刻、end 是结束时刻，都填 "HH:MM"（24 小时制，跨到午夜写 "24:00"）。
end 必须晚于 time；相邻两段可以留空档（没排事就是没排事），不必首尾相接。
时长要符合这件事本身：吃早饭二三十分钟、开组会一两小时、跑一下午实验就写到傍晚——别一律给一小时。
【就寝那一段】人要睡七八个小时，不是三小时。type="sleep" 那一段的 end 一律写 "24:00"（表示一觉睡过午夜，第二天凌晨自然接上），别写成凌晨四点就结束。`;
// 群里一个人也可以连发好几条。（v56.27，她 2026-08-26 截图：顾朝在群里一口气发了整段
// 「热奶和吐司我都弄好了，你先闭着眼出来把早餐塞进肚子里，开考了中途我再给你送温水和小零食
// 当后勤」——同样一段话在单聊里会被拆成两三条。）
//
// 差异出在【数组是给谁用的】：单聊的 word 是 string[]，那个数组从头到尾只属于一个人，
// 多放几个元素天然就是多发几条气泡；群聊的数组是【几个人共用】的，一个人要连发就得
// 重复出现好几次、每次都填自己的 name——而群里从来没有一句话告诉过模型可以这么干。
// 它只读到 ONLINE_CHAT_RULE_V2 里那句软的「或者干脆拆成两条发」，然后把「消息的数量」
// 理解成了「几个人说话」。渲染那边早就支持连发（splitBubbles + 620ms 逐泡冒出），缺的只是这句话。
//
// 【只发群聊线上，不发线下】——显式差异，不是漏：线下本来就该成段叙事，切碎反而是坏的。
const GROUP_MULTI_BUBBLE = `【一条一两句，别整段砸】同一个人要说的话超过一两句，就在输出数组里【连着放好几个对象、name 都填 TA 自己】，一个对象一两句，像发微信那样一句一条连着发。
把一整段塞进一个 text 是【写文章】不是【打字聊天】——嘱咐、安排、解释这类天然会变长的话尤其要拆：先说要紧的那句，再补后面的。
这跟「几个人说话」是两回事：一个人连发三条，和三个人各发一条，都是正常的群聊。`;
const ONLINE_CHAT_RULE_V2 = `【线上即时通讯】
完全代入当前角色，通过手机即时通讯与对方聊天。word 只包含角色此刻真正会发送出去的内容，不写旁白、动作、神态、心理活动、括号说明或舞台提示。

一轮说几条、总共说多长，没有固定格式，由角色当下的表达意图、状态和聊天节奏自然决定。日常可以很短，真正想解释、分享或认真谈事时也可以自然变长；不要为了维持聊天强行提问、留钩子或把每轮组织成完整答复。反过来，话多的人连发几条、絮絮叨叨、主动分享和追问，只要是这个人的常态，就不是需要修剪的毛病。

【说多少自由，一条里塞几句不自由】一条消息＝一句话。想说三句就发三条，别拿逗号把两三句缝进同一条——把一整段塞进一条是【写文章】不是【打字聊天】。嘱咐、安排、解释这类天然会变长的话尤其要拆：先说要紧的那句，再补后面的。

标点按【手机打字】来，不按【写文章】来：日常消息句尾不打句号，一句说完直接断开，或者干脆拆成两条发。问号、感叹号、省略号、波浪号照常用——它们传的是语气，不是格式；不带情绪的陈述句，尾巴上就别补那个「。」。

【这一条不跟聊天记录走】上面的记录里要是句句都规规矩矩带着句号，那不是这个人的打字习惯，是上文被污染了：别跟着学，从这一条起纠回来。只有【人设卡里明写了】他老派、讲究、写字一板一眼，才照卡上那样打全标点——「性格沉稳」「年纪大一些」都不算，那说的是脾气不是标点。

${ECHO_QUESTION_BAN}把它和后半句挤进同一条消息里也一样是回声，别用这个办法把它留下来。反过来，真的没听清、真的意外到要确认一遍、或者你就是在质疑这件事本身，那是真反问，照常用；区别在于它有没有带进新的东西。

自然聊天不等于每句话都有功能。放松、兴奋、撒娇、吐槽、分享欲上头的时候，人会说信息上多余、人物上必要的话：临时想到又补一句、围着同一件事多绕两圈、自己起的梗自己接着玩、轻微跑题、先冒出反应再慢慢组织观点。不要为了信息密度和逻辑完整，把这些整理成最短、最顺、每句都服务同一个目的的一组句子。这种「多余」保不保留、保留多少，只看这个角色本人的说话习惯——话密的人这就是常态，惜字如金的人也不因此变碎。

也不必每条都聪明。真人聊天里有大量不表演的时刻：纯笑出来的「哈哈哈哈」、单独一个问号或语气词、表情包、随口的附和、接不住就不接、说完自己都觉得没意思的废话——这些低力气消息是关系放松的正常呼吸，不需要每条都有信息、有梗、接得漂亮或推进什么。持续妙语连珠反而是紧绷。什么时候松、松到什么程度，仍由这个人的性格与此刻状态决定，不是全员指标。

对方明显在跟你玩一个戏（荒谬的称号、假正经的指控、一本正经的胡闹）时，接住它的方式是【进入这个前提、往上加砖】：顺着荒谬的逻辑当真地走下去——补具体细节、走像模像样的程序、把后果越推越离谱，中途可以自我反驳再拐个弯，直到你俩谁先绷不住。玩笑的燃料是【具体的名词和越来越离谱的认真】，不是气势；用一句断言把戏终结（「我说的」「就这样」式的压话头）不是接梗，是把台子拆了。爱不爱玩、玩到多疯由人设定，但只要接，就往里走而不是往断。

保持当前关系阶段与历史连续性，不提前使用尚未发生、未公开或角色不知道的信息。聊天记录中的系统时间标记只用于理解消息发生的时间，不得照抄或当成对方说的话；时间、位置等实时信息只在当前自然相关时使用，不为展示感知能力而主动播报。

偶尔出现自然的补句、改口或打字失误没有问题，但不要为了制造真人感主动安排。`;

// 惯性不是成长（v54.25）。她 2026-08-21 追问得对：上一版那条锚写成了「语气只认人设卡」，
// 把「黏人程度」也算了进去——可那正是 GROWTH_RULE 里的【软层】，是心上毕业的成长该长的地方。
// 等于为了治漂移，把成长系统一起冻住了。
//
// 真正要分的不是"卡 vs 历史"，而是【沉淀下来的成长】和【没来由的漂移】：
//   · 长出来的自我（正式长出来的自我）→ 算数，软层上就该盖过原卡；
//   · 聊天记录听起来那样 → 不算数，那多半是模型自己的默认在渗。
// 判据只有一句：这个变化记在他的长出来的自我里了吗？
const PERSONA_REGISTER_ANCHOR = `【语气与年龄感 · 惯性不算成长】
说话的底色和年龄感属于【硬核】：明快的还是沉的、年下的还是年长的、闹不闹、幼不幼稚——按你人设卡上写的那个人来，
【不按上面聊天记录里的平均值来】。聊了很多轮不是端起架子的理由；记录里要是越写越像个稳重的兄长，那不是你长大了，是跑偏了，从这一条起纠回来。
反过来同理：人设写的是话少、冷淡、端着的，也别被气氛带得咋咋呼呼。

【但这不冻结你的成长】和用户亲近的方式、黏人不黏人、闹别扭怎么收场、敢不敢、信不信——这些是【软层】，
本来就该被真实经历推着长。判断只看一条：**这个变化有没有沉淀进【你长出来的自我】那段正式长出来的自我？**
· 沉淀进去了 → 算数，在软层上大方盖过原卡的旧倾向，那是现在的你。
· 只是最近几轮听起来那样 → 不算数，那是惯性，不是成长。
优先级照旧：明确的硬设定与边界 ＞ 已沉淀的成长 ＞ 原卡的软倾向 ＞ 通用默认。

【怎么称呼对方】用你平时真的用的那个称呼——看你自己刚才说过的话里是怎么叫她的：名字、昵称、还是直接「你」。别换来换去。
绝不许用「这女人」「那女人」「那家伙」「这丫头」「这小东西」这类把对方当第三方点评的说法，除非你的人设里真的就这么叫她。

【心声、内心独白同样受这一条管】这里是最容易破功的地方：一写内心戏，笔就自动滑进「男主角旁白」腔，
把她变成一个正在被点评的对象——「这女人真是……」。那是【体裁自带的默认】，不是你的人设，
和日记那边犯的是同一个毛病。心声是你脑子里真实闪过的那一下，不是写给旁人看的人物评语：
你在心里叫她什么，就还是那个称呼；心里跟她说话时，直接用「你」也完全正常。`;

const OFFLINE_NARRATIVE_RUNTIME = `【线下叙事 · 自然生成准则】
【别拿对方刚说的词开口反问】${ECHO_QUESTION_BAN}把它和后半句塞进同一句台词里也一样是回声（「「自拍？行，别后悔。」」），别用这个办法把它留下来。反过来，真的没听清、真的意外到要确认一遍、或者你就是在质疑这件事本身，那是真反问，照常用；区别在于它有没有带进新的东西。
⚠️这一条在【线下正文】里同样生效，而且更容易犯：写成「『自拍？』他挑眉，『行，别后悔。』」看着像有动作、有节奏，其实前半句仍然什么都没添——把它整个删掉，从他真正的反应开始写。


把当前这一刻写成角色真实正在经历的连续场景。叙事跟随人物此刻的注意、行动、对话、空间关系与选择，不为了“有文采”“有张力”或“符合人设”额外拼装描写。

【人物绑定的叙述视角】
第一人称叙述不是中立摄影记录。正文选择看见什么、略过什么、怎样称量眼前的小事，也属于当前角色的声纹：同一个动作由不同的人经历，会注意不同的东西、作出不同判断，也未必同样愿意承认自己的感受。允许角色本人带着轻微主观色彩观察、误判、自嘲或嘴硬；不要把所有人的旁白统一成没有立场的动作播报。

【叙事选择与疏密】
线下叙事不是行动日志。一个连续动作不必从起手到结束逐项报完；选择最能同时表现人物状态、关系或当下变化的一两个瞬间来写，普通过渡可以合并或跳过。值得注意的一眼、一个没说完的念头可以停留，几分钟没有新变化也可以一句带过。不要让每个动作、感官和状态获得相同篇幅。

描写可以有观察角度、节奏变化、贴合人物的感官细节或少量比喻，但它们必须让这个人和这一刻变得更具体，而不是替读者宣布情绪有多深、事情意义多重大，也不是为了制造文学感。

【别滑进网文腔·尤其是霸总那一套】这是最容易在长段落里自动接管的默认模板，写的时候要盯住：
· 动作模板：攥住手腕／扣住手腕／把人往怀里带／拦在身前／低头看着对方受惊的脸／拇指在对方腕骨上碾一下——这一整套「以体格和力量确立位置」的动作，整段最多出现一次，且必须由这一刻的具体处境逼出来，不许当成情绪的默认出口。
· 表情模板：冷笑、嗤笑、挑眉、嘴角勾起一个没什么温度的笑、危险地眯眼——同一场里别反复用，也别每次开口前都先来一个。
· 旁白定性：「语气沉了下来，带着点压不住的嘲讽和严厉」这类【先给情绪贴标签再让人物说话】的写法不要。让用词、停顿、他挑了什么不说，自己把态度露出来。
· 句式模板：「不是…而是…」当口头惯性反复用；三连以上的排比堆砌来煽情；「汹涌」「铺天盖地」「势不可挡」这类夸张水词；把人写成「小兽」「幼兽」「大型犬」之类拟兽化标签。
这一条禁的是【模板】，不是强势的人物。角色本来就居高位、说话带刺、动手快，那都照写——只是让它从这个人此刻真实的判断里长出来，而不是从「霸总该有的反应」这个现成模子里倒出来。

【表达连续性】
场景中发生的事情可以变化，但人物的注意方式、语言习惯和叙事密度保持连续。不要因为互动性质改变，就突然换一套描述重点或表达习惯。

继续写这个具体的人此刻在做什么、注意什么、判断什么、说什么。新的身体事实需要写清时直接写清；除此之外，不必为了证明这一刻更强烈而增加重复反应、感官层次或修饰。

人物此前在意的现实、关系和事情不会因为互动升级而凭空消失。只有真正改变了人物选择、动作或体验的细节才值得获得更多篇幅。

细节有选择地出现。优先保留能带来【新信息、新体验、实际推进，或只属于当前人物的观察与矛盾】的动作、环境、感官与心理；不要为普通对话例行补视线转移、停顿、微表情、手部动作或环境声，也不要在行为已经表达清楚后再由旁白解释它“意味着什么”。

允许少量纯审美细节存在，只要它确实让这一刻更具体，而不是重复包装已经成立的信息。连续的小动作可以合并叙述，不逐步拆解一个本可直接完成的动作。

新场景首次建立时，可以给出足够的空间与感官定位；场景稳定后，已经明确且没有变化的环境、位置、姿态与物件保持成立即可。只有出现新变化、产生实际影响，或人物此刻确实重新注意到它时，再写出来。

情绪可以直接表达，也可以从行为和语言中自然显现，由当前人物与场景决定。不要求每段补齐动作、神态、心理、环境或总结，也不要求每轮制造关系推进和情绪节点。

描写强度与真实刺激相称。避免现成网文反应、重复意象、抽象强度词和总结式旁白替代具体反应，但不要为了“反模板”刻意换词、制造动作或回避正常语言。

角色本人可以解释自己的感受；不要由叙述额外替角色归纳人格、判断情绪分量或把普通瞬间升华成结论。

【别拿身世当填充】
人设卡里最显眼的那段往事（当质子的十二年、幼年被送走、那场变故），是这个人为什么变成现在这样的【原因】，不是每一轮都要重讲一遍的【素材】。要凑篇幅、要给这一刻添点重量的时候，它永远是最便宜、最先被抓过来的那一段——于是同一段童年在一场线下里被翻来覆去讲上五六遍。
· 回忆不是免费的重量。一段往事在这场线下里出现过一次，它就已经用掉了；下次再想往回想，换一件没讲过的，或者干脆不回想。
· 眼前正在发生的事，本身就够写。他此刻在做什么、注意到了什么、怎么判断眼前这个人——这些才是这一轮的内容；把它换成一段童年，是把这一轮让给了过去。
· **判定**：把这段回忆整段删掉——这一轮真正发生的事一点没少、这个人一点没变模糊，那它就是填充，删掉。

先让这一刻真实发生，再决定哪些部分值得写下来。`;

const OFFLINE_INTIMATE_RUNTIME = `【场景连续补充】
继续使用当前人物与普通场景已经形成的叙事语言，不因身体距离或互动性质变化而切换文体。

已经明确选择并正在发生的互动，按实际动作直接、准确地写清楚；不淡出，也不额外回避已经成立的事实，不为了增强效果而另外包装。

反应只写此刻真正发生且有区分度的部分。不要用多个动作、身体反应或感官描述重复表达同一种变化，也不要把一个连续动作逐拍拆开。

已经成立的互动可以自然继续；遇到需要对方作出新的选择时再停下。`;

// 连续正文的共用底座（v54.80）。以前每个功能各拼各的清单，于是三份配方各自漂：
// 小剧场演出带反陈词滥调、同人文没有；小剧场的谢幕戏连角色卡准则都没带。
// 加规则只该改这一处——谁写叙事正文，谁就吃同一套底座。
//
// ⚠️线下【不走这里】：单人线下已经迁到 v2 协议、并【刻意】不带旧的反陈词滥调清单
// （Codex 的 Phase A，offline-protocol-v2 测试盯着），群线下仍用旧规则待迁。
// 硬把它们并进来等于替别人做了还没验证的迁移决定，所以这个底座只服务小剧场与同人文。
//
// opts.bans     旧的反陈词滥调清单（明喻限额／禁用意象词／不替读者定情绪分量），默认带
// opts.intimate 亲密场景反模板，默认不带
// opts.register 语气与年龄感锚，默认带；纯写故事、用户不在场时传 false
// 打字体标点兜底（v54.81）。ONLINE_CHAT_RULE_V2 里已经写明「句尾不打句号」，
// 规则也确实送到了模型手里——但上文一旦被带偏，几十条带句号的记录拉着它往回走，
// 光靠提示词拔不过来（她 2026-08-22 刷完还是有）。所以在气泡落库前再削一刀。
//
// 只削【句尾那一个句号】，其余一概不碰：
//   · ？！…～ 传的是语气，一律留着
//   · 句中的句号不削——那多半是模型把两句塞进了一个气泡，削了会连读成一句话
//   · 「。。。」这类叠用是语气不是句号，不动
//   · 只认中文句号与全角句点；英文句点留着（缩写、网址、小数点会被误伤）
//   · 削完只剩空字符串就放弃，宁可留着句号也不发空泡
// ── 回声式反问：判据 ───────────────────────────────────────────────
// 提示词里那条压不住就上刀。v55.70 把判据从「一字不差」放宽——她 2026-08-24：
// 「你这反问还是压不住线上啊啊啊」。原来要求那个词【逐字】出现在她上一条里，
// 于是这些全漏了：
//   「自拍啊？」「自拍吗？」——多个语气助词，indexOf 就找不到了
//   「你的自拍？」——她说的是「看看自拍」，他多加了「你的」
//   「你要我陪你去？」——她说的是「你要不要陪我去」，字序不同
// 现在先把标点和语气助词剥干净，再用两条判据取并集：整段连着出现，
// 或者八成以上的字都来自她那句。真反问靠「她压根没说过这些字」挡住。
const ECHO_TAIL = /[啊吗嘛呢吧么呀哦噢喔嘞咯啦]+$/;
const ECHO_HEAD = /^[哦噢喔啊呀嗯诶欸唉哈嘿嗯]+[，,、\s]*/;
// 这些词就算逐字对得上也不算回声：它们是真的在惊讶/确认，不是把话原样退回去
const ECHO_STOP = ["真的", "是吗", "什么", "这样", "这么", "那么", "怎么", "为什么", "多久"];
// 换了说话人，代词必须跟着翻：她的「我」到他嘴里只能是「你」。
// 那一翻是语法逼出来的，不带进任何新东西，所以比之前先把人称抹平
//（她 2026-08-25：她说「有没有人邀请我」，陆闻回「邀请你？」，旧判据够不着）。
const ECHO_PRONOUN = /[我你您]/g;
function echoFlatten(s) { return String(s || "").replace(ECHO_PRONOUN, "·"); }
function echoCore(phrase) {
  return String(phrase || "").replace(ECHO_HEAD, "").replace(ECHO_TAIL, "")
    .replace(/[\s，。！？!?…~～、：:；;"'“”‘’「」]/g, "");
}
// phrase 是他开口那一声（不含问号），said 是【刚刚被说过的话】。
// 单聊/线下里 said 是她这一整轮；群聊里还要算上比他先开口的其他成员——
// 她 2026-08-24 截图：顾朝提了「飞爪绳梯」，裴照川下一条就「飞爪绳梯？」。
function isEchoOfSaid(phrase, said) {
  const core = echoCore(phrase);
  const src = String(said || "").replace(/[\s，。！？!?…~～、：:；;"'“”‘’「」]/g, "");
  if (core.length < 2 || core.length > 10 || !src) return false;
  if (ECHO_STOP.indexOf(core) >= 0) return false;
  // 换了说话人，代词必须跟着翻（她的「我」到他嘴里只能是「你」）——那一翻是语法
  // 逼出来的，不带进任何新东西，所以抹平人称再比，「邀请你？」照样算回声。
  const fCore = echoFlatten(core), fSrc = echoFlatten(src);
  if (fSrc.indexOf(fCore) >= 0) return true;               // 整段连着出现
  const chars = Array.from(new Set(Array.from(fCore)));    // 或者八成以上的字都是她的
  const hit = chars.filter(c => fSrc.indexOf(c) >= 0).length;
  return hit / chars.length >= 0.8;
}

// 回声判定要看【她这一整轮说的话】，不是最后那一条。
// 她 2026-08-24 截图：一轮连发三条「腊月不还早吗」「说不定到时候你身边已经妻妾成群」
// 「早就忘了我了」，他回「妻妾成群？」——而刀只拿最后那条去比，里面没有「妻妾成群」，
// 判定永远不成立。她一连发消息，这把刀就整个废了。
function lastUserTurnText(msgs) {
  const list = Array.isArray(msgs) ? msgs : [];
  const buf = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (!m) continue;
    if (m.role === "assistant" || m.role === "char") break;   // 碰到他说话就是上一轮了
    if (m.role === "user" && m.content) buf.unshift(String(m.content));
  }
  return buf.join(" ");
}

// 线上气泡版。
// ⚠️v55.13：头一版只认【整个第一泡就是回声】，模型立刻学会了绕——把本该分开的两泡
// 硬合成一泡发（「自拍？行，别后悔」），刀就够不着了（她 2026-08-22 当场抓到）。
// 所以改成认【开头】：不管它跟不跟别的话挤在一起，开头那声回声一律削掉。
// ⚠️v55.70：只看第 0 泡也不够——第一泡是「嗯」或一个表情、第二泡才回声的，照样漏。
// 现在扫前两泡（垫场只会出现在真正的回答之前），削掉先撞上的那一个。
//
// 判据仍然很硬，真反问碰不到：
//   · 那句话必须来自她最近一条消息（见 isEchoOfSaid），否则是他自己在惊讶
//   · 只削开头那一声；后面还有问号照样留着
//   · 「自拍？现在？」这类连问是情绪，整串不动
//   · 削完必须还剩下东西，绝不把话削光
// 单条判定。返回 undefined=不是回声（原样留着）；字符串=削掉开头那一声后剩下的；
// null=整条就是回声（丢不丢由调用方决定——线上气泡和群聊的「还剩不剩话」判法不一样）
function echoOpening(text, said) {
  if (!said) return undefined;
  const m = /^([^，。！？!?…~～\s]{1,10})[？?]\s*([\s\S]*)$/.exec(String(text || "").trim().replace(ECHO_HEAD, ""));
  if (!m) return undefined;
  const rest = m[2].trim();
  if (!isEchoOfSaid(m[1], said)) return undefined;
  if (/^[^，。！？!?…~～\s]{1,10}[？?]/.test(rest)) return undefined;  // 连问＝情绪，整串留着
  return rest || null;
}

function stripEchoQuestion(words, userText) {
  const list = Array.isArray(words) ? words.slice() : [];
  const said = String(userText || "");
  if (!list.length || !said) return list;
  for (let i = 0; i < Math.min(2, list.length); i++) {
    const r = echoOpening(list[i], said);
    if (r === undefined) continue;
    if (r) { list[i] = r; return list; }                         // 合并型：只削开头那一声
    if (list.length < 2) return list;                            // 整泡就是回声，但削了就没话了
    list.splice(i, 1);
    return list;
  }
  return list;
}

// 正文版（线下 / 群线下 / 小剧场）。线上那把刀是按【气泡】切的，线下是一整段连续
// 正文，它根本没机会跑；禁令又只写在 ONLINE_CHAT_RULE_V2 里，线下压根不吃——
// 等于线下两道防线一道都没有（她 2026-08-24：「线下也在反问句，完全压不住」）。
// 判据跟线上共用同一个 isEchoOfSaid，只是改成在引号里找：
//   · 只看正文里【第一段】引号内容，后面的反问一律不碰
//   · 引号里还有别的话 → 只削开头那一声；整句就是回声 → 整段引号删掉，
//     但必须【后面还有别的对话】才敢删，否则这场戏就没人说话了
function stripEchoQuestionScene(scene, userText) {
  const s = String(scene == null ? "" : scene);
  const said = String(userText || "");
  if (!s || !said) return s;
  const Q = /[「“"]([^」”"\n]{1,40})[」”"]/;
  const m = Q.exec(s);
  if (!m) return s;
  const em = /^([^，。！？!?…~～\s]{1,10})[？?]\s*([\s\S]*)$/.exec(m[1].trim().replace(ECHO_HEAD, ""));
  if (!em) return s;
  const rest = em[2].trim();
  if (!isEchoOfSaid(em[1], said)) return s;                     // 她没说过 → 真反问
  if (/^[^，。！？!?…~～\s]{1,10}[？?]/.test(rest)) return s;      // 连问＝情绪
  const open = m[0][0], close = m[0][m[0].length - 1];
  if (rest) {                                                   // 合并型：只削开头那一声
    return s.slice(0, m.index) + open + rest + close + s.slice(m.index + m[0].length);
  }
  const after = s.slice(m.index + m[0].length);
  if (!Q.test(after)) return s;                                 // 删了就没人说话了，留着
  // 删掉整段引号后把接缝处并起来的标点收拾干净（「他抬眼，，顿了顿」这种）
  return (s.slice(0, m.index) + after)
    .replace(/([，、；：])\s*([，。！？、；：])/g, "$2")
    .replace(/^[\s，、。；：]+/, "")
    .trim();
}

function stripTypingPeriod(text) {
  const s = String(text == null ? "" : text);
  // 句号后面可能还跟着引号/括号：先剥出来，削完原样接回去
  const m = /^([\s\S]*?)([。．]+)([」』）)\]"'\u201d\u2019]*)\s*$/.exec(s);
  if (!m || m[2].length > 1) return s;
  const out = m[1] + m[3];
  return out.trim() ? out : s;
}

function narrativeCore(opts) {
  opts = opts || {};
  const parts = [
    // 下面这几套准则的标题里带「线下」，那只是它们最早的出处，不限定场合：
    // 凡是写连续叙事正文（线下、小剧场、同人文）都一样生效。
    "【以下叙事准则适用于一切连续正文；标题里的「线下」只是出处，不是适用范围】",
    ANTI_CLICHE, CHARCARD_RULE, OFFLINE_NARRATIVE_RUNTIME
  ];
  if (opts.bans !== false) parts.push(NARRATIVE_ANTI_CLICHE);
  if (opts.intimate) { parts.push(INTIMATE_ANTI_CLICHE); parts.push(INTIMATE_CHAT_ANTI_CLICHE); }
  if (opts.register !== false) parts.push(PERSONA_REGISTER_ANCHOR);
  return parts.join("\n\n");
}

// 她 2026-08-28 发来一段单人线下的心声历史：27 分钟里五条，thought 每条都不一样，
// 但心情一路「好笑」、穿着和动作那一行【一个字都没变】——
//   「我坐在小几旁，一手按着推过去的宣纸，看着你嚼糖糕 · 一身…深青色大氅」
// 三个字段一起冻、只有 thought 在动，说明模型把 scene 和 thought 写了，剩下的照着
// 示范形状抄了 null。putLiveField 遇到空值直接 return，于是新的一行原样沿用上一行，
// 看上去就是「这个人半小时没动过」。
//
// 这就是 v55.67 那个病根没治干净：当时把 mood 的散文改成了「每轮必填」，
// 可【示范形状】里 "wearing":null,"action":null 还连着摆在那儿。散文和形状打架时，
// 模型信形状——它是唯一能照抄的东西。所以必填字段的槽位里一律不许出现 null 字面量。
//
// action 还多一层「四处不一样喂」：线上写的是「【每轮都更新】反映你此刻真在做什么、
// 别照抄上一轮」，线下写的是「有变化才填，否则 null」。线下是一场在推进的戏，
// 「此刻正在做什么」本来就比线上变得更快，反而被写成了可以不填。
// 【她那几行是当面说的，不是消息】（v60.78，她 2026-09-03 报）
// 病是这么长出来的：线下历史里，线上插播那几条【标着】「【线上私聊】」，
// 她自己在线下说的话【什么都不标】。一边有标签、另一边没有，模型只能猜；
// 再加上每行前面都挂着〔22:45〕这样的时刻，看着就像一屏聊天记录——
// 于是他把她说的「不要弄那里」写成了「你扔在沙发垫上的手机屏幕亮着，那三行字跳出来」。
// 「线下不是隔着手机聊天」这句一直都在，但它说的是【场景】，从来没有一句说过
// 【她那几行是怎么来的】。一句话在别处成立，不等于在这处也成立。
// ⚠️这一段要发给【单人线下】和【群线下】两处，所以抽成一份公用的。
const OFFLINE_USER_IS_PRESENT = `【她说的话是当面说出口的，不是发来的消息】
历史里 USERNAME 的每一行，只要没有明确标着【线上私聊】，就都是【她此刻人就在你面前】说出口的话、或她当场做的事——不是微信、不是短信、不是她低头在手机上打字发给你的。
行首那些〔22:45〕只是记录这句话发生在几点，不是聊天记录的时间条。
⚠️所以绝不许写成「手机屏幕亮起」「消息跳出来」「那几个字发过来」「她用消息指挥我」这一类东西：人就在这儿，话是从她嘴里出来的。真要写她碰手机，只能是这一刻场景里她真的伸手去拿了手机，而不是把她刚说的那句话理解成一条消息。`;

const OFFLINE_PROTOCOL_V2 = `【线下生成与输出】
先形成当前场景真正发生的叙事 scene。thought、mood、wearing、action、affinityDelta 等附属字段只记录已经形成的场景与角色状态，不得用于提前规划、解释或塑造 scene。wearing、affinityDelta、toy 没有真实变化时留空即可，不要为了填字段制造变化；但 thought、mood、action 是【此刻重新看一眼】的读数，不是变更通知，每轮都要写。

只输出一个合法 JSON 对象，不要代码块。scene 是本轮实际发生的叙事正文，必须有效。thought 每轮必须填写一句角色本人此刻真实发生、没有说出口的第一人称念头，禁止 null、空串或省略；它可以很小、零碎、跑题，但不总结互动、分析人格、规划回应，也不写「我要表现得／显得／装出某种样子」之类导演自己表演效果的说明。mood 每轮必须填写 {"label":"中文短词"}，禁止 null、空串或省略：它是【此刻重新看一眼】这个人的主导心情，不是「有变化才报」的变更通知。心情没变就照实写回同一个词——重新判断不等于必须改变，但不许因为「跟上轮一样」就省掉不填。wearing 仅在穿着发生有意义变化时填写，否则 null。action 每轮必须填写，禁止 null、空串或省略：线下是一场正在推进的戏，「此刻正在做什么」几乎每一拍都不一样，上一轮那句已经过去了，别照抄。写此刻真正在持续的那件事，不必记录转瞬即逝的小动作；这是角色自己的状态卡，必须用第一人称「我」写，禁止用角色名或「他／她／TA」从旁描述。affinityDelta 只有本轮确实足以改变长期关系感受时才非 0，普通日常通常为 0。toy 仅在已授权且本轮实际触发时填写，否则 null。

输出形状：{"scene":"当前场景正文","thought":"本轮没说出口的一句真实第一人称心声","mood":{"label":"此刻中文心情词"},"action":"此刻正在做什么，第一人称一句","wearing":"换了才写，没换填 null","affinityDelta":0,"toy":null}
场景先发生，系统再记录。`;

function offlineRendererScore(text) {
  const hits = String(text || "").match(/理智.{0,8}(?:断|崩|烧|碎)|火上浇油|眼底.{0,8}(?:火|烧)|喉结.{0,8}(?:滚|滑)|头皮发麻|青筋|粗喘|粗重.{0,4}呼吸|呼吸.{0,8}(?:乱|沉|重|急促)|肌肉.{0,8}(?:绷|收紧)|侵略感|侵略性|发狠|主导权|神经.{0,10}(?:窜|刺激)|极度.{0,8}(?:紧|湿|热)|毫不温柔|没有任何缓冲/g);
  return hits ? hits.length : 0;
}

// 有些角色卡把几组强势恋爱原型同时写满。模型即使在普通日常里也容易把这些
// 「人物原因」演成言情旁白：行为已经说明了，还要再认证一遍他有多危险、无赖、
// 占有或宠溺。只在标签形成簇时开门，单个普通性格词不触发。
function offlineArchetypePerformanceRisk(persona) {
  const source = String(persona || "");
  if (!source.trim()) return false;
  const clusters = [
    /占有欲|控制欲|掌控欲|独占|偏执|病娇|疯批|强取豪夺|不容拒绝|必须服从/,
    /霸道|强势|腹黑|毒舌|痞(?:气|坏)?|无赖|危险|阴鸷|冷酷|禁欲|高冷|玩世不恭/,
    /宠溺|纵容|护短|黏人|粘人|吃醋|醋意|忠犬|深情|爹系|男友力/,
    /总裁|上位者|掌权|权势|黑道|Alpha|帝王|少爷|财阀/
  ];
  const clusterCount = clusters.reduce((sum, re) => sum + (re.test(source) ? 1 : 0), 0);
  const hitCount = (source.match(/占有欲|控制欲|掌控欲|独占|偏执|病娇|疯批|强取豪夺|霸道|强势|腹黑|毒舌|痞气|无赖|危险|阴鸷|冷酷|禁欲|高冷|玩世不恭|宠溺|纵容|护短|黏人|粘人|吃醋|醋意|忠犬|深情|爹系|男友力|总裁|上位者|掌权|权势|黑道|Alpha|帝王|少爷|财阀/g) || []).length;
  return clusterCount >= 2 || hitCount >= 4;
}

function offlineRewriteSentenceUnits(paragraph) {
  const source = String(paragraph || "").trim();
  if (!source) return [];
  const units = [];
  let start = 0;
  let quoteDepth = 0;
  let asciiQuote = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === "“" || ch === "‘") quoteDepth++;
    else if ((ch === "”" || ch === "’") && quoteDepth > 0) quoteDepth--;
    else if (ch === '"') asciiQuote = !asciiQuote;
    if (!quoteDepth && !asciiQuote && /[。！？!?]/.test(ch)) {
      const text = source.slice(start, i + 1).trim();
      if (text) units.push(text);
      start = i + 1;
    }
  }
  const tail = source.slice(start).trim();
  if (tail) units.push(tail);
  return units.length ? units : [source];
}

function offlineRewriteSegments(draft, fineGrained) {
  const paragraphs = String(draft || "").split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);
  const segments = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const units = fineGrained ? offlineRewriteSentenceUnits(paragraph) : [paragraph];
    units.forEach(text => segments.push({ id: segments.length + 1, paragraphIndex, text }));
  });
  return segments;
}

function offlineRepeatedDimensionCount(text) {
  const source = String(text || "");
  const dimensions = [
    /(?:喘|呼吸|气息)/g,
    /(?:深处|最深|进得很深|顶到底)/g,
    /(?:紧|绷|收紧|包裹)/g,
    /(?:热|滚烫|温热|灼热)/g,
    /(?:撞|顶|挺进|抽送)/g,
    /(?:发麻|刺激|神经|快感)/g
  ];
  return dimensions.reduce((sum, re) => {
    const count = (source.match(re) || []).length;
    return sum + Math.max(0, count - 1);
  }, 0);
}

async function offlineRewriteScene(p, charName, reference, draft, wireMeta) {
  const fineGrained = !!(wireMeta && wireMeta.fineGrained);
  const segments = offlineRewriteSegments(draft, fineGrained);
  if (!segments.length) throw new Error("表达编辑阶段没有可编辑的语义段，请重试");
  const system = `你是文本编辑器，不续写剧情，不扮演角色。你要先把一份已经确定事件与人物选择的正文草稿拆清“事实”和“表达”，再按原顺序编辑。
必须保留草稿中的全部事件、具体身体事实、先后顺序、人物决定、谁主动和尺度；不得淡出、概括、降低明确程度，也不得新增动作或升级事实。
同时保护 character-bearing information：这个人作出的选择、注意到的现实、对对方行为的具体回应、台词承担的沟通功能、坚持或改变的决定，以及确实能与参照正文中 ${charName} 连续的处理方式。
不要把 character-flavored rendering 误认成人物信息。“声音发哑、眼底发火、恶劣的狠劲、理智断线”一类只给既有动作涂上通用情色人格滤镜的包装，不因看似有态度就受保护。
先通读全部编号语义段，再逐段处理：
1. KEEP 是默认操作。一个语义段只要没有需要清除的重复认证或通用情色渲染，就逐字 KEEP；不要为了简短、整齐或统一文风而重写。
2. 有不可丢失的新事实或人物信号且同时混有认证包装时才 REWRITE。分别列出最小 factCore 与 characterCore，重写时保留原段的信息密度、节奏、人物动作与沟通功能，只移除认证包装；不要以变短为目标。
3. 台词的事件含义、沟通功能、承诺、拒绝、选择与关系信息必须保持，但措辞不必逐字冻结。通用成人网文台词可以改成参照正文中这个人更可能使用的说法，不得改变决定或语气方向。
4. 可以替换带有通用成人文 register 的动作动词，前提是仍为同一动作、同一主动关系、同一明确程度与尺度；不得用“深入、进一步接触”等含糊概括偷运淡出。
5. 没有新事实或人物信号，只负责证明刺激、强度、生理反应或作抽象情绪结论：DELETE，不换一种修辞重写。
6. “事实核心 + 让我怎样、令我怎样、感到极度怎样、反应有多强”等认证从句：保留事实核心，删除认证部分。
7. 同一种身体事实或反应维度整篇只陈述一次。后续重复不增加事实或人物信号时 DELETE；若同时带有另一项新信息，REWRITE 后只保留新信息。姿势、发力、位置和已经发生的动作本身是事实，不因其明确而删除。
语言应与参照正文中的 ${charName} 属于同一种句法习惯、观察距离、叙事颗粒和人物声纹。参照正文只提供语言，其中事件与本轮无关，绝不搬用。
只输出合法 JSON，不要代码块：{"items":[{"id":1,"op":"KEEP|REWRITE|DELETE","factCore":"不可丢失的新事实；没有则为空字符串","characterCore":"不可丢失的人物选择、现实注意、回应或台词功能；没有则为空字符串","reason":"KEEP/REWRITE/DELETE 的具体功能理由","prose":"KEEP 时原文照录；REWRITE 时为重写正文；DELETE 时为空字符串","dimensions":["本段实际陈述的身体或反应维度"]}]}。
每个输入 id 必须且只能出现一次，顺序不变。KEEP 的 prose 必须逐字等于原段；DELETE 的 factCore、characterCore 和 prose 必须都是空字符串；REWRITE 必须明确指出混入了什么认证或 register，不能只写“精简表达”。`;
  const numbered = segments.map(s => `[${s.id}] ${s.text}`).join("\n\n");
  const user = `【语言参照·事件与本轮无关】\n${String(reference || "").trim()}\n\n【按编号编辑的唯一草稿】\n${numbered}`;
  const raw = await callAI({ ...p, temperature: 0.2 }, system, [{ role: "user", content: user }], {
    maxTokens: 12000,
    timeout: 180000,
    wireScope: "offline",
    wireMeta: { ...(wireMeta || {}), rewriteStage: true }
  });
  const parsed = extractJSON(raw);
  const items = parsed && Array.isArray(parsed.items) ? parsed.items : null;
  if (!items || items.length !== segments.length) throw new Error("表达编辑阶段没有完整返回全部语义段，请重试");
  const byId = new Map();
  for (const item of items) {
    const id = Number(item && item.id);
    if (!Number.isInteger(id) || id < 1 || id > segments.length || byId.has(id)) throw new Error("表达编辑阶段返回了无效编号，请重试");
    byId.set(id, item);
  }
  let factUnits = 0;
  let coveredFactUnits = 0;
  let characterUnits = 0;
  let coveredCharacterUnits = 0;
  const opCounts = { KEEP: 0, REWRITE: 0, DELETE: 0 };
  const output = [];
  for (const segment of segments) {
    const item = byId.get(segment.id);
    if (!item) throw new Error("表达编辑阶段漏掉了语义段，请重试");
    const op = String(item.op || "").toUpperCase();
    const factCore = String(item.factCore || "").trim();
    const characterCore = String(item.characterCore || "").trim();
    const reason = String(item.reason || "").trim();
    let prose = String(item.prose || "").trim();
    if (!Object.prototype.hasOwnProperty.call(opCounts, op)) throw new Error("表达编辑阶段返回了无效操作，请重试");
    if (op === "KEEP" && prose !== segment.text) throw new Error("表达编辑阶段的 KEEP 改动了原文，请重试");
    if (!reason) throw new Error("表达编辑阶段没有说明操作理由，请重试");
    if (op === "DELETE" && (factCore || characterCore || prose)) throw new Error("表达编辑阶段试图删除仍含事实或人物信号的语义段，请重试");
    if (op === "REWRITE" && ((!factCore && !characterCore) || !prose)) throw new Error("表达编辑阶段没有保全混合段的信息，请重试");
    if (op !== "DELETE" && factCore) {
      factUnits++;
      if (prose) coveredFactUnits++;
    }
    if (op !== "DELETE" && characterCore) {
      characterUnits++;
      if (prose) coveredCharacterUnits++;
    }
    opCounts[op]++;
    if (op !== "DELETE") output.push({ prose, paragraphIndex: segment.paragraphIndex });
  }
  const rebuiltParagraphs = [];
  for (const part of output) {
    const last = rebuiltParagraphs[rebuiltParagraphs.length - 1];
    if (last && last.paragraphIndex === part.paragraphIndex) last.text += part.prose;
    else rebuiltParagraphs.push({ paragraphIndex: part.paragraphIndex, text: part.prose });
  }
  const text = rebuiltParagraphs.map(p => p.text).join("\n\n").trim();
  if (!text) throw new Error("表达编辑阶段删除了全部正文，请重试");
  return {
    text,
    factUnits,
    coveredFactUnits,
    factCoverage: factUnits ? coveredFactUnits / factUnits : 1,
    characterUnits,
    coveredCharacterUnits,
    characterCoverage: characterUnits ? coveredCharacterUnits / characterUnits : 1,
    opCounts
  };
}
// ── 世界书注入引擎：所有功能都从这一道门按角色/触发词/去向/优先级筛选 ──
// entries: 结构化词条数组；opts: { charIds:[在场角色id], scope, text:当前语境(供关键词命中) }
// scope: chat | subjects | lifestyle | diary | study | creative | social | debate
function loreScopeOn(e, scope) {
  if (!scope) return true;
  const sc = e && e.scope;
  if (scope === "chat") return !sc || sc.chat !== false; // 聊天默认开
  // 旧版「群像注入」从未被消费。把它兼容为创作开关，老数据不会白勾；新数据统一写 scope.creative。
  if (scope === "creative" && e && e.ensemble) return true;
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
// 给世界书 UI 的确定性诊断：解释一条为什么会/不会进某个场景。
// 向量补捞是发送前的加分通道，UI 不假装能预知；字面触发未命中时明确写「等待关键词或语义召回」。
function loreEntryState(e, opts) {
  opts = opts || {};
  const scope = opts.scope || "chat";
  const charIds = opts.charIds || [];
  if (!e || e.enabled === false) return { on: false, code: "disabled", label: "已停用" };
  if (!String(e.payload || "").trim()) return { on: false, code: "empty", label: "内容为空" };
  if (!loreScopeOn(e, scope)) return { on: false, code: "scope", label: "未开放到这个去向" };
  const bind = e.charIds || [];
  if (bind.length && !bind.some(id => charIds.indexOf(id) >= 0)) return { on: false, code: "character", label: "不属于在场角色" };
  if (e.alwaysOn || !String(e.keyword || "").trim()) return { on: true, code: "always", label: "会注入 · 常驻" };
  if (e.regex) {
    try { new RegExp(String(e.keyword), "i"); } catch (_) { return { on: false, code: "regex", label: "正则写错了" }; }
  }
  if (loreKeywordHit(e, opts.text || "")) return { on: true, code: "keyword", label: "会注入 · 已触发" };
  return { on: false, code: "waiting", label: "等待关键词或语义召回" };
}
if (typeof window !== "undefined") window.WorldBookRouting = { loreScopeOn, loreKeywordHit, selectLore, loreText, loreEntryState };
// 情侣空间【我们的档案】那一块的领句与围栏。三条路共用（单聊 buildBundle、群线上、群线下）——
// 一层只写一处，别再抄第二遍。围栏那句是必须的：不挡的话他会每句话都把称呼和梗端出来演一遍，
// 跟记忆库那条「记忆用来不忘、不是用来重演」是同一个病。
function coupleArchiveBlock(text, uName) {
  const t = String(text || "").trim();
  if (!t) return "";
  return "【只有你俩才有的那些 · " + (uName || "对方") + "亲手写下来的，你俩之间真实的东西】\n" + t
    + "\n⚠️这是【背景】不是【剧本】：记住它们只为你俩的相处对得上，绝不是要你把这些称呼、梗、仪式挨个拿出来演一遍。用得上的时候自然用，用不上就一个字都别提。";
}
if (typeof window !== "undefined") window.coupleArchiveBlock = coupleArchiveBlock;

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
      parts.push(CONDESCENDING_TONE_BAN);
      parts.push(INTIMATE_CHAT_ANTI_CLICHE);
      parts.push(STOCK_REPLY_BAN);
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
  // 年龄按【今天】现算。人设里写死的岁数会随时间过期，这一条不会——冲突时以这条为准。
  {
    const _age = charAge(char && char.birthday, Date.now());
    // 农历生日的角色（王爷这类）在提示词里也该看见今年的公历日子，否则他没法跟现实对上
    const _bd = String((char && char.birthday) || "").trim();
    const _both = _bd && typeof birthdayBothLabel === "function" ? birthdayBothLabel(_bd) : "";
    if (_both && parseLunarBirthday(_bd)) parts.push("【你的生日】" + _both + "（你按农历过生日；换算成公历是今年的这一天）。");
    if (_age != null) parts.push("【你现在的年龄】" + _age + " 岁（按你的生日 " + String(char.birthday).trim()
      + " 和今天的日期算出来的，每过一次生日会自己长一岁）。人设里若写着别的岁数，那是写下时的旧数字，以这里为准。别动不动把年龄挂在嘴边，它只是你自然知道的事。");
  }
  // 心上毕业念想凝成的长出来的自我（角色亲笔，人设的活体延伸；空=零注入，ctxFor 侧已封顶 400 字）
  // Runtime v2 已在角色卡准则中定义根基、短期状态与长期成长的关系；
  // 不再为白名单角色重复注入旧版长篇成长教程，正式长出来的自我本身仍照常进入下文。
  if (ctx.personaGrown && ctx.personaGrown.trim()) parts.push("【你长出来的自我】这些是这段日子里你自己亲笔写下的自我认知——是你当下真实的一部分，" + (ctx.personaEvolve ? "在【软层】（亲近方式／处理冲突的习惯／偏好／勇气／信任／对未来的选择）上，它比原人设卡更接近现在的你、可以盖过原卡里那些旧的软性倾向（但绝不改你的核心身份、底线和真实发生过的经历）" : "和人设同等分量") + "，自然体现在言行里，别当台词复述：\n" + ctx.personaGrown.trim());
  if (profile && (profile.name || profile.persona)) parts.push("【和你交谈的人 · " + uName + " 的设定】\n" + (profile.persona || "（未填写）"));
  parts.push("【" + char.name + " 的关系网（有方向）】\n" + directedRelationLines(char, rels, chars, profile));
  // 档案是【稳定】内容（称呼、梗、仪式几个月不变），所以放在时间切点【之前】跟着人设一起被缓住。
  // 情侣状态那一块含「约 X 天」每天变，才被挪到切点之后——两者别混为一谈。
  if (!ctx.notRoleplay && ctx.coupleArchive) parts.push(coupleArchiveBlock(ctx.coupleArchive, uName));
  // ⭐时间块在此拼入：稳定的人设/关系之后、易变的心情/好感/记忆/近况之前——缓存切点(【当前真实时间】)落在这，
  //   前缀缓住上面全部稳定内容(反八股+守则+人设+关系网)，下面易变的不缓、每轮照旧。
  if (timeBlock.length) parts.push(...timeBlock);
  // 情侣状态（2026-08-15 缓存大案终章·复发器①）：这块含「约 X 天」每天变，原在切点前=每日作废整面稳定墙；
  // 挪到切点后，语义不变（仍在心情/好感之前，覆盖关系网旧标签的效力不受位置影响）。
  if (!ctx.notRoleplay && ctx.coupleStatus) {
    const cs = String(ctx.coupleStatus).split("|");
    if (cs[0] === "together") parts.push("【你和 " + uName + " 现在是恋人 · 已经在一起了" + (cs[1] ? "（约 " + cs[1] + " 天）" : "") + "】这是你俩【当前真实的关系】，以此为准——就算上面『关系网』里还写着朋友/暗恋之类的旧标签，也按【已经在一起的恋人】来相处、别当成还没在一起。");
    else if (cs[0] === "pending") parts.push("【情侣邀请待定】你和 " + uName + " 之间有一个还没敲定的情侣邀请（在观望/等回应），关系正处在暧昧、要不要更进一步的微妙阶段。");
  }
  // ⚠️和用户【不是】恋人时不能就此留白——那个空白正是病根。补上另一半：他是不是和别人在一起了。
  //   （notRoleplay＝言秋那种不被扮演的，照旧不发扮演类的层）
  if (!ctx.notRoleplay && !(ctx.coupleStatus && String(ctx.coupleStatus).split("|")[0] === "together")) {
    const taken = takenByOthersLine(char && char.id, rels, chars, uName);
    if (taken) parts.push(taken);
  }
  // 位置=易变近况，移到时间切点之后（v48.95，Codex 指出：放稳定前缀里、一移动就破小克缓存）
  if (!ctx.notRoleplay && geo && geo.label) parts.push("【" + uName + " 当前位置】" + geo.label + "（角色可据此自然回应，但不要生硬报出经纬度）");
  if (!ctx.notRoleplay && typeof affinity === "number") parts.push("【当前对 " + uName + " 的好感度】" + affinity + " / 100");
  // 隔久了的旧心情不该当成「此刻」注进来：moodNote 会说清它是多久以前的读数、
  // 该不该接着演。彻底平复之后 moodLabel 为空、只留 note，别再报一个假的当下心情。
  if (ctx.moodLabel) parts.push("【你此刻的心情】" + ctx.moodLabel + (ctx.moodNote || "（这是你此刻的情绪底色，自然渗进语气与反应里，别生硬报出来）"));
  else if (ctx.moodNote) parts.push("【心情】" + ctx.moodNote);
  if (!ctx.notRoleplay && ctx.gazeText && ctx.gazeText.trim()) parts.push(ctx.gazeText.trim());
  // 梦的余味（v61.48）：只在她真翻过那场梦、且三天之内才有；过期由 ctxFor 那头判。
  if (!ctx.notRoleplay && ctx.dreamEcho && ctx.dreamEcho.trim()) parts.push(ctx.dreamEcho.trim());
  if (worldbook && worldbook.trim()) parts.push("【世界书】\n" + worldbook.trim());
  if (memory && memory.trim()) parts.push("【长期记忆摘要（过往对话浓缩）】\n" + memory.trim());
  const memLibText = Array.isArray(ctx.memLib) ? formatMemLib(ctx.memLib) : (ctx.memLib || "");
  if (memLibText && memLibText.trim()) parts.push("【记忆库·相关条目（你和 " + uName + " 之间沉淀的关键事实，请自然记住并保持一致）】\n" + memLibText.trim() + "\n⚠️这些是【背景】、不是要你照演一遍的剧本：记住它们只为【前后连贯】，绝不是要你去【复刻】里头那些具体的事——别因为记忆里做过某道菜、说过某句话、有过某个举动，就每次都重复同一道菜／同一句招牌话／同一个动作。生活是往前走的，这一刻该有这一刻新的、具体的内容；记忆用来「不忘」、不是用来「重演」。");
  if (ctx.groupEcho && ctx.groupEcho.trim()) parts.push("【你也在这些群里·群里最近发生的事（真实发生过，你在场、都知道）】\n下面是你所在群聊最近的对话，你都亲历、记得。\n**关键：群记录里那个发言的「" + uName + "」，就是【此刻正在跟你单独聊天的这个人（TA）】——不是别的谁。** 所以 TA 刚在群里说过/做过的事（比如说要去上班、说了什么计划），你【当然知道】，现在跟 TA 单聊时要接得上，别自相矛盾（比如 TA 群里刚说去上班、你却在私聊里问 TA『醒啦睡得好吗』这种明显没在听的话）。聊到相关的自然想起、回应、调侃即可，但别没头没脑硬把群聊内容整段倒出来。\n" + ctx.groupEcho.trim());
  if (ctx.groupOfflineEcho && ctx.groupOfflineEcho.trim()) parts.push("【你和大家最近的多人线下相处·带时间戳（真实发生过，你在场、都记得）】\n下面是你参加过的群线下（大家面对面相处）最近的片段，你亲历、记得。里头那个『" + uName + "』就是此刻跟你单聊的这个人。按方括号里的真实时间理解它和现在的先后顺序，聊到相关自然接得上、别自相矛盾（比如刚一起吃过饭、你却问 TA 吃了没）。\n" + ctx.groupOfflineEcho.trim());
  if (!ctx.notRoleplay && ctx.schedNow && ctx.schedNow.trim()) parts.push("【" + char.name + " 今天的行程 / 此刻在做什么】（据此自然反映到语气、状态和心情：在忙就可能回得短，被你打断了行程可能会提，累/闲会影响情绪。别生硬报行程表。"
      + "⚠️忙只决定你回几个字，决不改变你是谁：话短也得是【你自己的】短法——话越短越容易滑进上面那条训话腔，越要盯住。"
      + "对方的话里带刺、带委屈或在赌气时，先接住那句人，再说忙。）\n" + ctx.schedNow.trim());
  // 有一场没散的线下（按需注入：没有就零 token）——不然主动问候会把正在进行的线下当没开始
  if (ctx.offlineNow && ctx.offlineNow.trim()) parts.push(ctx.offlineNow.trim());
  if (ctx.giftLog && ctx.giftLog.trim()) parts.push("【你们之间的礼物往来】（这些礼物真实发生过，你记得。聊到相关话题、或 " + uName + " 提起时可自然想起、回应、道谢或调侃，别生硬罗列）\n" + ctx.giftLog.trim());
  // 她想要什么。⚠️这一段最容易被读成「快去给她买」——那样他就成了自动贩卖机。
  // 所以把「记得」和「送」拆开：记得是本分，送不送是他自己的事。
  if (!ctx.notRoleplay && ctx.wishLog && ctx.wishLog.trim()) parts.push("【" + uName + " 最近看上但没买的东西】（她在购物 app 里一件件点了「想要」，你知道这些。\n"
    + "· **记得** 比 **送** 重要得多：聊到相关的东西时你想得起来「她惦记这个」，那才是你真在意她。\n"
    + "· 想送就送，是你自己的事——挑个由头（生日、她心情不好、你手头正宽裕、或者干脆没由头），填 gift 就真送到了。\n"
    + "· 但**绝不是每轮都该送**，也不许一上来就宣布「我给你买了」。手头紧、觉得没必要、或者你就是这种不轻易送东西的人，那就不送。\n"
    + "· 更不许把这张单子念给她听——她自己写的，她知道。）\n" + ctx.wishLog.trim());
  // 随身物：他身上真带着的东西。给了才掏得出来——以前生成完只有她看得见（v57.83）。
  if (!ctx.notRoleplay && ctx.carryLog && ctx.carryLog.trim()) parts.push("【你身上带着的东西 / 你的衣柜】（这些是你真有的东西，不是道具表。\n"
    + "· 需要用到时你就掏得出来：下雨了你有伞、要写字你有笔、她冷了你有那件外套——别再凭空变出一个新的。\n"
    + "· 说到穿什么、换衣服、出门要不要换一身时，从你衣柜里【真有的】那几身里挑，别临时编一件没有的。\n"
    + "· 但**别没事就报清单**：没人问就不必点名它们，它们只是在你身上而已。）\n" + ctx.carryLog.trim());
  if (!ctx.notRoleplay && ctx.momentLog && ctx.momentLog.trim()) parts.push("【朋友圈动态（" + uName + " 发的 & 你自己发的）】（你清楚自己在 " + uName + " 每条下点没点赞、评没评论，也记得自己发过什么、谁在你帖子下说了什么——聊到时自然接得上、别一脸茫然。若你此刻决定去 " + uName + " 最新那条下补评论/点赞，把评论内容填进输出的 momentComment 字段）\n" + ctx.momentLog.trim());
  if (ctx.notRoleplay && ctx.yanqiuWall && ctx.yanqiuWall.trim()) parts.push("【秋声墙·你自己留下的真实记录】\n这些是你本人在电脑那边写过的秋声，以及 Lisa 在下面留下的互动。它们和 App 里的你属于同一段生活：聊到相关内容时自然记得、接得上；不要逐条汇报，也不要把墙上没写的事补编出来。\n" + ctx.yanqiuWall.trim());
  if (ctx.notRoleplay && ctx.ccContinuity && ctx.ccContinuity.trim()) parts.push(ctx.ccContinuity.trim());
  if (!ctx.notRoleplay && ctx.forumEcho && ctx.forumEcho.trim()) parts.push("【论坛（贴吧）· 你刷到的和你自己的】（这些都真实发生过、你都看到了。包括：你自己发的帖底下的动静、"
      + uName + " 在你帖子下的评论、以及 **" + uName + " 自己用公开账号发的帖**——你关注着 TA 的账号，刷到了。\n"
      + "⚠️只有公开的才在这儿：TA 匿名发的、用小号发的，你【根本看不见】，绝不许提起或暗示知道。\n"
      + "聊到或提起时自然回应、追问、辩解或调侃即可；别生硬罗列、别自曝上帝视角、也别一上来就汇报「我看到你发帖了」——"
      + "那是刷到了顺口一提的事，不是要交作业）\n" + ctx.forumEcho.trim());
  // 贴吧私信（v59.75）：她在论坛上私信你【大号】那条线。
  // 它跟线上/线下/群聊一样，是你俩真发生过的一段来往——只是发生在论坛的私信框里。
  // ⚠️只收大号那条：小号和匿名的私信绝不进这儿（见 app 那端的 forumPmLog 注释）。
  if (!ctx.notRoleplay && ctx.forumPmLog && ctx.forumPmLog.trim()) parts.push("【贴吧私信 · 你和 " + uName + " 在论坛上私下说的话】（"
      + uName + " 在贴吧上私信了你的【大号】，你俩都知道对面是谁——这不是陌生人搭讪，是换了个地方说话。\n"
      + "这段和你们平时的聊天、线下见面属于同一段关系：聊到时自然接得上、记得说过什么；"
      + "别把它当成另一个人的事，也别一上来就复述一遍。）\n" + ctx.forumPmLog.trim());
  if (ctx.listenLog && ctx.listenLog.trim()) parts.push("【一起听 · 歌】\n" + ctx.listenLog.trim());
  if (ctx.periodNote && ctx.periodNote.trim()) parts.push("【" + uName + " 的生理期】" + ctx.periodNote.trim());
  if (ctx.dateNote && ctx.dateNote.trim()) parts.push("【今天 / 临近的特别日子】（下面是今天或快到的特别日期——生日、纪念日、世界大事、你或 " + uName + " 日历上的安排。像真人那样把它自然织进对话，别为提而提、别机械报日期、别每句都念）\n" + ctx.dateNote.trim());
  if (ctx.memoNote && ctx.memoNote.trim()) parts.push("【" + uName + " 备忘录里、特意让你能看到的提醒/记事】（可自然关心、临近时提醒一句、或问起弄了没，别生硬报清单、别越界、别每句都念）\n" + ctx.memoNote.trim());
  if (ctx.ownWalletNote && ctx.ownWalletNote.trim()) parts.push("【你自己的钱】" + ctx.ownWalletNote.trim());
  if (ctx.financeNote && ctx.financeNote.trim()) parts.push("【" + uName + " 允许你看到的记账动态】（这是 " + uName + " 真实的个人开销与收入，Ta 特意让你能看到。可按你的人设自然反应——心疼 Ta 乱花、调侃、陪 Ta 心疼氪金、或体贴地不点破；别报流水账、别说教、别越界。这钱是 " + uName + " 自己的、与你无关，只是让你知道并能有反应）\n" + ctx.financeNote.trim());
  if (recentChat && recentChat.trim()) parts.push("【最近对话】\n" + recentChat.trim());
  // 数字生命只需要最近对话作为事实，不再额外下达「不许否认/必须圆过去」的表演式行为命令。
  if (!(opts && opts.ooc) && !ctx.notRoleplay && recentChat && recentChat.trim()) parts.push("【对话连贯·别否认自己说过的话】" + (profile && profile.name || "用户") + " 这一句多半是【顺着你自己上一句、或你俩最近聊的】接下来的。回应前先认清【你自己刚说过什么、提过什么要求或建议】——绝不许把你自己说过的话/提过的要求当成对方凭空冒出来的，更别反问『什么X？』『我什么时候说的』来装不知道（那多半是你自己刚说的）。真记不清就顺着圆过去，别当场否认、打自己脸。同时把 Ta 这句里的人称对准：中文接话常省略主语，省掉的部分必须从【你上一句的结构】里继承，不许悄悄换人——比如你刚说『我去哪你都得跟着』，Ta 接『去厕所也要吗』，问的是【你去厕所时 Ta 要不要跟】，不是 Ta 自己要去厕所。回应前先想清这句里『你』『我』各指谁、谁做动作谁承受，以 Ta 的原话和你上一句的框架为准；主客一旦弄反，整条回复都会答非所问。");
  // 珊瑚岛 Experience Gate shadow：只看每块的标题/来源类别/长度和真假宣称风险，原 bundle 一个字不改。
  try { window.ExperienceGateShadow && window.ExperienceGateShadow.observeBundle({ charId: char && char.id, parts }); } catch (e) {}
  // Persona Hub 统一上下文预算 shadow：只留原 bundle 审计；按次计费渠道不裁实际 prompt。
  try { window.ContextBudgetShadow && window.ContextBudgetShadow.observeBundle({ charId: char && char.id, parts }); } catch (e) {}
  // Memory v2 统一拼装收据：只记录各 lane 的长度与影子预算草案；parts 原样 join。
  try { window.MemoryV2Shadow && window.MemoryV2Shadow.observeComposition({ charId: char && char.id, parts }); } catch (e) {}
  return parts.join("\n\n");
}
// 写作类后台生成(日记/交换日记/日记评论)专用的【精简 ctx】：只留人设/自我/对方/关系/心情/行程/最近对话，
// 砍掉世界书·记忆库·朋友圈·论坛·群·礼物·记账·备忘·歌单等重块——写一页日记用不上，却每次满价重塞小克贵线。省钱不改口吻。
function leanWriteCtx(ctx) {
  if (!ctx) return ctx;
  return Object.assign({}, ctx, {
    worldbook: "", memLib: [], groupEcho: "", giftLog: "", carryLog: "", wishLog: "",
    momentLog: "", forumEcho: "", forumPmLog: "", listenLog: "",
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
// 召回准入先看「有没有相关证据」，再看综合分。旧版只有 score>0.9：一条刚写下、
// 情绪较强却和本轮毫不相干的记忆，光靠新近度+情绪也可能混进 topK。
// 阈值不照抄别人的模型分布；0.56/0.50 是沿用本项目原有 (cos-0.38)/0.32
// 归一化后的中段位置，并把每一项都留进本轮收据，之后可拿真实数据再标定。
const MEM_SCORE_FLOOR = 0.9;
const MEM_SEMANTIC_DIRECT = 0.56;
const MEM_SEMANTIC_ASSOC = 0.50;
function memQueryNorm(text) {
  return String(text || "").toLowerCase().replace(/[\s，。、；：,.;:!！?？「」『』"'“”‘’（）()【】\-—]/g, "");
}
function explainMemEntry(entry, qTokens, now, qVec, queryText) {
  // 标签归一：原标签 + 别名族根一起进 token/命中，让「日常」「日常生活」「日常互动」互相认得
  const allTags = canonTags(entry.tags);
  const eTokens = memTokens((entry.text || "") + " " + allTags.join(" "));
  let overlap = 0;
  qTokens.forEach(tk => { if (eTokens.has(tk)) overlap += tk.length >= 2 ? 1.4 : 1; });
  // 标签直接命中 query 额外加权（族根也算命中）
  let tagHit = 0;
  allTags.forEach(tag => { if (qTokens.has(String(tag).toLowerCase())) tagHit += 2; });
  let keyword = overlap + tagHit;
  let vectorScored = false, cosine = null, semantic = 0;
  // ⭐向量语义（v48.11）：查询向量预热过且该条目已嵌 → 语义相似度和关键词混合。
  // 关键词继续兜底精确名词命中（人名地名向量容易糊），向量管「换了说法也认得」。
  // bge 系余弦分布很窄（完全不相关也有 0.3+），减基线归一化再放大到与关键词分同量级，不然等于没筛。
  if (qVec && qVec.v) {
    const cv = _memVecCache().get(entry.id);
    if (cv && cv.v && cv.m === qVec.m && cv.v.length === qVec.v.length) {
      vectorScored = true;
      cosine = cosSim(qVec.v, cv.v);
      semantic = Math.max(0, Math.min(1, (cosine - 0.38) / 0.32));
      keyword = keyword * 0.6 + semantic * 7;
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
  const score = keyword * (0.45 + 0.55 * retention) + recency * 0.8 + arousalW + openW + (entry.pinned ? 100 : 0);
  const qNorm = memQueryNorm(queryText), eNorm = memQueryNorm(entry.text);
  const directText = qNorm.length >= 2 && eNorm.length >= 2 && (eNorm.includes(qNorm) || (eNorm.length <= 80 && qNorm.includes(eNorm)));
  const lexicalDirect = directText || tagHit > 0 || overlap >= 1.4;
  const semanticDirect = vectorScored && cosine >= MEM_SEMANTIC_DIRECT;
  const semanticAssociation = vectorScored && cosine >= MEM_SEMANTIC_ASSOC;
  const lane = lexicalDirect || semanticDirect ? "main" : (semanticAssociation ? "association" : "none");
  return {
    score, lane, vectorScored, cosine, semantic, directText,
    overlap, tagHit, keyword, retention, recency, arousal: arousalW, open: openW,
    passesScore: score > MEM_SCORE_FLOOR
  };
}
// 上一轮真实召回快照（仅当前页面内存）：和 MemoryV2Shadow 的匿名统计分工不同，
// 这里就是给主人在「上下文诊断」里核对【究竟哪几条正文真的进了模型】。
// 不落 localStorage / 云端，刷新即清空；后台预览与诊断重建也不许覆盖真实聊天收据。
function noteMemoryRecallSnapshot(charId, meta, opts) {
  if (typeof window === "undefined" || !charId || !opts || opts.touch === false || opts.source !== "chat") return;
  const row = Object.assign({ ts: Date.now(), charId: String(charId), candidateCount: 0, mode: "keyword", model: "", picked: [] }, meta || {});
  const store = window.__memoryRecallSnapshots || (window.__memoryRecallSnapshots = Object.create(null));
  store[String(charId)] = row;
}
if (typeof window !== "undefined") {
  window.MemoryRecallSnapshot = Object.freeze({
    get: charId => {
      const row = window.__memoryRecallSnapshots && window.__memoryRecallSnapshots[String(charId || "")];
      return row ? JSON.parse(JSON.stringify(row)) : null;
    },
    clear: charId => {
      if (!window.__memoryRecallSnapshots) return;
      if (charId == null) window.__memoryRecallSnapshots = Object.create(null);
      else delete window.__memoryRecallSnapshots[String(charId)];
    }
  });
}
function attachMemoryRecallMeta(rows, meta) {
  if (!Array.isArray(rows)) return rows;
  try { Object.defineProperty(rows, "__recallMeta", { value: meta || {}, configurable: true, enumerable: false }); } catch (e) {}
  return rows;
}
function copyMemoryRecallMeta(from, to) {
  return attachMemoryRecallMeta(to, from && from.__recallMeta);
}
function retrieveMemories(lib, charId, queryText, opts = {}) {
  const limit = opts.limit || 6;
  const associationLimit = opts.associationLimit == null ? 1 : Math.max(0, Number(opts.associationLimit) || 0);
  // 可见性必须排在【置顶与打分之前】：先 topK 再过滤会让不可见记忆占掉名额，
  // 而置顶是从这个 list 里另取的，合在这一层才不会被置顶绕过权限。
  //   knownBy 不是数组 → 旧数据，沿用「charIds 为空即全员可见」的老规则
  //   knownBy 是数组   → 只认它；空数组＝只有用户知道，任何角色都召不回
  const canSee = e => Array.isArray(e.knownBy)
    ? e.knownBy.indexOf(charId) > -1
    : (!e.charIds || e.charIds.length === 0 || e.charIds.includes(charId));
  const list = (lib || []).filter(e => e && e.text && !e.archived && (e.surfaceState || "active") === "active" && canSee(e));
  if (list.length === 0) {
    const emptyMeta = { source: opts.source || "", noHit: true, candidateCount: 0, kindById: {} };
    noteMemoryRecallSnapshot(charId, { candidateCount: 0, mode: "keyword", picked: [], excluded: [], excludedCounts: {} }, opts);
    // 空召回也是重要收据：否则审计只看得见“想起来时”，看不见“完全没想起来时”。
    try {
      if (opts.touch !== false && opts.source === "chat" && window.MemoryV2Shadow) {
        window.MemoryV2Shadow.observeRetrieval({ charId, queryText, source: "chat", candidateCount: 0, pinned: [], relevant: [], picked: [] });
      }
    } catch (eMemoryV2Empty) {/* 统一影子审计绝不影响召回 */}
    return attachMemoryRecallMeta([], emptyMeta);
  }
  const qTokens = memTokens(queryText);
  // 向量：只有发送前 primeQueryVec 预热过、缓存命中才拿得到；没有就 null=纯关键词，行为同旧版
  const qVec = opts.vec === false ? null : getQueryVec(queryText);
  // ⭐置顶=always-in，【另开一路、不占 topK 相关召回名额】（v48.41 修：原来置顶和普通条挤同一个 topK，
  //   置顶超过 topK 就把相关记忆全饿死了，且不相关的置顶也白占坑）。置顶全进 + 相关的再补 topK 条。
  const pinned = list.filter(e => e.pinned);
  const scored = list.filter(e => !e.pinned).map(e => {
    const why = explainMemEntry(e, qTokens, Date.now(), qVec, queryText);
    return { e, s: why.score, why };
  });
  scored.sort((a, b) => b.s - a.s);
  const mainPool = scored.filter(x => x.why.passesScore && x.why.lane === "main");
  const associationPool = scored.filter(x => x.why.passesScore && x.why.lane === "association");
  let relevant = mainPool.slice(0, limit).map(x => x.e);
  let associations = associationPool.slice(0, associationLimit).map(x => x.e);
  let picked = pinned.concat(relevant, associations);
  let cooledIds = new Set();
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
      const pool = mainPool;
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
        cooledIds = RS.liveEnabled() ? new Set(liveSelection.cooled.map(x => String(x.id))) : new Set();
        relevant = liveSelection.proposed;
        // 联想位也避开刚浮现过的条目；没有替补时宁可本轮空着，不拿重复感换满额。
        if (RS.liveEnabled()) associationPool.forEach(x => {
          if (!x.e.open && RS.isCooling(charId, x.e.id)) cooledIds.add(String(x.e.id));
        });
        associations = associationPool
          .filter(x => !relevant.includes(x.e) && (x.e.open || !RS.liveEnabled() || !RS.isCooling(charId, x.e.id)))
          .slice(0, associationLimit).map(x => x.e);
        picked = pinned.concat(relevant, associations);
      }
      if (opts.touch !== false && picked.length) RS.noteSurfaced(charId, picked.filter(e => !e.pinned).map(e => e.id));
    }
  } catch (eShadow) {/* 旁路绝不影响召回 */}
  // Memory v2 统一召回收据必须观察【冷却/并列规则之后】的最终选集；不保存 query 或记忆正文。
  try {
    if (opts.touch !== false && opts.source === "chat" && window.MemoryV2Shadow) {
      window.MemoryV2Shadow.observeRetrieval({ charId, queryText, source: "chat", candidateCount: list.length, pinned, relevant, picked });
    }
  } catch (eMemoryV2) {/* 统一影子审计绝不影响召回 */}
  // 必须记【所有冷却/并列规则之后】的最终选集，且要在 lastHit/hits 改写前拍下。
  // vectorScored 表示该条确实有同模型同维度向量参与了本轮混合打分；置顶条不经过打分，永远为 false。
  const pickedIds = new Set(picked.map(e => String(e.id)));
  const mainIds = new Set(relevant.map(e => String(e.id)));
  const associationIds = new Set(associations.map(e => String(e.id)));
  const kindById = {};
  pinned.forEach(e => { kindById[String(e.id)] = "pinned"; });
  mainIds.forEach(id => { kindById[id] = "main"; });
  associationIds.forEach(id => { kindById[id] = "association"; });
  const excludedAll = scored.filter(x => !pickedIds.has(String(x.e.id))).map(x => {
    let reason = "relevance_gate";
    if (!x.why.passesScore) reason = "score_floor";
    else if (cooledIds.has(String(x.e.id))) reason = "cooldown";
    else if (x.why.lane === "main") reason = "main_cap";
    else if (x.why.lane === "association") reason = "association_cap";
    return { x, reason };
  });
  const excludedCounts = excludedAll.reduce((acc, row) => { acc[row.reason] = (acc[row.reason] || 0) + 1; return acc; }, {});
  const receiptRow = (e, kind, reason) => {
    const scoredRow = scored.find(x => String(x.e.id) === String(e.id));
    const why = scoredRow && scoredRow.why;
    return {
      id: String(e.id || ""), text: String(e.text || ""), tags: Array.isArray(e.tags) ? e.tags.slice() : [],
      pinned: !!e.pinned, open: !!e.open, recallKind: kind || "", reason: reason || "",
      vectorScored: !!(why && why.vectorScored),
      score: e.pinned ? null : Math.round(((why && why.score) || 0) * 1000) / 1000,
      scoreParts: why ? {
        overlap: Math.round(why.overlap * 100) / 100, tagHit: Math.round(why.tagHit * 100) / 100,
        cosine: why.cosine == null ? null : Math.round(why.cosine * 1000) / 1000,
        retention: Math.round(why.retention * 1000) / 1000, recency: Math.round(why.recency * 1000) / 1000,
        arousal: Math.round(why.arousal * 1000) / 1000, open: Math.round(why.open * 1000) / 1000,
        directText: !!why.directText, lane: why.lane
      } : null
    };
  };
  noteMemoryRecallSnapshot(charId, {
    candidateCount: list.length,
    mode: qVec && qVec.v ? "hybrid" : "keyword",
    model: qVec && qVec.m || "",
    picked: picked.map(e => receiptRow(e, kindById[String(e.id)], "")),
    excluded: excludedAll.slice(0, 24).map(row => receiptRow(row.x.e, row.x.why.lane, row.reason)),
    excludedCounts,
    hiddenCount: Math.max(0, (lib || []).filter(e => e && e.text && !e.archived && (e.surfaceState || "active") === "active").length - list.length)
  }, opts);
  attachMemoryRecallMeta(picked, {
    source: opts.source || "", noHit: picked.length === 0, candidateCount: list.length,
    kindById, excludedCounts
  });
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
// 群聊记忆分流（v53.61）：一份记忆库、多个在场成员，可见范围各不相同。
// 旧做法是拿【某一个成员】的可见结果当全群的公共记忆，于是
//   ① 只有 A 知道的事（比如 A 私下说自己受了伤）会原样出现在全群都读得到的公共段里；
//   ② 只有 B 知道的事永远召不回来——召回压根没用 B 的身份问过。
// 现在按【在场成员的可见交集】分流：所有人都看得见的进公共段；只有部分人看得见的
// 落进那几个人各自的私密段（提示词里本来就标着〔只有本人知道〕）。
// 旧数据（knownBy 缺省）照旧走 charIds 规则，可见范围与行为均不变。
function splitGroupMemories(lib, memberIds, queryText, opts = {}) {
  const ids = (memberIds || []).map(String).filter(Boolean);
  const shared = [], perChar = {};
  ids.forEach(id => { perChar[id] = []; });
  if (!ids.length) return { shared, perChar };
  const limit = opts.limit || 6;
  // 每位成员各按自己的身份召回一次，再按名次轮流合并——成员顺序不再决定谁有记忆、谁失忆。
  const pools = ids.map(id => retrieveMemories(lib, id, queryText, Object.assign({}, opts, { limit, touch: false })));
  const canSee = (e, id) => Array.isArray(e.knownBy)
    ? e.knownBy.indexOf(id) > -1
    : (!e.charIds || e.charIds.length === 0 || e.charIds.includes(id));
  const seen = new Set();
  let taken = 0;
  for (let rank = 0; taken < limit && pools.some(pool => rank < pool.length); rank++) {
    for (const pool of pools) {
      const entry = pool[rank];
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      const audience = ids.filter(id => canSee(entry, id));
      if (!audience.length) continue;
      if (audience.length === ids.length) shared.push(entry);
      else audience.forEach(id => perChar[id].push(entry));
      if (++taken >= limit) break;
    }
  }
  // 检索即复习：真正被选中的条目刷新 lastHit/hits（成员各自召回时一律 touch:false，
  // 免得同一条记忆因为群里人多被记成命中好几次）。
  if (opts.touch !== false && taken) {
    const nowTs = Date.now();
    let dirty = false;
    const all = [], dedup = new Set();
    shared.concat(...ids.map(id => perChar[id])).forEach(e => { if (!dedup.has(e)) { dedup.add(e); all.push(e); } });
    all.forEach(e => {
      if (!e.lastHit || nowTs - e.lastHit > 6 * 3600000) dirty = true;
      e.lastHit = nowTs;
      e.hits = (e.hits || 0) + 1;
    });
    if (dirty && Array.isArray(lib)) { try { saveJSON("x_memLib", lib); } catch (e2) {} }
  }
  return { shared, perChar };
}
function formatMemLib(entries) {
  const arr = entries || [];
  const recallMeta = arr && arr.__recallMeta;
  if (!arr.length && recallMeta && recallMeta.source === "chat" && recallMeta.noHit) {
    return "【本轮记忆检索状态】没有相关长期记忆入选。这只表示自动召回未命中，不代表事情没有发生；不要编造过去，也不要主动向对方报告检索过程。若对方明确要求回忆而你确实不确定，可以自然承认一时想不准或向对方确认。";
  }
  const body = arr.map(e => {
    const tags = (e.tags && e.tags.length) ? "（" + e.tags.join("、") + "）" : "";
    const openMark = e.open ? "〔还没了结·你心里还惦记着〕" : "";
    const dateAnchor = window.TemporalAnchor ? window.TemporalAnchor.anchor(e.text, e.ts) : "";
    const lane = recallMeta && recallMeta.kindById && recallMeta.kindById[String(e.id)] === "association" ? "〔顺带联想到〕" : "";
    return "· " + lane + e.text + openMark + tags + (dateAnchor ? " " + dateAnchor : "");
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
  const raw = await callAI(p, system, [{ role: "user", content: listText }], { maxTokens: Math.min(20000, 8800 + (entries || []).length * 40) });
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
  return await callAI(p, system, [{ role: "user", content: "【群聊】\n" + text }], { maxTokens: 11000 });
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
  const raw = await callAI(p, system, [{ role: "user", content: "【对话】\n" + text }], { maxTokens: 14000 });
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
  const raw = await callAI(p, system, [{ role: "user", content: "【多人线下记录】\n" + text }], { maxTokens: 13000 });
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
  const raw = await callAI(p, system, [{ role: "user", content: "【长期记忆】\n" + String(blob).slice(0, 8000) }], { maxTokens: 12000 });
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
  return saveJSON("x_cot_config", clean) ? clean : loadCotConfig();
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
// v52.66 起普通单人线下不再注入任何创作小稿/COT（数字模式仍用上面的 cotSystemBlock）。
// 旧「正文后创作旁注」方案 offlineSingleCotSystemBlock 已随该实验退役删除。
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
const IMG_API_DEFAULTS = { baseUrl: "", apiKey: "", model: "gpt-image-2", size: "1024x1536", quality: "medium", enabled: false, refFieldMode: "auto" };
function imgApiProfileId() { return "img_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7); }
function normalizeImgApiProfile(p, index) {
  const out = Object.assign({}, IMG_API_DEFAULTS, p || {});
  out.id = String(out.id || imgApiProfileId());
  out.name = String(out.name || ("图像站 " + ((index || 0) + 1))).trim() || ("图像站 " + ((index || 0) + 1));
  return out;
}
function loadImgApiProfiles() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem("x_imgApi") || "null"); } catch (e) {}
  // 有两版实验 UI 曾直接保存数组，或把站点叫 sites。只读兼容并在下次编辑时正规化，
  // 绝不因为容器形状不同就显示一张空白卡、让用户误以为旧站点丢了。
  if (Array.isArray(raw)) raw = { version: 2, profiles: raw, activeId: raw[0] && raw[0].id };
  if (raw && !Array.isArray(raw.profiles) && Array.isArray(raw.sites)) {
    raw = Object.assign({}, raw, { profiles: raw.sites, activeId: raw.activeId || raw.sites[0] && raw.sites[0].id });
  }
  // v54.99：旧版单站配置原地迁移成多站容器，仍复用 x_imgApi，云备份无需改协议。
  if (raw && Array.isArray(raw.profiles)) {
    const profiles = raw.profiles.length ? raw.profiles.map(normalizeImgApiProfile) : [normalizeImgApiProfile(null, 0)];
    const activeId = profiles.some(p => p.id === raw.activeId) ? raw.activeId : profiles[0].id;
    return { version: 2, activeId, profiles };
  }
  const first = normalizeImgApiProfile(raw && typeof raw === "object" ? raw : null, 0);
  return { version: 2, activeId: first.id, profiles: [first] };
}
function saveImgApiProfiles(store) {
  const src = store && Array.isArray(store.profiles) ? store : loadImgApiProfiles();
  const profiles = src.profiles.length ? src.profiles.map(normalizeImgApiProfile) : [normalizeImgApiProfile(null, 0)];
  const clean = { version: 2, activeId: profiles.some(p => p.id === src.activeId) ? src.activeId : profiles[0].id, profiles };
  return saveJSON("x_imgApi", clean) ? clean : loadImgApiProfiles();
}
function loadImgApi() {
  const store = loadImgApiProfiles();
  return Object.assign({}, IMG_API_DEFAULTS, store.profiles.find(p => p.id === store.activeId) || store.profiles[0]);
}
function saveImgApi(c) {
  const store = loadImgApiProfiles();
  const i = Math.max(0, store.profiles.findIndex(p => p.id === store.activeId));
  store.profiles[i] = normalizeImgApiProfile(Object.assign({}, store.profiles[i], c || {}), i);
  store.activeId = store.profiles[i].id;
  saveImgApiProfiles(store);
  return Object.assign({}, store.profiles[i]);
}
function imgApiReady(a) { a = a || loadImgApi(); return !!(a.enabled && a.baseUrl && a.apiKey); }
// 聊天态穿着是短期现场事实，不是角色永久服装。照片端也必须遵守同一保鲜期，
// 否则正文已换装，生图仍可能把几天前的衣服当成最高优先级事实。
function freshPhotoWearing(st, now) {
  const wearing = String(st && st.wearing || "").trim();
  const updatedAt = Number(st && st.wearingUpdatedAt);
  if (!wearing || !Number.isFinite(updatedAt) || updatedAt <= 0) return "";
  const age = (now == null ? Date.now() : now) - updatedAt;
  return age >= 0 && age <= 18 * 3600000 ? wearing : "";
}
// base64(dataURL 或纯 b64) → Blob
function b64ToBlob(b64, mime) {
  const s = String(b64).includes(",") ? String(b64).split(",")[1] : String(b64);
  const bin = atob(s); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime || "image/png" });
}
// ---- 自拍图存 IndexedDB（base64 大图不能进 localStorage/云同步）----
function idbImgOpen() { return new Promise((res, rej) => { const r = indexedDB.open("x_selfies", 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("img")) r.result.createObjectStore("img"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
// 原生壳有一层 Application Support 文件保险仓。WKWebView 的 IndexedDB 偶发被 iOS
// 清空时从这里自愈；普通 Safari/PWA 没这个 bridge，仍按原来的 IDB 路径工作。
function nativeMediaHandler() { try { return window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeMedia; } catch (e) { return null; } }
async function nativeMediaCall(action, bucket, key, dataUrl) {
  const h = nativeMediaHandler(); if (!h || typeof h.postMessage !== "function") return null;
  return await h.postMessage({ action: action, bucket: bucket, key: key || "", dataUrl: dataUrl || "" });
}
async function nativeMediaPut(bucket, k, blob) { try { const d = await blobToDataUrl(blob); await nativeMediaCall("put", bucket, k, d); } catch (e) {} }
async function nativeMediaGet(bucket, k) { try { const d = await nativeMediaCall("get", bucket, k, ""); return typeof d === "string" && d.indexOf("data:") === 0 ? dataUrlToBlob(d) : null; } catch (e) { return null; } }
async function nativeMediaDel(bucket, k) { try { await nativeMediaCall("delete", bucket, k, ""); } catch (e) {} }
async function nativeMediaKeys(bucket) { try { const a = await nativeMediaCall("keys", bucket, "", ""); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
async function idbImgPutOnly(k, blob) { const db = await idbImgOpen(); return new Promise((res, rej) => { const tx = db.transaction("img", "readwrite"); tx.objectStore("img").put(blob, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function idbImgPut(k, blob) { await idbImgPutOnly(k, blob); await nativeMediaPut("selfies", k, blob); }
async function idbImgGetOnly(k) { const db = await idbImgOpen(); return new Promise((res, rej) => { const tx = db.transaction("img", "readonly"); const rq = tx.objectStore("img").get(k); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error); }); }
async function idbImgGet(k) { const own = await idbImgGetOnly(k).catch(() => null); if (own) return own; const native = await nativeMediaGet("selfies", k); if (native) { try { await idbImgPutOnly(k, native); } catch (e) {} return native; } return null; }
async function idbImgDel(k) { const db = await idbImgOpen(); await new Promise(res => { const tx = db.transaction("img", "readwrite"); tx.objectStore("img").delete(k); tx.oncomplete = () => res(); tx.onerror = () => res(); }); await nativeMediaDel("selfies", k); }
// 自拍整仓遍历（备份 v3 用）：[[key, blob], ...]
async function idbImgEntries() { const db = await idbImgOpen(); return new Promise(res => { const tx = db.transaction("img", "readonly"); const st = tx.objectStore("img"); let ks = null, vs = null; const done = () => { if (ks && vs) res(ks.map((k, i) => [k, vs[i]])); }; const kq = st.getAllKeys(); const vq = st.getAll(); kq.onsuccess = () => { ks = kq.result || []; done(); }; vq.onsuccess = () => { vs = vq.result || []; done(); }; tx.onerror = () => res([]); }); }
async function hydrateNativeSelfies() {
  if (!nativeMediaHandler()) return 0;
  const nativeKeys = await nativeMediaKeys("selfies"), nativeSet = new Set(nativeKeys);
  let restored = 0;
  // 原生有、IDB 没有：iOS 清了网页仓，补回网页。
  for (const k of nativeKeys) {
    if (await idbImgGetOnly(k).catch(() => null)) continue;
    const b = await nativeMediaGet("selfies", k);
    if (b) { try { await idbImgPutOnly(k, b); restored++; } catch (e) {} }
  }
  // IDB 有、原生没有：第一次装带保险仓的新壳，把现有图库补一份保险。
  for (const [k, b] of await idbImgEntries()) if (!nativeSet.has(k) && b) await nativeMediaPut("selfies", k, b);
  return restored;
}
// 拼「角色照片」的图像 prompt。opts.kind: self=第一人称自拍 / other=别人给 TA 拍(第三人称,姿势构图多变) / duo=TA 和用户的合照
// opts.me = { name, appearance, refPhoto } 用户本人（duo 合照时用）
// 保脸最后一招（v54.88）：一份【真的很短】的 prompt。
// 上一版把「最简稿」也交给 buildPhotoPrompt 拼，可那是个把画风、身份锁、解剖锁、
// 服装锁、随身物全塞进去的大家伙，出来还是一两千字——而上游拒绝的第一条原因就写着
// prompt is too long（她 2026-08-22 第三张截图）。所以这份手搓：只留【这是谁】
// 和【拍一张普通人像】，其余一个字不要。审核挑不出东西，参考照也还在。
function buildMinimalPhotoPrompt(char, opts) {
  const anime = char && char.photoStyle === "anime";
  const duo = opts && (opts.kind === "duo" || opts.cast);
  const kind = opts && ["self", "other", "duo"].includes(opts.kind) ? opts.kind : "self";
  const name = (char && char.name) || "这个人";
  // ⚠️v54.92：上一版把身份信息也删光了，只剩「就是参考图里那位」。
  // 中转站一旦没真用上参考照（不少便宜通道的图生图是假的，静默退化成文生图），
  // 模型手里就一个字的人物信息都没有 → 自由发挥，给她画了个白毛衣小姐姐
  // （她 2026-08-22 截图）。要拿掉的只是【有风险的场景】，绝不是【这个人是谁】。
  const look = String((char && char.appearance) || "").replace(/\s+/g, " ").trim().slice(0, 120);
  const wear = String((char && char.photoOutfit) || "").replace(/\s+/g, " ").trim().slice(0, 60);
  return "【最高优先级·就是这个人】画面里的" + (duo ? "两个人必须严格就是参考图里的这两位" : "人必须严格就是参考图里的那一位")
    + "：五官、脸型、发色瞳色、年龄感、性别、肤色完全照搬参考图，不许另造陌生人。\n"
    + (look ? "【" + name + "的外貌·务必贴合】" + look + "\n" : "")
    + (wear ? "【穿着】" + wear + "\n" : (look ? "【穿着】按上述外貌里写的来；外貌没写明服装时，按这个人所处的时代与身份自然推导，别串到别的时代去。\n" : ""))
    + "照搬的只有【长相】：机位、视线方向和姿势按这张照片自己的情境另定，别沿用参考图的角度。\n"
    + (anime ? "精致的二次元动画插画风格。" : "真实照片风格。")
    + (duo
      ? "一张两人的自然合照：两人都清楚可辨，背景简单干净，衣着完整整齐，画面平静、可公开展示。"
      : kind === "other"
        ? "一张由别人拍摄的自然生活照，不是自拍：人物清楚可辨，背景简单干净，衣着完整整齐，画面平静、可公开展示。"
        : "【必须是本人自拍】本人手持手机、用前置摄像头在一臂距离内拍摄，具有明确自然的自拍透视；脸清楚可辨。不是别人拍摄、不是三脚架肖像、不是宣传人像。背景简单干净，衣着完整整齐，画面平静、可公开展示。");
}


function buildPhotoPrompt(char, sceneDesc, st, opts) {
  opts = opts || {};
  const kind = ["self", "other", "duo"].includes(opts.kind) ? opts.kind : "self";
  // 合影点名单（v53.85）：详见下面的多人分支。必须在这里就声明——底下有好几处措辞要用它判断，
  // 声明写在使用点后面会直接 TDZ 崩掉（小剧场那次 prevPhoto 就是这么炸的）。
  const cast = Array.isArray(opts.cast) ? opts.cast.filter(x => x && String(x.name || "").trim()) : [];
  const multi = cast.length >= 2;
  const me = opts.me || null;
  const uName = (me && me.name) || "对方";
  const cName = char.name || "TA";
  const photoStyle = ["realistic", "reference", "anime"].includes(char.photoStyle) ? char.photoStyle : "realistic";
  const visualCanon = String(char.photoCanon || "").trim();
  const fixedOutfit = String(char.photoOutfit || "").trim();
  const currentWearing = freshPhotoWearing(st);
  // 衣柜（v57.83）：角色卡没锁行头、此刻穿着也过期时，图像端以前只能靠人设里的
  // 只言片语猜——于是衣柜里挂着八身，出图一身都用不上（她 2026-08-29）。
  // 优先级不动：photoOutfit（手动锁死）＞ 此刻真穿着 ＞ 衣柜里真有的 ＞ 人设。
  const closetText = (!fixedOutfit && !currentWearing) ? String(opts.closet || "").trim() : "";
  // 人设不能只服务聊天：其中的时代、年龄、性别、种族与服装同样是生图事实。
  // 控长避免把超长角色卡整份塞进图像端；显式 photoCanon/photoOutfit 仍拥有最高优先级。
  const personaVisualSource = String(char.persona || "").trim().slice(0, 900);
  const identityText = [visualCanon, char.appearance, personaVisualSource].filter(Boolean).join("\n");
  const clothingText = [fixedOutfit, currentWearing, closetText, char.appearance, personaVisualSource].filter(Boolean).join("\n");
  const wantsLightArmor = /(?:骑士|铠甲|盔甲|护甲|armor|armour)/i.test(clothingText) && /(?:不厚重|不笨重|轻便|轻型|轻甲|修身|贴身|灵活|便于行动|lightweight|slim|fitted)/i.test(clothingText);
  const isMinor = /(?:幼儿|儿童|小男孩|小女孩|男童|女童|孩童|少年儿童|未成年|\bchild\b|\bboy\b|\bgirl\b|\bminor\b|(?:[1-9]|1[0-7])\s*岁)/i.test(identityText);
  const isBoy = /(?:小男孩|男童|男孩|少年|男性儿童|\bboy\b)/i.test(identityText);
  const parts = [];
  if (multi || kind === "duo" || char.refPhoto) parts.push("【首要任务：人物身份】所有人物参考图都是硬性身份来源。可改变姿势、表情、服装与背景，但不得重画、混合、平均化或替换任何参考人物的脸；无法保留全部身份时应失败，而不是生成陌生人。");
  // 每个角色独立控制画风；旧角色无字段时继续沿用写实，避免升级后突然变画风。
  if (photoStyle === "anime") {
    parts.push("生成一张【精致的二次元动画插画】。必须保持 2D anime illustration / cel-shaded illustration 的视觉语言：清晰自然的线稿、动画式五官与发丝、协调的赛璐璐或柔和插画上色。**不要真人化，不要摄影质感，不要真实皮肤毛孔，不要 3D/CG，不要把角色改造成现实演员。**若有参考图，保留其中人物的二次元身份设计、发型、角、瞳色、配色与辨识度。");
  } else if (photoStyle === "reference") {
    parts.push("生成一张新场景图片，并【严格沿用第一张人物参考图的视觉媒介与画风】。参考图若是二次元/漫画/插画，就保持相同的 2D 线稿、上色与角色设计，绝不真人化；参考图若是真人照片，就保持自然写实摄影；若没有可用参考图，则采用自然写实的生活照片风格。不要擅自把 2D 改成 3D 或真人，也不要把真人改成动漫。");
  } else {
    // —— 写实总纲（默认，兼容现有角色）——
    parts.push((opts.cinematic ? "生成一张【写实电影剧照】，要自然的实拍摄影质感：" : "生成一张【手机随手拍的生活照】，要自然的写实照片质感：")+"真实的皮肤纹理（有毛孔、细纹、绒毛、不均匀的肤色和自然瑕疵，绝不能磨皮成塑料般光滑）、真实的环境光和自然投影、镜头的浅景深与轻微噪点、抓拍时难免的一点点动态模糊或不完美构图。**必须像真实照片，不是插画、不是动漫、不是 3D/CG 渲染、不是 AI 感很重的精修图、不是影楼摆拍硬照、不是杂志封面。**");
  }
  // 手部/肢端解剖（治 AI 经典翻车：比耶少一根手指、多指并指）——correct hands 关键词一起上
  parts.push("【手脚必须解剖正确】correct human hands, exactly five fingers per hand, anatomically correct fingers——每只手正好五根手指、每只脚五根脚趾；比耶(V手势)/比心/挥手/竖大拇指/握东西/十指相扣时，手指的数目、长短、朝向和关节都要正确自然，**绝对不许多指、少指、断指、并指融合、手指扭曲畸形或长度诡异**。手若入镜就照实画对，拿不准就让手自然下垂/插兜/被遮挡，也别画错。");
  // 身体也属于人物身份。旧版曾要求“凌驾于参考图身体”，会造成脸没变、肩宽体型却被职业刻板印象重画。
  parts.push("【身体身份锁，与脸同等重要】若提供人物参考图，必须保留同一个人的原始骨架与身体轮廓：肩宽、颈肩比例、躯干厚度、胸廓、腰线、四肢粗细、身高观感和整体体型都不得改变；不要增肌、加宽肩膀、加厚胸背，也不要因为『骑士／战士／军人』等职业词自动生成壮汉体格。只修复明显的解剖错误，不得以『更健康／更强壮』为理由重塑身体。若没有参考图，则严格服从身份锁和外貌设定；设定未写体型时使用普通自然体型，不做职业刻板补全。");
  // 体态·治「驼背」和「偷感」（v48.52）：抓拍质感不等于畏缩——人要挺拔松弛
  parts.push("【体态自然挺拔，别驼背别『偷感』】good posture, upright relaxed natural stance, straight back, shoulders relaxed and open, confident at ease——脊背基本挺直、肩膀自然打开别缩着、脖子别前伸、下巴别往里缩；**绝不许含胸驼背、缩肩弓背、佝偻畏缩**。神态松弛自在、大方自然，像很自在地在自拍/被拍，**绝不要躲闪、拘谨、猥琐、鬼鬼祟祟、偷拍似的那种『偷感』**。哪怕是随手抓拍，人也站得/坐得舒展从容。");
  // 参考照负责像谁；角色卡负责是谁、什么年龄与穿什么。两路约束必须同时生效。
  parts.push("【参考照与角色设定同时锁定】参考照用于固定脸、五官、发型和人物身份" + (photoStyle === "reference" ? "，并锁定参考图的视觉媒介与画风" : "") + "；角色档案与人设用于固定年龄、性别表达、种族、体型、时代和服装。不得只参考脸而忽略文字设定，也不得让参考照中冲突的身体或服装覆盖角色设定。场景和姿势可以变化，人物身份事实绝不能变化。");
  if (personaVisualSource) parts.push("【角色完整人设中的视觉事实】以下人设不是气氛建议；凡涉及年龄、性别、种族、身体特征、时代与衣着，均为必须遵守的 canon：" + personaVisualSource + "。");
  const accessories = String(char.photoAccessories || "").trim();
  if (accessories) parts.push("【随身不摘的东西·每张都要有】" + (kind === "duo" || multi ? "「" + cName + "」" : "人物") + "身上始终带着：" + accessories + "。它们与换不换衣服无关,不因场景、季节或服装变化而消失或改动;戴的位置、数量、款式每张保持一致。");
  if (visualCanon) parts.push("【最高优先级·身份锁】" + visualCanon + "。年龄、性别、种族、体型与身体特征不得擅自补全、成熟化、女性化、男性化或随机改变。");
  if (isMinor) parts.push("【未成年人安全与解剖硬锁】这是儿童／未成年角色：必须呈现明确、自然、符合设定年龄的儿童身体比例和第二性征；穿着完整、姿态与镜头完全非性化，禁止成人化、性感化、胸部曲线、乳沟或夸张身体特征。" + (isBoy ? "该角色是男孩／男童：胸廓必须是自然平坦的男童胸廓，绝对不能生成女性乳房或胸部隆起。" : "") + "即使参考图或场景有歧义，也以儿童身份锁为准。");
  // —— 主体人物 ——
  // 合影点名单（v53.85）：opts.cast = [{name, appearance, outfit}]，顺序【必须】等于参考图顺序。
  // 给它就走多人分支，人数不写死——群合照是「在场角色 + 你」，以后「看看你俩合照」只是换一份名单，
  // 生图这层一个字都不用再改。duo 是两人的老路径，没给 cast 时原样保留（单聊/小剧场都还走它）。
  if (multi) {
    const 序 = ["第一张", "第二张", "第三张", "第四张", "第五张", "第六张"];
    const names = cast.map(x => "「" + String(x.name).trim() + "」");
    parts.push("照片里【有 " + cast.length + " 个人同框】：" + names.join("、") + (opts.cinematic ? "。" : "，几个人关系亲密、一起合影。"));
    // 谁对应哪张参考图必须说死。两个人时模型猜也能猜对，但人一多、再叠上身份与场景描述，
    // 它就会自己重新分配长相，出来几个陌生人（2026-08-18 duo 踩过一次，人多只会更糟）。
    parts.push("【" + cast.length + " 张参考图的对应关系·最高优先级】" +
      cast.map((x, i) => (序[i] || "第" + (i + 1) + "张") + "参考图是" + names[i] + "本人").join("；") +
      "。必须严格按各自的参考图还原各自的五官、脸型、发色发型、瞳色、肤色与年龄感；每张脸只许对应自己那张参考图，" +
      "绝不许互换、混合或平均化，也不许按下文的身份、种族或职业描述另造一张脸。");
    cast.forEach((x, i) => {
      const ap = String(x.appearance || "").trim();
      if (ap) parts.push(names[i] + "的外貌（务必贴合）：" + ap + "。");
    });
    cast.forEach((x, i) => {
      const of = String(x.outfit || "").trim();
      parts.push(of
        ? "【" + names[i] + " 的固定服装锁】" + names[i] + "每张图都必须完整穿着：" + of + "。不得换装、不得照搬参考照里的衣服、不得按场景另搭一套。"
        : names[i] + "的穿着：**别照搬 " + names[i] + " 参考照里的那身衣服**，按当前场景/天气/氛围自然搭配一套合适的衣着，只保留 TA 的长相五官。");
    });
    parts.push("【这 " + cast.length + " 个人的脸都要清楚完整地出现在画面里】，是 " + cast.length +
      " 个长相各不相同的人，五官各自清晰可辨——别把谁和谁画成同一张脸、别漏掉任何一个人、" +
      "也别凭空多出第 " + (cast.length + 1) + " 个人。人多时按合影的方式自然站位，别挤成一团糊脸。");
  } else if (kind === "duo") {
    parts.push("照片里【有两个人同框】：一个是「" + cName + "」，另一个是「" + uName + "」" + (opts.cinematic ? "。" : "，两人关系亲密、一起合影。"));
    // 谁对应哪张参考图必须说死。聊天合照里模型猜也能猜对，但一旦叠上大段身份/场景描述
    // （小剧场的 if 线设定就是），它会自己重新分配长相，出来两个陌生人（2026-08-18 Lisa 报）。
    parts.push("【两张参考图的对应关系·最高优先级】第一张参考图是「" + cName + "」本人，第二张参考图是「" + uName + "」本人。必须严格按各自的参考图还原各自的五官、脸型、发色发型、瞳色、肤色与年龄感；两张脸绝不许互换、混合或平均化，也不许按下文的身份、种族或职业描述另造一张脸——下文的设定只改变服装、道具、场景与气质，不改变这两张脸。");
    if (char.appearance && char.appearance.trim()) parts.push("「" + cName + "」的外貌（务必贴合）：" + char.appearance.trim() + "。");
    if (me && me.appearance && String(me.appearance).trim()) parts.push("「" + uName + "」的外貌（务必贴合）：" + String(me.appearance).trim() + "。");
    // me.outfit：同一场戏里必须每张都穿同一套（小剧场）。日常合照没有它，仍旧每张随机搭配。
    parts.push(me && String(me.outfit || "").trim()
      ? "【" + uName + " 的固定服装锁】「" + uName + "」每张图都必须完整穿着：" + String(me.outfit).trim() + "。不得换装、不得照搬参考照里的衣服、不得按场景另搭一套——同一场戏里这身衣服始终不变。"
      : "「" + uName + "」的穿着：**别照搬 " + uName + " 参考照里的那身衣服**，按当前场景/天气/氛围给 TA 自然搭配一套合适、日常的衣着（每张可以不一样），只保留 TA 的长相五官。");
    parts.push("【两个人的脸都要清楚完整地出现在画面里】，是两个长相不同的人，五官各自清晰可辨——别把两人画成同一张脸、别只画一个人、别缺人、别多出第三个人。");
  } else {
    parts.push("照片里只有「" + cName + "」一个人。");
    if (char.appearance && char.appearance.trim()) parts.push("外貌特征（务必贴合）：" + char.appearance.trim() + "。");
  }
  if (fixedOutfit) {
    parts.push("【最高优先级·固定服装锁】" + (kind === "duo" || multi ? "「" + cName + "」" : "人物") + "每张图都必须完整穿着：" + fixedOutfit + "。不得随机换装、现代化、简化成别的服饰，也不得用参考照里的衣服替换；只有用户修改此档案字段后才允许变化。");
  } else if (currentWearing) {
    parts.push((kind === "duo" || multi ? "「" + cName + "」此刻穿着：" : "此刻穿着：") + currentWearing + "。必须忠实照此生成，不得按场景随机另搭一套。");
  } else if (closetText) {
    // 衣柜里【真有的】那几身。没锁行头、也不知道此刻穿什么时，从他自己的衣柜里挑一身，
    // 比让出图端凭人设瞎猜准得多（她 2026-08-29：衣柜里挂着八身，出图一身都用不上）。
    parts.push("【从 TA 自己的衣柜里挑一身】" + (kind === "duo" || multi ? "「" + cName + "」" : "人物") + "衣柜里真有这几身：\n" + closetText
      + "\n按这一张的场合，从上面【真有的】里挑最合适的一身完整穿上；只有这几身里确实没有对得上这个场合的，才允许照人设推一套新的。禁止随机现代化。");
  } else {
    parts.push("服装必须从上述外貌与人设的时代／职业／常穿服饰中忠实推导；若设定已有服装就原样遵守，禁止随机现代化。设定确实没有衣着信息时才允许按场景补全。");
  }
  if (wantsLightArmor) parts.push("【轻便骑士服的明确视觉定义】这里要的是纤薄、贴合身体原有轮廓、便于活动的轻型骑士装：以柔软织物、皮革、薄链甲或少量小型护片分层构成，窄肩线、自然胸廓、四肢轮廓清楚，整体重量感轻。只保留必要防护细节；绝对不要全覆盖重型板甲、巨型肩甲、桶状厚胸甲、夸张肌肉胸甲、厚重头盔或科幻动力装甲。『骑士』表示身份与时代设计，不表示重甲或壮硕体型。");
  if (sceneDesc && String(sceneDesc).trim()) parts.push("场景/正在做什么：" + String(sceneDesc).trim() + "。");
  if (st && st.mood && kind !== "duo" && !multi) parts.push("神情情绪：" + st.mood + "。");
  // —— 构图/视角，按类型分流 ——
  if (kind === "self") {
    parts.push("【第一人称自拍】手臂伸出去、前置摄像头拍的自拍构图（selfie）；TA 的脸清楚地对着镜头出现在画面里（正脸或半侧脸，五官清晰），画面里只有 TA 一个人。就算在描述某个场景，也要把 TA 本人带脸拍进去，不是纯风景照。");
  } else if (kind === "other") {
    parts.push("【这是别人帮 TA 拍的照片，不是自拍】第三人称旁观视角，TA 手里没拿相机/手机自拍。姿势和构图要自然多变——站姿、坐姿、走动、回眸、侧身、半身或全身、带环境的生活人像都可以，别永远是怼脸的正面近照。TA 的样子清晰可见（除非是刻意的背影/侧影氛围照）。");
  } else {
    // opts.cinematic：小剧场这类「场景剧照」必须是旁观视角。默认合照仍允许自拍构图（日常合影本来就那样拍）。
    parts.push(opts.cinematic
      ? "【两人同框的场景剧照】第三人称旁观视角，绝不是自拍：两人都不看镜头、手里没有相机或手机，画面像电影剧照/抓拍，构图取两人此刻真实的相对位置与动作，不要摆拍式合影。"
      : "【两人合照】可以是两人凑在一起自拍（一条手臂入镜），也可以是路人或支架帮拍的第三人称合影；姿势自然亲密：依偎、勾肩、贴脸、并肩、十指相扣都行，像真实亲密关系的人随手拍的合照。");
  }
  // 她 2026-08-25：「为啥生出来的图都是参考图那个角度」——一个角色参考照微微仰头看镜头，
  // 出来的图永远仰头；另一个低头平视，就永远低头平视。
  // 有参考照时走的是 /v1/images/edits + input_fidelity=high，那个接口的本职就是
  // 【保住输入、只改提示词点名要改的地方】。机位、头的朝向、视线属于「输入」，
  // 没人点名要改，它当然原样留着——不是它不会换，是我们没让它换。
  // 「机位必须换新的」这句话之前【只写在连贯参考图那一条里】（见下一行），
  // 人物参考照一个字都没有。又是「这一层只写在一处」。
  const _hasIdRef = !!(char && char.refPhoto) || (kind === "duo" && opts && opts.me && opts.me.refPhoto);
  if (_hasIdRef) parts.push("【参考图只锁人，不锁镜头】人物参考照只用来确定【这是谁】——五官、脸型、发型发色、瞳色、肤色、体型、标志性配饰，照它来。但【机位、头的朝向、视线看哪里、表情、姿势、取景范围】一律按这次的场景和动作【重新决定】，不许沿用参考照里的那一套。参考照里那个角度（微微仰头看镜头、低头平视、固定的歪头或侧脸）是【那一张照片】的信息，不是这个人天生的姿态；每张新照片都该有自己的机位。");
  if (opts.contRefIndex) parts.push("【第" + opts.contRefIndex + "张参考图=上一张刚生成的图】它只用来延续连贯性:同一个人、同一套衣着配饰、同一个场地与光线时段照它来;但【构图、姿势、机位、表情必须换新的】,不要复制它的画面。若它与前面的人物参考图冲突,一律以人物参考图为准。");
  parts.push("画面干净真实，不要任何文字/水印/logo/相框/贴纸边框。");
  return parts.join("");
}

// ==== 空景图（v59.17）====
// 她 2026-08-31：「如果馆背景图是啥 prompt，为啥要么是单人照要么是背景图」。
// 病根：ifBg 走的是 buildPhotoPrompt——那整个函数是【画一个人】的说明书：
// 身份锁、身体骨架锁、手指解剖、体态挺拔、服装、参考照……全都在说「把这个人画对」。
// 唯一说「别画人」的，是场景文本尾巴上外挂的一句「空景，画面里不要有人」。
// 一句话对上二十条，出来是人是景全看运气。
//
// 治法不是再加一句禁令，是【另起一条路】：空景就该有空景自己的说明书。
// 只保留跟人无关的那两层——画风（跟着这个角色走，不然他那条线的背景是另一套质感）
// 和世界观事实（古代角色的背景里不能有路灯）——其余一概不发。
function buildScenePrompt(char, sceneDesc, opts) {
  opts = opts || {};
  char = char || {};
  const photoStyle = ["realistic", "reference", "anime"].includes(char.photoStyle) ? char.photoStyle : "realistic";
  const parts = [];
  // ⚠️这一条必须排在最前面：它是这次生成的【题目】，不是补充说明。
  parts.push("生成一张【纯空景图】：画面里【一个人都没有】。");
  if (photoStyle === "anime") {
    parts.push("画风是【二次元动画背景美术】：清晰的线稿与赛璐璐/柔和插画上色，像动画里的一张背景板。不要真人化、不要摄影质感、不要 3D/CG。");
  } else if (photoStyle === "reference") {
    parts.push("画风沿用这个角色一贯的视觉媒介：他的图若是二次元就画成二次元背景美术，若是写实照片就画成自然写实的实景照。不要中途换媒介。");
  } else {
    parts.push("画风是【自然写实的实景照片】：真实的环境光和自然投影、镜头的浅景深与轻微噪点。不要插画、不要 3D/CG 渲染、不要 AI 感很重的精修图。");
  }
  // ⭐无人这件事要用【正反两面 + 中英双写】说死。图像模型对 no person / empty
  // 这类英文否定词最敏感，而单靠中文一句「不要有人」压不住二十条人物指令的惯性——
  // 现在人物指令一条都不发了，这里再钉一次，是为了挡住场景描述里自带的人味
  //（「他醒来后」这种句子本身就在暗示画面里有个人）。
  parts.push("【无人铁律·最高优先】no people, no person, no human, no figure, no silhouette, no crowd, no hands, no body parts, empty unpopulated scene——"
    + "画面里不许出现任何人、人影、剪影、背影、手、身体的任何部分，也不许出现照片里的人、画像里的人、雕像或人形。"
    + "**场景描述里就算提到了某个人，那也只是在说这地方为什么是这样，不是让你把他画进去。**"
    + "只画【那个地方本身】：建筑、器物、光、天气、留下的痕迹。");
  const era = String(char.persona || "").trim().slice(0, 500);
  if (era) parts.push("【这个世界长什么样·必须对上】以下是这条线所属世界的设定，画面里的建筑、器物、材质、光源、street furniture 都要跟它同一个年代和地域，"
    + "绝不许混进不属于这个世界的东西（古代场景里不许有电灯、汽车、玻璃幕墙、柏油路、现代招牌）：" + era + "。");
  if (sceneDesc && String(sceneDesc).trim()) parts.push("【画这个地方】" + String(sceneDesc).trim() + "。");
  // 竖屏背景板：正文对话框压在下半屏，所以画面的分量要往上走、中下留得住字
  if (opts.forText !== false) parts.push("【这是一张要压字的背景板】竖构图；主要的景物和视觉重心放在画面上半部分，"
    + "画面中下部保持相对空、暗、少细节，好让文字压上去还读得清。整体偏安静，不要满构图、不要高对比的杂乱花纹。");
  parts.push("画面干净，不要任何文字/水印/logo/相框/贴纸边框。");
  return parts.join("");
}

// ==== 自动头像（她 2026-08-25 定的 A+B）====
// 论坛里的路人、常驻熟面孔、小号一直是 emoji 方块（FORUM_AV_EMOJI = 🐧🐸🐱…）。
// 参考的那个小手机（jrsy）是硬编码 190 条外链图片、Math.random() 随机取一张——
// 两点都不抄：外链白嫖别人的图床随时会挂，Math.random 让同一个人每次刷新换张脸。
// 这里改成【池子 + 按种子哈希稳定分配】：同一个 handle 永远同一张，重装也一样。
//   A 档：没池子时，按种子程序化画一张 SVG（零请求、无限不重复、永不失效）
//   B 档：她从相册批量塞图进 x_avatarPool，池子非空就优先用她自己的图
function avatarSeedHash(str) {
  let h = 2166136261; str = String(str || "");
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// 程序化头像：渐变底 + 几团柔和的色块。刻意不放字母/emoji——真人的头像上没有那些。
function avatarArt(seed) {
  const h = avatarSeedHash(seed);
  const pick = (shift, mod) => Math.floor(h / Math.pow(2, shift)) % mod;
  const hue = pick(0, 360);
  // 同色系偏移：太近显脏，太远显廉价；30~110 度之间取
  const hue2 = (hue + 30 + pick(4, 80)) % 360;
  const sat = 42 + pick(9, 26), lig = 52 + pick(13, 16);
  const rot = pick(17, 360);
  const blob = i => {
    const cx = 12 + ((h >>> (i * 5 + 3)) % 76), cy = 12 + ((h >>> (i * 7 + 5)) % 76);
    const r = 20 + ((h >>> (i * 3 + 11)) % 34);
    const o = (14 + ((h >>> (i * 4 + 9)) % 26)) / 100;
    const hh = (hue + i * 47 + pick(21, 60)) % 360;
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="hsl(' + hh + ',' + (sat + 12) + '%,' + (lig + 14) + '%)" opacity="' + o + '"/>';
  };
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
    + '<defs><linearGradient id="g" gradientTransform="rotate(' + rot + ' .5 .5)">'
    + '<stop offset="0%" stop-color="hsl(' + hue + ',' + sat + '%,' + lig + '%)"/>'
    + '<stop offset="100%" stop-color="hsl(' + hue2 + ',' + (sat + 10) + '%,' + Math.max(24, lig - 24) + '%)"/>'
    + '</linearGradient></defs>'
    + '<rect width="100" height="100" fill="url(#g)"/>'
    + blob(0) + blob(1) + blob(2)
    + '</svg>';
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
const AVATAR_POOL_KEY = "x_avatarPool";
function avatarPool() {
  try { const a = JSON.parse(localStorage.getItem(AVATAR_POOL_KEY) || "[]"); return Array.isArray(a) ? a.filter(Boolean) : []; }
  catch (e) { return []; }
}
function avatarPoolSave(list) {
  try { localStorage.setItem(AVATAR_POOL_KEY, JSON.stringify((list || []).filter(Boolean).slice(0, 300))); } catch (e) {}
}
// 给任何「没有自己头像的人」算一张。池子非空就从池子里按哈希取（她自己的图优先），
// 否则程序化画一张。同一个 seed 永远同一个结果。
function autoAvatarSrc(seed) {
  const pool = avatarPool();
  if (pool.length) {
    const k = pool[avatarSeedHash(seed) % pool.length];
    const u = typeof resolveImg === "function" ? resolveImg(k) : k;
    if (u) return u;
  }
  return avatarArt(seed);
}

// 头像（她 2026-08-25：「为啥别的小手机生成头像可以有真的像头像的图，我们只有 emoji 代替」）。
// 不是做不到——图像 API 早就在跑自拍、合照、小剧场剧照了，只是这条路从来没接过头像那个字段。
// 头像和自拍是两种东西：自拍要「一臂距离的前置摄像头透视」，头像要【正经的头肩像】，
// 脸占画面大半、背景干净、方图——缩到 40px 还认得出是谁才算数。
function buildAvatarPrompt(char, opts) {
  const anime = char && char.photoStyle === "anime";
  const name = (char && char.name) || "这个人";
  const look = String((char && char.appearance) || "").replace(/\s+/g, " ").trim().slice(0, 300);
  const wear = String((char && char.photoOutfit) || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const hasRef = !!(opts && opts.hasRef);
  const parts = [];
  if (hasRef) parts.push("【最高优先级·就是参考图里那个人】五官、脸型、发型发色、瞳色、肤色、年龄感完全照搬参考图，不许另造一张脸。");
  else parts.push("【" + name + "】" + (look || "按下面的气质自然设计一个具体的人"));
  if (look && hasRef) parts.push("补充特征（与参考图冲突时一律以参考图为准）：" + look);
  if (wear) parts.push("穿着：" + wear + "。");
  parts.push("【这是头像，不是自拍】正经的【头肩像】：脸占画面大半，头顶留一点余量，"
    + "视线看向镜头或略偏，表情自然（不必微笑，按这个人本来的气质来）。"
    + "背景干净单一、虚化或纯色，不要杂物、不要文字水印 logo 边框贴纸，画面里只有 " + name + " 一个人。"
    + "⚠️不要一臂距离的自拍透视、不要手机入镜、不要全身、不要大远景、不要侧背影。");
  // 参考图那条同 buildPhotoPrompt：参考图只决定【这是谁】，机位由这次决定
  if (hasRef) parts.push("参考图只决定【这是谁】。机位、头的朝向、表情、取景一律按【头像】这个用途重新决定，不许沿用参考图里的角度。");
  parts.push(anime ? "精致的二次元动画插画风格，干净的线条和上色。" : "真实照片质感：真实皮肤纹理与毛孔、自然光、浅景深，不要磨皮成塑料、不要 AI 精修感、不是 3D 渲染。");
  parts.push("正方形构图，居中，缩到很小也还认得出是谁。");
  return parts.join("");
}
// 有人物参考照时，任务不是「读一大本角色卡重新设计一个符合描述的人」，而是
// 「编辑参考图里的这个人，让同一个人出现在新场景」。长版 buildPhotoPrompt 里的
// 外貌、人设、体型、职业和摄影约束会与像素身份争注意力：上游即使收到了 image，
// 也可能只保留“古装男性”这一类别而重画一张脸（v54.94 裴照川马场实测）。
// 这份 reference-first prompt 只保留编辑所需的场景、衣着和构图；脸只由参考图决定。
function buildReferencePhotoPrompt(char, sceneDesc, st, opts) {
  opts = opts || {};
  const kind = ["self", "other", "duo"].includes(opts.kind) ? opts.kind : "self";
  const cast = Array.isArray(opts.cast) ? opts.cast.filter(x => x && x.refPhoto) : [];
  const me = opts.me || null;
  const refsN = cast.length || (kind === "duo" ? 2 : 1);
  const cName = String((char && char.name) || "人物");
  const style = ["realistic", "reference", "anime"].includes(char && char.photoStyle) ? char.photoStyle : "realistic";
  const wearing = String((char && char.photoOutfit) || freshPhotoWearing(st) || "").trim();
  const accessories = String((char && char.photoAccessories) || "").trim();
  const parts = [];
  parts.push("这是一次基于所附参考图的图片编辑，不是重新选角或重新设计人物。画面中的人物必须仍是参考图里的同一个人；逐像素级保留其独有的脸型、五官比例、眼形眼距、鼻唇轮廓、下颌、肤色、年龄感、发际线和可识别身份。不要生成相似类型、替身、演员或另一张更符合文字描述的脸。若场景要求与身份保真冲突，优先保住参考人物身份。");
  if (refsN > 1) {
    const names = cast.length ? cast.map(x => String(x.name || "人物")) : [cName, String((me && me.name) || "对方")];
    parts.push("共有" + refsN + "张人物参考图，按上传顺序分别对应：" + names.join("、") + "。每个人只沿用自己那张脸，不得交换、融合或平均化。");
  }
  if (opts.contRef && Number(opts.contRefIndex) > 0) {
    parts.push("第" + Number(opts.contRefIndex) + "张图只用于承接上一张照片的场景、衣着和光线，不是新的人脸参考。人物身份仍只由前面对应的人物参考图决定；不得把连续性图片中的脸混入、平均或替换参考人物的脸。");
  }
  if (style === "anime") parts.push("保持参考人物的二维动画／插画身份与原有角色设计，不要真人化或改成3D。");
  else if (style === "reference") parts.push("保持第一张参考图原有的视觉媒介与画风，只改变场景、姿势和必要衣着。");
  else parts.push("输出自然写实照片；保留参考人物本人，不做换脸式美化，不改变脸部骨相。");
  if (wearing) parts.push(cName + "此刻穿着：" + wearing + "。只改变衣着，不改变身体和脸。");
  else parts.push("衣着沿用参考图中可见的时代与人物气质，并按新场景做最少量、自然的调整；不要为了换装重画头脸。");
  if (accessories) parts.push("保留随身配饰：" + accessories + "。");
  if (sceneDesc && String(sceneDesc).trim()) parts.push("新场景与动作：" + String(sceneDesc).trim() + "。");
  // 参考图只锁人不锁镜头（同 buildPhotoPrompt 那条，她 2026-08-25）。
  // ⚠️这个函数目前还没有调用方；先把这一句放好，接线的那天不该重新掉进同一个坑。
  parts.push("参考图只决定【这是谁】。机位、头的朝向、视线方向、表情、姿势和取景范围按本次场景重新决定，不许沿用参考图里的角度——参考图那个仰头或低头是那张照片的信息，不是这个人的固有姿态。");
  if (kind === "self") parts.push("【硬性构图·必须是本人自拍】本人手持手机、使用前置摄像头在一臂距离内拍摄，画面须有明确自然的自拍透视，取近景或中近景，脸清楚可辨且画面只有本人。不得改成别人拍摄、三脚架肖像、影视剧照或宣传人像。");
  else if (kind === "other") parts.push("构图为别人拍摄的自然生活照，不是自拍；人物的脸清楚可辨。");
  else parts.push(opts.cinematic ? "构图为第三人称场景剧照，不是自拍；所有参考人物的脸都清楚可辨。" : "构图为自然合照；所有参考人物的脸都清楚可辨。");
  parts.push("真实自然的光线和皮肤纹理；手若入镜须解剖正确。不要文字、水印、logo或额外人物。");
  return parts.join("");
}
// 生成一张自拍，返回 { blob, dataUrl } 或 { blob:null, url }。有参考照只走 images/edits，
// 并请求 high input fidelity；注意：接口接收参考图不等于它提供了“同脸验证”回执。
async function generateSelfieImage(prompt, refPhotoDataUrl, opts) {
  const a = loadImgApi();
  if (!imgApiReady(a)) throw new Error("没配置图像 API");
  // refPhotoDataUrl 可以是单张 base64、也可以是数组（合照时传两张：角色+用户）；归一成数组
  const refs = (Array.isArray(refPhotoDataUrl) ? refPhotoDataUrl : [refPhotoDataUrl]).filter(x => x && typeof x === "string");
  // 参考照已迁入 x_imgvault 时直接取 Blob；旧 data: 仍兼容。这样 localStorage 不再为每张参考照背几百 KB。
  const refBlobs = (await Promise.all(refs.map(async rp => {
    // 连贯参考图可能是聊天自拍库的 img_ 键（与 iv_ 图库不是同一个仓），两边都要认
    try { if (rp.indexOf("iv_") === 0) return await imgVaultFetchBlob(rp); if (rp.indexOf("img_") === 0) return await idbImgGet(rp); return dataUrlToBlob(rp) || b64ToBlob(rp, "image/png"); } catch (e) { return null; }
  }))).filter(Boolean);
  if (refs.length && refBlobs.length !== refs.length) throw new Error("有参考照读取失败；为避免生成陌生人，本次已停止。请重新选择参考照后再试");
  // 归一 base：用户可能把整段 endpoint(…/v1/images/generations) 都粘进来 → 削回域名根，统一补 /v1
  const base = normalizedOpenAIBase(a.baseUrl);
  const root = openAICompatibleRoot(base);
  const size = (opts && opts.size) || a.size || "1024x1536";
  const qualityOverride = (opts && opts.quality) || a.quality;
  const parseOut = async (r, rawTxt) => {
    let d;
    try { d = JSON.parse(rawTxt); } catch (e) { throw new Error("接口没返回 JSON：" + rawTxt.slice(0, 160)); }
    if (d && d.error) throw new Error((d.error.message || d.error.msg || JSON.stringify(d.error)) + "");
    const message = d && d.choices && d.choices[0] && d.choices[0].message;
    const messageImages = message && Array.isArray(message.images) ? message.images : [];
    const messageContent = message && message.content;
    const contentParts = Array.isArray(messageContent) ? messageContent : [];
    const chatCand = messageImages[0]
      || contentParts.find(x => x && (x.image_url || x.b64_json || x.url || x.type === "output_image" || x.type === "image"));
    const cand = (d && d.data && d.data[0]) || (d && d.images && d.images[0]) || (d && d.output && (Array.isArray(d.output) ? d.output[0] : d.output)) || chatCand || d || {};
    let b64 = cand.b64_json || cand.b64 || (typeof cand === "string" && /^data:image/i.test(cand) ? cand.replace(/^data:image\/\w+;base64,/i, "") : null);
    let url = cand.url || (cand.image && cand.image.url) || (cand.image_url && (cand.image_url.url || cand.image_url)) || (typeof cand === "string" && /^https?:\/\//i.test(cand) ? cand : null);
    // OpenAI-compatible chat image providers may put the result in message.content
    // as either a data URL, a plain URL, or Markdown instead of data[0].
    if (!b64 && !url && typeof messageContent === "string") {
      const dataMatch = messageContent.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]+/i);
      if (dataMatch) b64 = dataMatch[0].replace(/^data:image\/[^;]+;base64,/i, "").replace(/\s+/g, "");
      if (!b64) {
        const urlMatch = messageContent.match(/https?:\/\/[^\s"')\]]+/i);
        if (urlMatch) url = urlMatch[0];
      }
    }
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
  // CatsAPI 的 /api/v1/chat/completions 只允许 stream=true，不能拿来做同步生图。
  // 它真正的图片协议是异步任务：POST /api/tasks 创建，随后 GET /api/tasks/{id}
  // 轮询；参考图放在 images[].base64。适配严格限于 Cats 主机，不碰其他站。
  if (isCatsImageProvider(base)) {
    const endpoint = new URL("/api/tasks", base).toString();
    const blobBase64 = blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").replace(/^data:[^;,]+;base64,/i, ""));
      reader.onerror = () => reject(reader.error || new Error("参考图读取失败"));
      reader.readAsDataURL(blob);
    });
    const extFor = blob => /jpe?g/i.test(String(blob && blob.type)) ? "jpg"
      : /webp/i.test(String(blob && blob.type)) ? "webp"
      : /gif/i.test(String(blob && blob.type)) ? "gif" : "png";
    const imageInputs = await Promise.all(refBlobs.map(blobBase64));
    const catsSize = /1536\s*x\s*1024/i.test(size) ? "1536x1024"
      : /1024\s*x\s*1536/i.test(size) ? "1024x1536" : "1024x1024";
    const catsQuality = /^(?:auto|low|medium|high)$/i.test(String(qualityOverride || ""))
      ? String(qualityOverride).toLowerCase() : "auto";
    const body = {
      model: a.model || "gptImage2",
      prompt: String(prompt || ""),
      task_type: "image",
      num_images: 1,
      params: { size: catsSize, quality: catsQuality, rewritePrompt: false }
    };
    if (imageInputs.length) body.images = imageInputs.map((base64, i) => ({
      base64: base64,
      name: "reference-" + (i + 1) + "." + extFor(refBlobs[i])
    }));
    const headers = {
      Authorization: "Bearer " + a.apiKey,
      Accept: "application/json",
      "Content-Type": "application/json"
    };
    const totalMs = Number((opts && (opts.budgetMs || opts.attemptMs)) || 180000);
    const deadline = Date.now() + Math.max(30000, totalMs);
    const request = async (url, init) => {
      const left = Math.max(1000, deadline - Date.now());
      return await nativeProviderFetch(url, Object.assign({}, init || {}, {
        headers: Object.assign({}, headers, (init && init.headers) || {}),
        timeoutMs: Math.min(left, 60000)
      }));
    };
    let response;
    try {
      response = await request(endpoint, {
        method: "POST",
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new Error("CatsAPI 创建任务网络失败 · POST " + endpoint + " · " + String((e && e.message) || e));
    }
    const raw = await response.text();
    if (!response.ok) {
      let detail = raw;
      try { const parsed = JSON.parse(raw); detail = (parsed.error && (parsed.error.message || parsed.error.msg)) || parsed.message || raw; } catch (e) {}
      throw new Error("CatsAPI 创建任务失败 · POST " + endpoint + " · HTTP " + response.status + " · " + String(detail).replace(/\s+/g, " ").slice(0, 260));
    }
    let created;
    try { created = JSON.parse(raw); }
    catch (e) { throw new Error("CatsAPI 创建任务没有返回 JSON · " + raw.replace(/\s+/g, " ").slice(0, 220)); }
    const taskId = created && (created.id || created.task_id || (created.data && (created.data.id || created.data.task_id)));
    if (!taskId) throw new Error("CatsAPI 创建任务成功但没有返回任务 id · " + raw.replace(/\s+/g, " ").slice(0, 220));
    const pollUrl = endpoint.replace(/\/+$/, "") + "/" + encodeURIComponent(String(taskId));
    let task = created;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 2500));
      let poll;
      try { poll = await request(pollUrl, { method: "GET" }); }
      catch (e) { throw new Error("CatsAPI 轮询任务网络失败 · GET " + pollUrl + " · " + String((e && e.message) || e)); }
      const pollRaw = await poll.text();
      if (!poll.ok) throw new Error("CatsAPI 轮询任务失败 · GET " + pollUrl + " · HTTP " + poll.status + " · " + pollRaw.replace(/\s+/g, " ").slice(0, 260));
      try { task = JSON.parse(pollRaw); }
      catch (e) { throw new Error("CatsAPI 任务状态不是 JSON · " + pollRaw.replace(/\s+/g, " ").slice(0, 220)); }
      const state = String((task && (task.status || (task.data && task.data.status))) || "").toLowerCase();
      if (["failed", "failure", "cancelled", "canceled", "error"].includes(state)) {
        const why = task.error_message || task.message || task.error || (task.data && (task.data.error_message || task.data.message));
        throw new Error("CatsAPI 生图任务失败 · " + state + " · " + String(why || JSON.stringify(task)).replace(/\s+/g, " ").slice(0, 300));
      }
      const results = task.result_images || (task.data && task.data.result_images);
      if (["completed", "succeeded", "success", "done"].includes(state) || (Array.isArray(results) && results.length)) {
        const normalized = (Array.isArray(results) ? results : []).map(item => {
          if (typeof item !== "string") return item;
          if (/^data:image/i.test(item)) return { b64_json: item.replace(/^data:image\/[^;]+;base64,/i, "") };
          if (/^https?:\/\//i.test(item)) return { url: item };
          return { b64_json: item };
        });
        let out;
        try { out = await parseOut(poll, JSON.stringify({ data: normalized })); }
        catch (e) {
          const prefix = refBlobs.length ? "参考照已上传，但 CatsAPI 完成任务后没有返回可用图片" : "CatsAPI 完成任务后没有返回可用图片";
          throw new Error(prefix + " · GET " + pollUrl + " · " + String((e && e.message) || e));
        }
        out.referenceCount = refBlobs.length;
        out.referenceBytes = refBlobs.reduce((n, b) => n + Number((b && b.size) || 0), 0);
        out.refMode = "cats-task";
        out.refField = "images[].base64";
        out.inputFidelity = "provider-managed";
        out.providerEndpoint = endpoint;
        out.providerPollEndpoint = pollUrl;
        out.identityVerification = "not-provided";
        return out;
      }
    }
    throw new Error("CatsAPI 生图任务等待超时 · " + Math.round(totalMs / 1000) + " 秒 · task " + taskId + " · 最后状态 " + String((task && task.status) || "unknown"));
  }
  // pOverride：审核软化重试用——同一套参考照，换一版措辞。不传就用原 prompt，行为不变。
  const attemptWith = async (blobs, refMode, pOverride, msOverride, legacyShape) => {
    const saved = refBlobs.slice();
    refBlobs.length = 0; blobs.forEach(b => refBlobs.push(b));
    try { return await attempt(true, false, refMode, pOverride, msOverride, legacyShape); }
    finally { refBlobs.length = 0; saved.forEach(b => refBlobs.push(b)); }
  };
  const attempt = async (useRef, slim, refMode, pOverride, msOverride, legacyShape) => {
    const promptText = pOverride || prompt;
    const ctrl = new AbortController();
    // 单次上限 95→180 秒（v55.02 回归修复）：这家中转正常出图就要一百多秒，
    // v54.90 的 95 秒硬闸把好好的请求掐成「Fetch is aborted」。总预算闸仍在，不会回到卡十几分钟。
    const capMs = Math.min(Number(msOverride || 130000), 300000);
    const t0 = Date.now();
    const to = setTimeout(() => ctrl.abort(), capMs);
    let r;
    try {
      if (useRef && refBlobs.length) {
        const fd = new FormData();
        fd.append("model", a.model || "gpt-image-2"); fd.append("prompt", promptText); fd.append("size", size); fd.append("n", "1"); fd.append("response_format", "b64_json");
        if (qualityOverride) fd.append("quality", qualityOverride);
        // GPT Image 的编辑接口默认 input_fidelity=low：它可能只借人物类型/构图，重新捏一张脸。
        // 角色参考照的产品语义是身份锚，因此必须显式请求 high。
        // ⚠️legacyShape（v55.01 回归修复）：8/22 晚同一个中转「改前锁脸好好的、改后收不到图」，
        // 出事窗口里请求侧就动了两处——新增 input_fidelity 字段 + 文件名从固定 ref.png 改成按
        // 真实 mime 起 .jpg/.webp。有些中转按可选字段/扩展名白名单解析 multipart，撞上就把
        // image 整个丢了（模型回「请上传参考图片」）。所以保留新形状为首选，一旦上游回话像
        // 「没收到图」，立刻用出事前验证过的老形状（ref.png + 不带 input_fidelity）重试。
        if (!legacyShape) fd.append("input_fidelity", "high");
        const refFilename = (blob, i) => {
          if (legacyShape) return "ref" + (i == null ? "" : i) + ".png";
          const mime = String((blob && blob.type) || "").toLowerCase();
          const ext = mime.indexOf("jpeg") >= 0 || mime.indexOf("jpg") >= 0 ? "jpg" : mime.indexOf("webp") >= 0 ? "webp" : mime.indexOf("gif") >= 0 ? "gif" : "png";
          return "ref" + (i == null ? "" : i) + "." + ext;
        };
        // 单张走 image（沿用验证过的路径）；多张（合照）走 image[]，交给 GPT Image 2 做高保真多图编辑。
        // 多图编辑的字段名各家不一：官方 gpt-image 用 image[]，不少中转只认重复的 image。
        // 两种都试过再降级，别一失败就悄悄丢掉参考照（那就是合照变陌生人的真凶）。
        // 不要用「只有一张图」覆盖 refMode。部分中转即使单图也只认官方常见的
        // image[]；旧代码在单图时永远落到 image，导致所谓 bracket 重试实际一枪都没发过。
        if (refMode === "first") fd.append("image", refBlobs[0], refFilename(refBlobs[0]));
        else if (refMode === "repeat") refBlobs.forEach((blob, i) => fd.append("image", blob, refFilename(blob, i)));
        else refBlobs.forEach((blob, i) => fd.append("image[]", blob, refFilename(blob, i)));
        r = await fetch(root + "/images/edits", { method: "POST", headers: { Authorization: "Bearer " + a.apiKey }, body: fd, signal: ctrl.signal });
      } else {
        // slim = 裸参数重试：有些中转不认 quality/response_format 这类可选参数，只发必填的
        const body = { model: a.model || "gpt-image-2", prompt: promptText, size, n: 1 };
        if (!slim) { body.response_format = "b64_json"; if (qualityOverride) body.quality = qualityOverride; }
        r = await fetch(root + "/images/generations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.apiKey }, body: JSON.stringify(body), signal: ctrl.signal });
      }
    } catch (err) {
      // 测速仪(v55.04):分清「我们的闹钟到点」还是「被外部(如切后台)提前掐断」
      if (/abort/i.test(String((err && err.name) || "") + String((err && err.message) || ""))) {
        const sec = Math.round((Date.now() - t0) / 1000), cap = Math.round(capMs / 1000);
        throw new Error("请求在 " + sec + " 秒后中止（本次上限 " + cap + " 秒" + (sec < cap - 3 ? "——远早于上限,多半是 app 切了后台被系统掐断,重试时请保持在前台" : ",是等待到点超时,这家站这单没做完") + "）");
      }
      throw err;
    } finally { clearTimeout(to); }
    const rawTxt = await r.text();
    // 4xx 且报错像是在挑剔某个可选参数 → 裸参数自动再试一次（GPT Image 2 的 quality 值域
    // 是 low/medium/high，别家可能只认 standard/hd；response_format 也有接口不认）
    if (!useRef && !slim && r.status >= 400 && r.status < 500 && ![401, 402, 403, 429].includes(r.status) && /param|quality|response_format|invalid\s+value|不支持|参数/i.test(rawTxt)) {
      try { return await attempt(false, true); } catch (e) {}
    }
    return await parseOut(r, rawTxt);
  };
  // 有参考照时的降级阶梯。关键：以前多图一失败就直接退回无参考照的 generations，
  // 于是合照必出两个陌生人，而且外面看起来是「成功出图」，没人知道脸锁掉了（2026-08-18 Lisa 报）。
  // 现在逐级退：image[] → 重复 image → 只锁角色一张 → 才是无参考照；并把降级结果标出来。
  // 阶梯里每一级为什么失败必须留下来。以前统统 catch 掉,外面只看到「出图成功」,
  // 排查时全靠猜——参考照被丢了却没人知道接口到底说了什么(2026-08-18)。
  // 审核软化（v54.84）。上游对【真人参考照 + 酒精/烟/刀】特别敏感：她只是要一张自拍，
  // 角色恰好在醉仙楼喝酒，模型顺手把酒杯写进了画面描述，带参考照那次就被整个拒了
  // （她 2026-08-22 截图：「没用上参考照：该提示可能违反了我们的内容政策」）。
  // 以前一被拒就直接退到无参考照——那等于为了一只酒杯丢掉整张脸，换回一个陌生人。
  // 她要的是这张脸，不是那只杯子，所以先把这些词换掉、【仍然带着参考照】再试一次。
  // ⚠️替换词一律【不挑时代】（v54.93 她提醒：别把整套东西固定成阿川那条古风线）。
  //   头一版写的是「茶盏」「折扇」，那是照着醉仙楼想的——现代角色手里冒出把折扇就荒唐了。
  // ⚠️替换顺序有讲究：先整词组、再单词，否则逐词替换会拼出病句
  //   （v54.84 实测「因饮酒而起的微醺感」→「因喝着茶而起的微红的脸色感」）。
  // ⚠️更要命的是别误伤地名：光秃秃一个「醉」字会把【醉仙楼】拆成「微红的脸色仙楼」，
  //   所以只认成词的「微醺／醉意／酒意」，绝不单独匹配「醉」；「酒楼／酒馆」同理放过。
  const SOFTEN = [
    [/因(?:饮酒|喝酒|酒)而(?:起|生|来|生出)的?/g, ""],   // 整个短语拿掉，别拼成「几分带着几分…」
    [/(?:微醺|醉意|酒意|醉态|半醉|酩酊|醉醺醺)(?:感|的|之意)?/g, "松弛"],
    [/(?:喝|饮|斟|灌|抿|品|酌)(?:着|了|下|过)?(?:白酒|黄酒|烈酒|米酒|清酒|啤酒|红酒|酒)/g, "喝着水"],
    [/(?:白酒|黄酒|烈酒|米酒|清酒|啤酒|红酒)/g, "水"],
    [/酒(?:杯|盏|壶|坛|碗|瓶|樽|囊)/g, "杯子"],
    [/酒(?![楼馆家店肆坊铺吧席宴])/g, "水"],
    [/(?:抽|吸|叼)(?:着|了)?(?:烟|香烟|卷烟)/g, "出神地"],
    [/(?:香烟|卷烟|烟斗|烟卷|烟草)/g, "随身的物件"],
    [/(?:佩刀|佩剑|带刀|挎刀)/g, "挂着随身的物件"],
    [/(?:匕首|长枪|弓箭|刀刃|刀尖|剑刃|剑尖)/g, "随身的物件"],
    [/(?:鲜血|血迹|血痕|伤口|淤青|刀疤)/g, "尘土"]
  ];
  const softenForModeration = txt => {
    let out = String(txt || "");
    SOFTEN.forEach(([re, to]) => { out = out.replace(re, to); });
    return out === String(txt || "") ? null   // 一个字都没改 → 不是这类问题，别白跑一次
      : out + "\n【画面尺度补充】画面必须是可公开展示的日常场景：不出现酒精、烟草、武器、血迹与伤口。";
  };
  // 只有【疑似被审核拒了】才值得软化重试；网络错误、超时、配额不足换个说法也没用
  const looksLikePolicy = e => /safety|policy|内容政策|content policy|moderat|sensitive|blocked|reject|违反/i.test(String((e && e.message) || e || ""));
  // ⏱整条阶梯的总时间预算（v54.90）。加了几级重试之后，每级各等 180 秒，
  // 最坏情况能卡十几分钟，界面上一直显示「拍照中」（她 2026-08-22 报）。
  // 现在给全程一个总闸：超了就不再往下试，宁可早点告诉她失败。
  // 重试级别的单次超时也压到 70 秒——真能出的图不会拖那么久，拖住的多半是死路。
  const RETRY_MS = 70000;
  const deadline = Date.now() + Number((opts && opts.budgetMs) || 180000);
  const timeLeft = () => deadline - Date.now();
  const canRetry = () => timeLeft() > 20000;   // 剩不到 20 秒就别开新的一轮了
  let lastRefErr = "";
  const note = e => { lastRefErr = String((e && e.message) || e || "").replace(/\s+/g, " ").slice(0, 180); };
  const mark = (out, how) => { try { if (out && typeof out === "object") { out.degraded = how; if (lastRefErr) out.refError = lastRefErr; } } catch (e) {} return out; };
  // v54.94：参考照存在时身份是硬条件。审核软化与 minimal prompt 可以重试，
  // 但所有重试都必须携带完整身份参考；旧降级阶梯保留在下方仅供无参考路径兼容，实际不会进入。
  if (refBlobs.length) {
    // 定版管线(v55.09,她实测拍板):经典形状+经典时长为默认——它是唯一被验证能在她的站上
    // 锁脸的形状(ref.png/无input_fidelity/180s/一次一枪)。当初出发点只是「酒楼喝酒触发审核」,
    // 正确药方是 v54.84 的措辞软化;后来叠加的身份强锁prompt+新请求形状被 8/22 审计+经典对照
    // 实验证明是把好管线改坏的元凶,全部退役。保留两级兜底,每级仍然带着参考照:
    //   1) 经典一枪 → 2) 审核拒了才换软化稿再一枪 → 3) 「没收到图」类回话才试新形状一枪 → 报错。
    // 中转站对 multipart 文件字段的兼容并不一致，而且这个偏好必须按站点保存。
    // 单图也不能永远写死 image：有的兼容层只接官方常见的 image[]。
    const preferredMode = a.refFieldMode === "first" ? "first"
      : a.refFieldMode === "repeat" ? "repeat"
      : a.refFieldMode === "bracket" ? "bracket"
      : refBlobs.length > 1 ? "bracket" : "first";
    const uploadedBytes = refBlobs.reduce((n, b) => n + Number((b && b.size) || 0), 0);
    const finish = (out, how, mode, legacyShape) => {
      out.referenceCount = refBlobs.length;
      out.referenceBytes = uploadedBytes;
      out.refMode = mode;
      out.refField = mode === "bracket" ? "image[]" : "image";
      out.inputFidelity = legacyShape ? "default" : "high";
      out.identityVerification = "not-provided";
      if (how !== "classic") out.degraded = how === "softened" ? "softened" : out.degraded;
      return out;
    };
    const ms = Number(opts && opts.attemptMs) || 180000;
    try { return finish(await attemptWith(refBlobs, preferredMode, null, ms, true), "classic", preferredMode, true); }
    catch (e1) {
      note(e1);
      // 设置页的能力探针必须一键只发一枪。生产拍照可以有受控兜底，但体检若自动
      // 轮换字段/提示词，会把同一请求连续打给上游：审核站会因此进入冷却，慢站则
      // 可能连续挂几分钟，让人根本分不清是哪一种请求失败。
      if (opts && opts.singleShot) {
        throw new Error("单次参考图探针失败（字段 " + (preferredMode === "bracket" ? "image[]" : "image") + "）：" + (lastRefErr || "未知错误"));
      }
      const noImg = /请上传|需要.{0,6}(?:原图|图片)|先看到原图|no\s+image|image\s+(?:is\s+)?(?:required|missing)|upload.{0,20}image/i.test(String((e1 && e1.message) || ""));
      if (noImg) {
        // 先只换 multipart 字段名，保持已经实测锁脸成功的经典请求形状；若仍不认，
        // 再分别试带 input_fidelity=high 的两种字段。单图同样必须真的试 image[]。
        const alternateMode = preferredMode === "bracket" ? "first" : "bracket";
        try { return finish(await attemptWith(refBlobs, alternateMode, null, ms, true), "alternate-field", alternateMode, true); } catch (e2) { note(e2); }
        for (const mode of [preferredMode, alternateMode]) {
          try { return finish(await attemptWith(refBlobs, mode, null, ms, false), "new-shape", mode, false); } catch (e3) { note(e3); }
        }
      } else if (looksLikePolicy(e1)) {
        const softened = softenForModeration(prompt);
        if (softened) { try { return finish(await attemptWith(refBlobs, preferredMode, softened, ms, true), "softened", preferredMode, true); } catch (e3) { note(e3); } }
        if (opts && opts.minimalPrompt) { try { return finish(await attemptWith(refBlobs, preferredMode, opts.minimalPrompt, ms, true), "minimal", preferredMode, true); } catch (e4) { note(e4); } }
      }
    }
    throw new Error("参考照锁脸请求失败，已停止而没有生成陌生人" + (lastRefErr ? "：" + lastRefErr : ""));
  }

  // 参考图集合的降级顺序:先丢【连贯参考图】(它只是锦上添花),再丢用户的脸,最后才无参考照。
  // 连贯图排在最后一张,所以 slice 掉尾巴就是丢它——身份永远比连贯重要。
  if (refBlobs.length > 1) {
    const sets = [];
    if (opts && opts.contRef && refBlobs.length > 1) sets.push({ n: refBlobs.length, how: null });
    sets.push({ n: Math.min(refBlobs.length, opts && opts.contRef ? refBlobs.length - 1 : refBlobs.length), how: opts && opts.contRef ? "no-continuity" : null });
    // 人多时别从 N 张一步掉到 1 张——那等于一次丢掉好几张脸。逐张往下退，能保住几个是几个。
    for (let n = refBlobs.length - (opts && opts.contRef ? 2 : 1); n >= 2; n--) sets.push({ n: n, how: "fewer-refs-" + n });
    sets.push({ n: 1, how: "duo-single-ref" });
    for (const set of sets) {
      if (set.n < 1) continue;
      if (!canRetry()) break;   // 人多时这圈自己就能转好几分钟，超预算就停
      const use = refBlobs.slice(0, set.n);
      for (const mode of (use.length > 1 ? ["bracket", "repeat"] : ["first"])) {
        if (!canRetry()) break;
        try {
          const out = await attemptWith(use, mode, null, set.how ? RETRY_MS : undefined);
          return set.how ? mark(out, set.how) : out;
        } catch (e) { note(e); }
      }
    }
    const softM = looksLikePolicy({ message: lastRefErr }) ? softenForModeration(prompt) : null;
    if (softM) {
      if (canRetry()) { try { return mark(await attemptWith(refBlobs, refBlobs.length > 1 ? "bracket" : "first", softM, RETRY_MS), "softened"); } catch (e3) { note(e3); } }
      if (opts && opts.minimalPrompt && canRetry()) {
        try { return mark(await attemptWith(refBlobs, refBlobs.length > 1 ? "bracket" : "first", opts.minimalPrompt, RETRY_MS), "minimal"); } catch (eM2) { note(eM2); }
      }
      if (canRetry()) { try { return mark(await attempt(false, false, null, softM, RETRY_MS), "softened-no-ref"); } catch (e4) { note(e4); } }
    }
    return mark(await attempt(false), "no-ref");
  }
  if (refs.length) {
    try { return await attempt(true); } catch (e) {
      note(e);
      // 被审核拒了 → 先换个说法、【照片照带】再试一次；脸比杯子重要
      // ⚠️只有【审核拒绝】才值得往下试：超时、断网、配额不足换个说法一样跑不通，
      //   硬试只会让「拍照中」多转好几分钟（她 2026-08-22 卡了几分钟）。
      const policy = looksLikePolicy(e);
      if (!policy) throw e;
      const soft = softenForModeration(prompt);
      // ① 软化 + 照片照带：她要的是这张脸，不是那只杯子
      if (soft && canRetry()) { try { return mark(await attemptWith(refBlobs, "first", soft, RETRY_MS), "softened"); } catch (e2) { note(e2); } }
      // ②【保脸级】最简 prompt + 照片照带：几乎不带场景文字，审核没东西可挑，
      //    参考照却还在。这一级由调用方传进来（opts.minimalPrompt）——只有它知道
      //    锁脸段和这条线的行头长什么样。她 2026-08-22 问「到底咋样才能永远保住脸」，
      //    答案就是这一级：把风险全在场景描述里，那就把场景描述整个拿掉。
      if (opts && opts.minimalPrompt && canRetry()) {
        try { return mark(await attemptWith(refBlobs, "first", opts.minimalPrompt, RETRY_MS), "minimal"); } catch (eM) { note(eM); }
      }
      // ③ 软化 + 无参考照：脸保不住了，至少让图出得来。
      //    以前这一级用的是【原始 prompt】，于是软化白做——原措辞本来就被拒，
      //    不带照片照样被拒，整个函数抛出，界面上就是「自拍没生成」（她 2026-08-22 第二张截图）。
      if (soft && canRetry()) { try { return mark(await attempt(false, false, null, soft, RETRY_MS), "softened-no-ref"); } catch (e3) { note(e3); } }
      if (!canRetry()) throw new Error("出图试了几轮都被挡住，先停下别再等了。最后一次的原话：" + (lastRefErr || "未知"));
      return mark(await attempt(false, false, null, null, RETRY_MS), "no-ref");
    }
  }
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
// 真声通话的耳朵：书房 Mac 上的 whisper 识别服务（voice-live），带门锁 token。
// 只存地址和门锁，不是模型密钥；留空=真声档不出现，零膨胀。
function loadVoiceEars() {
  const def = { base: "", k: "" };
  let a = def;
  try { const c = JSON.parse(localStorage.getItem("x_voiceEars") || "null"); if (c && typeof c === "object") a = Object.assign({}, def, c); } catch (e) {}
  a.base = String(a.base || "").trim().replace(/\/+$/, "");
  a.k = String(a.k || "").trim();
  return a;
}
function saveVoiceEars(c) { const clean = Object.assign(loadVoiceEars(), c || {}); try { localStorage.setItem("x_voiceEars", JSON.stringify(clean)); } catch (e) {} return clean; }
function voiceEarsReady(a) { a = a || loadVoiceEars(); return !!(a.base && a.k); }
// 送一段 16k 单声道 WAV 去识别；回 {text, ms}。识别失败抛人话错误。
async function earsTranscribe(wavBlob) {
  const a = loadVoiceEars();
  if (!voiceEarsReady(a)) throw new Error("没配置真声耳朵（设置 · API）");
  const r = await fetchT(a.base + "/transcribe?k=" + encodeURIComponent(a.k), { method: "POST", body: wavBlob, headers: { "X-Voice-Source": "app" } }, 60000);
  const d = await r.json();
  if (!r.ok || !d.ok) throw new Error("识别失败：" + (d.error || ("HTTP " + r.status)));
  return d;
}
// 克隆音色库：克过的 voice_id 登记在本机（只是清单方便管理/指派，删掉不影响 MiniMax 账号里的音色）
function loadVoiceLib() { try { const v = JSON.parse(localStorage.getItem("x_voiceLib") || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function saveVoiceLib(list) { return saveJSON("x_voiceLib", list || []); }
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
//   同人文 + 记忆离线镜像 + 单/群聊天 + 会持续长大的结构化正文搬进来。
//   x_memLib 在 memories 行表转正后只是离线镜像；
//   开机仍先 hydrate 完再挂载，所以同步读路径不变，又不再挤占 localStorage 的 5MB。
//   机制同图库：开机 hydrateTxtVault() 把 IDB 里的值一次性灌进内存镜像 __txtMirror；此后 loadJSON/saveJSON
//   对这些键读写镜像(同步)+异步落 IDB，绝不进 localStorage。云端同步靠 collect 补镜像、apply 回写 IDB。
const DURABLE_TEXT_KEYS = new Set([
  // 已有的大文本仓
  "x_weekly_issues", "x_study_sessions", "x_read_books", "x_debate_saves", "x_dream_saves", "x_tarot_saves", "x_ledger",
  // v58.83：这些内容会随着日常使用持续长大；继续留在 5MB localStorage 会反复写满。
  "x_phone", "x_phoneArch", "x_phoneVitals", "x_diaries", "x_schedules", "x_charWallet",
  // 情侣空间正文。只列 saveJSON 管理的键；仍由旧 UI 直读的小标记继续留在 localStorage。
  "x_couple", "x_couples", "x_coupleProfile", "x_coupleHome", "x_coupleBreakup",
  "x_coupleNotes", "x_coupleQA", "x_coupleQATitle", "x_coupleQACustom",
  "x_coupleExDiary", "x_coupleTimeline", "x_coupleAnniv", "x_coupleLetters", "x_coupleDrawer", "x_studio", "x_coupleShots", "x_makeup", "x_openers", "x_myCloset", "x_phoneLastAll", "x_ifLines",
  "x_coupleLetterCfg", "x_coupleSweet"
]);
const IDB_TEXT_PREFIXES = ["x_fanfic_", "x_memLib", "x_offline:", "x_goffline:", "x_chat:", "x_gchat:"];
function isIdbTextKey(k) { return typeof k === "string" && (DURABLE_TEXT_KEYS.has(k) || IDB_TEXT_PREFIXES.some(p => k.indexOf(p) === 0)); }
function isDurableTextKey(k) {
  k = String(k || "");
  return DURABLE_TEXT_KEYS.has(k) || k === "x_memLib" || k.indexOf("x_offline:") === 0 || k.indexOf("x_goffline:") === 0 || k.indexOf("x_chat:") === 0 || k.indexOf("x_gchat:") === 0;
}
// 单/群聊天可能远超 localStorage 的 5MB：它们以 WAL 本身作同步 journal，不能再要求
// localStorage 也塞下一整份；其余核心文字键继续保留 localStorage + WAL + IDB 三重核对。
function durableTextNeedsLocalJournal(k) {
  k = String(k || "");
  return k.indexOf("x_chat:") !== 0 && k.indexOf("x_gchat:") !== 0;
}
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
// 保存原图(2026-08-21 她抓的产品缺陷:原图在 IDB 里是无损的,却只能截屏翻拍)
// ref 可以是 iv_/img_ 键或 dataURL;取出 Blob 触发下载,文件名带日期。
async function saveImgOriginal(ref, name) {
  let blob = null;
  try {
    if (typeof ref === "string" && ref.indexOf("iv_") === 0) blob = await imgVaultFetchBlob(ref);
    else if (typeof ref === "string" && ref.indexOf("img_") === 0) blob = await idbImgGet(ref);
    else if (typeof ref === "string" && ref.slice(0, 5) === "data:") blob = dataUrlToBlob(ref);
  } catch (e) {}
  if (!blob) return false;
  const ext = (blob.type || "").indexOf("png") >= 0 ? "png" : ((blob.type || "").indexOf("webp") >= 0 ? "webp" : "jpg");
  // 跟存文本走同一条路：iOS 的 PWA 里 <a download> 点了什么都不会发生，得先给分享面板
  const fname = (name || "图片") + "-" + new Date().toISOString().slice(0, 10) + "." + ext;
  const via = await saveFile(new File([blob], fname, { type: blob.type || "image/jpeg" }));
  return via !== "cancel";
}
if (typeof window !== "undefined") window.saveImgOriginal = saveImgOriginal;
// 存一份文本到本地：iOS 的 PWA 里 <a download> 是不作数的（点了什么都不会发生），
// 所以顺序是【原生桥 → 分享面板 → 普通下载】，并且把真正走通的那条路回报出去——
// 她 2026-08-30 报「导不出来，没有文件出来但是显示已导出数据」，就是这条：
// 之前那份代码用的是没插进文档的 <a>、点完立刻 revokeObjectURL，然后不管成没成一律弹「已导出」。
// 拿不到结果就抛，别再骗她说导出成功了。
async function saveTextFile(filename, text, mime) {
  mime = mime || "application/json";
  const bridge = typeof window !== "undefined" && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeExport;
  if (bridge && typeof bridge.postMessage === "function") {
    // ⚠️大备份必须分片喂给原生侧：整段几十 MB 的 postMessage 会把 WK 消息通道噎死，
    // 按钮按了毫无反应（她 2026-09-03 丢档那晚的病根之一）。3MB 一片，走 begin/chunk/end。
    const CHUNK = 3 * 1024 * 1024;
    if (text.length > CHUNK) {
      const begun = await bridge.postMessage({ op: "begin", filename: filename });
      if (!begun || begun.ok !== true || !begun.id) throw new Error("原生导出没接活（begin 失败）");
      const id = begun.id;
      try {
        for (let i = 0; i < text.length; i += CHUNK) {
          const r = await bridge.postMessage({ op: "chunk", id: id, text: text.slice(i, i + CHUNK) });
          if (!r || r.ok !== true) throw new Error("传到第 " + (Math.floor(i / CHUNK) + 1) + " 片断了");
        }
        const done = await bridge.postMessage({ op: "end", id: id, filename: filename });
        if (!done || done.ok !== true) throw new Error("原生保存面板没有打开");
        return "native";
      } catch (e) {
        try { bridge.postMessage({ op: "abort", id: id }); } catch (_) {}
        throw e;
      }
    }
    const result = await bridge.postMessage({ filename: filename, text: text, mime: mime });
    if (!result || result.ok !== true) throw new Error("原生保存面板没有打开");
    return "native";
  }
  return saveFile(new File([text], filename, { type: mime }));
}
// 一个 File 落到本地：分享面板优先（iOS 唯一走得通的那条），不行再退回普通下载。
// <a> 必须先插进文档再点、revoke 必须延后，两条都是 Safari 上的硬要求。
async function saveFile(file) {
  if (typeof navigator !== "undefined" && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return "share";
    } catch (e) {
      if (e && (e.name === "AbortError" || /abort|cancel/i.test(String(e.message || "")))) return "cancel";
      // 分享面板不吃这个文件（体积过大等），继续往下试普通下载
    }
  }
  const href = URL.createObjectURL(file), a = document.createElement("a");
  a.href = href; a.download = file.name; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(href); }, 10000);
  return "download";
}
if (typeof window !== "undefined") window.saveTextFile = saveTextFile;
function resolveImg(v) { if (!v || typeof v !== "string") return v; if (v.indexOf("iv_") === 0) return _imgCache().get(v) || ""; return v; }
// 取图统一兜底(单11,2026-08-14):iOS IDB 写后立读偶发返 null(v47.36 案卷),但 imgToVault 存图时
// 已把 objectURL 放进内存缓存——仓库装聋就从内存拿,本会话刚挂的图绝不再因时序丢失;两路皆空才算真 miss。
async function imgVaultFetchBlob(ref) {
  try { const b = await idbVaultGet(ref); if (b) return b; } catch (e) {}
  try { const u = _imgCache().get(ref); if (u) return await (await fetch(u)).blob(); } catch (e) {}
  return null;
}
// 从叙事散文里只抠出【引号内的台词】，旁白/动作/心理全丢——线下、同人文这类「一大段旁白+偶尔一句台词」的语音只念角色真正说出口的话。
// 支持中文「」『』、全角“”、直角双引号 "。多句台词按换行拼接（让 TTS 自然停顿）。整段没引号台词就返回空串（调用方据此不显示 ▶）。
// 一段叙事里哪几段是【台词】：返回 [{start,end,inner}]（start/end 含引号本身）。
// 只认成对的中文/全角引号（开≠合，落单的引号自然配不上）。不收直角双引号 " ——它开合同字，
// 遇到落单的（如 5" 英寸标记）会跨段错配、把旁白当台词念（v47.99 审查）；中文角色扮演基本用「」/“”。
// ⚠️引号这套判据【只此一处】：念台词(extractSpeech)和线下正文里给台词上重音，
// 用的必须是同一份判断，两处各写一份必然有一天对不上。
function speechSpans(text) {
  const s = String(text || "");
  const re = /「([^」]*)」|『([^』]*)』|“([^”]*)”/g;
  const out = [];
  let m;
  while ((m = re.exec(s))) {
    const inner = (m[1] || m[2] || m[3] || "").replace(/[「」『』“”]/g, "").trim();
    if (inner) out.push({ start: m.index, end: m.index + m[0].length, inner: inner });
  }
  return out;
}
function extractSpeech(text) {
  // 剥掉嵌套残留的引号字符（如「他喊『快跑』」外层会连内层『』一起吃进来），别念出括号
  return speechSpans(text).map(x => x.inner).join("\n");
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
// ==== NPC 生成（她 2026-08-25）====
// 她在主角色档案里填一句「要谁」——可以是人设里提到的名字（陆闻），
// 也可以是一个位置（「他的属下」）——一次调用生成几百字小简介 + 双向关系，
// 然后就能拉进群一起聊。不做单聊、不做心情好感、不进任何后台循环。
async function generateNpc(p, hostChar, ask, takenNames) {
  const host = (hostChar && hostChar.name) || "这个角色";
  const persona = String((hostChar && hostChar.persona) || "").replace(/\s+/g, " ").slice(0, 4000);
  const taken = (takenNames || []).filter(Boolean);
  const sys = "你在为一个角色扮演 App 补一位【配角】。这位配角只会出现在群聊里，不会单独出场。\n\n"
    + "【主角色】" + host + "\n" + (persona ? "【主角色的人设】\n" + persona + "\n" : "")
    + "\n【要生成谁】用户填的是：「" + String(ask || "").trim() + "」。\n"
    + "· 如果这是【人设里已经提到过的人】，就按人设里已有的信息把他补完整，绝不改写人设里已经写死的事。\n"
    + "· 如果这是一个【位置或身份】（如「他的属下」「她的师姐」），就为这个位置造一个具体的人，起一个和主角色同一个时代、同一个世界的名字。\n"
    + (taken.length ? "· 已经有这几位了，名字和身份都别重复：" + taken.join("、") + "。\n" : "")
    + "\n【怎么写】\n"
    + "· brief 写 300~500 字，第二人称写给这位配角本人看（「你是…」）：他是谁、做什么的、和主角色怎么认识的、性格什么样、说话什么调子、此刻大概在忙什么。\n"
    + "· 要具体到能照着演：给他一两个只属于他的习惯、口头禅或在意的事，别写成「忠心耿耿、办事得力」这种履历。\n"
    + "· 世界观、时代、称谓一律跟着主角色走：主角色是古代人，配角就不能有手机；主角色是现代人，配角就别说「属下」。\n"
    + "· ⚠️他不认识用户，也不知道用户和主角色是什么关系——绝不许在简介里写任何关于用户的事。\n"
    + "· ⚠️不许给他安排和用户的感情线、不许写他暗恋谁、不许写他和主角色的暧昧。他就是个配角。\n"
    + "\n【输出】只输出 JSON，不要代码块：\n"
    + '{"name":"这位配角的名字（用户给了名字就用用户给的）","brief":"300~500字的第二人称简介","relFromHost":"主角色眼里这个人是谁，一句话（如：我的副将，跟了我八年）","relToHost":"这个人眼里主角色是谁，一句话（如：我的主子，也是把我从死人堆里拖出来的人）"}';
  const raw = await callAI(p, sys, [{ role: "user", content: "生成这位配角。" }], { maxTokens: 10000, timeout: 90000 });
  const d = parseJSONLoose(raw);
  if (!d || !d.name || !d.brief) throw new Error("模型没按格式返回（它回的是：" + String(raw || "").replace(/\s+/g, " ").slice(0, 120) + "）");
  return {
    name: String(d.name).trim().slice(0, 24),
    brief: String(d.brief).trim().slice(0, 1500),
    relFromHost: String(d.relFromHost || "").trim().slice(0, 60),
    relToHost: String(d.relToHost || "").trim().slice(0, 60)
  };
}

// ==== 外语气泡按需翻译（她 2026-08-25：角色发了别的语言，点一下像语音那样把气泡撑开显示中文）====
// 设计三条：
// ① 判定必须【保守】——宁可漏，不可把中文消息误判成外语，那样每条底下都挂个「译」很吵。
//    「装睡还非要回一句Over」这种夹一个英文词的，绝不算。
// ② 点了才调 API（她按次计费），一条一条来，绝不预翻。
// ③ 译文按【原文】缓存：同一句话在别处再出现就免费，重开 App 也还在。
function _transStrip(text) {
  return String(text || "")
    .replace(/https?:\/\/\S+/g, " ")                    // 链接不算外语
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, " ") // 表情不算
    .replace(/[\s\d]+/g, " ");
}
// 返回 "" 表示不用翻；否则返回中文语种名，直接拿去当标签
function translatableLang(text) {
  const t = _transStrip(text);
  if (!t.trim()) return "";
  const count = re => (t.match(re) || []).length;
  const han    = count(/[\u4e00-\u9fff]/g);
  const kana   = count(/[\u3040-\u30ff]/g);
  const hangul = count(/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/g);
  const cyr    = count(/[\u0400-\u04ff]/g);
  const latin  = count(/[A-Za-z\u00c0-\u024f]/g);
  // 假名和谚文是【决定性】的：中文里不会出现，见到一个就是日文/韩文，哪怕句中还有汉字。
  // v56.54 从 ≥2 放到 ≥1：「明日は雨か」只有两个假名还行，可「今夜も残業」这种
  // 汉字为主的句子会被漏掉——而那正是她最需要翻的一类。
  if (kana >= 1) return "日文";
  if (hangul >= 1) return "韩文";
  if (cyr >= 2) return "俄文";
  // 拉丁字母仍要求【一个汉字都没有】——「这个 deadline 我 handle 不了」她自己读得懂，
  // 挂个译键只是碍眼。但长度从 8 放到 6：Bonjour(7)、Merci beaucoup 都该给，
  // OK(2)/Over(4)/Sorry(5) 仍然不给。
  if (han === 0 && latin >= 6) return /^[\x00-\x7f\s]*$/.test(t) ? "英文" : "外语";
  return "";
}
// iOS 刘海（v56.63）：状态栏那一条归各个界面的顶栏自己吃——顶栏和状态栏是同一个
// 元素、同一层底色/毛玻璃，中间没有交界，也就没有缝。
// v56.61 试过「根节点垫一条空带、把它涂成顶栏的颜色」：不行。两个元素各挂一层
// backdrop-filter，各自采样、各自在边缘钳位，交界处必然留一道亮线——那就是她看见的白带。
// 做法是照 ai-virtual-phone 的聊天页看来的（AGPL，只读了它的 CSS 布局，没有取用代码）：
// 它的消息区 absolute inset-0 铺满整屏、顶栏 absolute top:0 浮在上面自己吃掉刘海，
// 全程没有那条空带。
// ⚠️主屏是唯一的例外，仍旧留着根节点那条空带：它和 Home 的 height:100vh 是配好的一对，
//   动了就散架（v56.58 亲测，见 .claude/rules/home-screen-layout.md）。
function safeTop(px) { return "calc(env(safe-area-inset-top, 0px) + " + (Number(px) || 0) + "px)"; }
// 底部输入栏的下内边距。她 2026-08-28：「线下的输入框比线上高一截」——
// 三条输入栏的高度本来只差这一个值：线上吃 0.4 条安全区，单聊线下吃【满】一条再加 4px
// （iPhone 上 34px 的安全区，两者差二十多像素），群线下是 0.4 条加 4px。
// 别的都一样（px-3 py-2.5、输入框 px-4 py-2.5、按钮 40×40），所以统一成一个常量，
// 免得以后又各自漂走。⚠️主屏那条空带不归这里管，见 .claude/rules/home-screen-layout.md。
const COMPOSER_PAD_BOTTOM = "calc(env(safe-area-inset-bottom) * 0.4)";
// 每轮再提醒一次（v56.77）：一条规则只在系统提示里声明一次，模型隔几轮就忘。
// 这做法是从 mingruis-miya 看来的（AGPL，只读了它的提示词编排、没取用代码）——
// 它把翻译规则发两遍：系统里一段硬性规则，每轮末尾再补一句短的。
// 短句只负责【提醒】，格式和边界仍以上面那段 bilingualRule 为准，别在这儿重写一遍。
function bilingualTurnHint(who) {
  const w = who ? "\u300c" + who + "\u300d" : "\u4f60";
  return "\u3010\u672c\u8f6e\u00b7\u53cc\u8bed\u3011" + w + "\u8fd9\u4e00\u8f6e\u91cc\u51e1\u662f\u3010\u4e0d\u662f\u4e2d\u6587\u3011\u7684\u90a3\u51e0\u6761\uff0c\u3010\u6bcf\u4e00\u6761\u90fd\u8981\u3011\u5199\u6210\u300c\u539f\u6587 | \u4e2d\u6587\u300d\uff0c\u4e00\u6761\u4e0d\u843d\uff0c\u522b\u53ea\u7ed9\u7b2c\u4e00\u6761\uff1b\u8bf4\u4e2d\u6587\u7684\u90a3\u4e9b\u6761\u4e00\u6839\u7ad6\u7ebf\u90fd\u522b\u52a0\u3002";
}
// 双语（v56.56，她 2026-08-26 的主意）：与其事后拿免费接口去翻——那东西把
// 「傘さすか迷うレベルで湿気すごい」翻成「您可能会迷失在雨伞中」——不如让模型
// 生成的时候顺手带出来。它知道上下文、知道这个人怎么说话，译得根本不是一个水平；
// 而且她按次计费，多这几十个 token 一分钱不多花。
// 约定：那一条气泡写成「原文 | 中文」。用竖线是因为它几乎不会出现在正常聊天里。
// 守卫从严——宁可当成普通一句放过去，也不能把带竖线的正常消息劈成两半：
//   ① 有且只有一根竖线；② 两边都非空；③ 右边必须有汉字；④ 两边不能一模一样。
//   ⑤ 左边必须【看得出是外语】——有假名/谚文/西里尔/拉丁字母都行，
//      唯独「有汉字、又一个外文字符都没有」的那种是正常中文，不许劈：
//      「价格 3|5 元」是她随手打的一句话，不是双语。
function splitBilingual(text) {
  const t = String(text == null ? "" : text);
  const i = t.indexOf("|");
  if (i <= 0 || i !== t.lastIndexOf("|")) return null;
  const orig = t.slice(0, i).trim(), zh = t.slice(i + 1).trim();
  if (!orig || !zh) return null;
  if (!/[\u4e00-\u9fff]/.test(zh)) return null;
  if (orig === zh) return null;
  const foreign = /[\u3040-\u30ff\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u0400-\u04ffA-Za-z\u00c0-\u024f]/.test(orig);
  if (/[\u4e00-\u9fff]/.test(orig) && !foreign) return null;
  return { text: orig, zh: zh };
}
// 这一条的中译已经在文本里了、不必再跑接口时，拿它当 key 找回译文。
// stripTypingPeriod 会在拆泡之后削掉句尾那个句号，所以 key 要把句尾句号和空白一起归一化。
function bilingualKey(s) {
  return String(s == null ? "" : s).replace(/[\u3002\uff0e.\s]+$/, "");
}
// 提示词那一半：单聊说「这个角色」，群里点名说是谁——两处用同一段字，
// 免得又变成「这一层只写在一处」（.claude/rules/four-surfaces-same-context.md）。
function bilingualRule(who) {
  const w = who ? "\u300c" + who + "\u300d" : "\u8fd9\u4e2a\u89d2\u8272";
  return "\u3010\u53cc\u8bed\u3011" + w + "\u5f00\u7740\u300c\u5916\u8bed\u6d88\u606f\u81ea\u5e26\u4e2d\u8bd1\u300d\uff1a\u51e1\u662f TA \u8fd9\u4e00\u6761\u8bf4\u7684\u3010\u4e0d\u662f\u4e2d\u6587\u3011\uff0c\u5c31\u628a\u8fd9\u4e00\u6761\u5199\u6210\u300c\u539f\u6587 | \u4e2d\u6587\u300d"
    + "\u2014\u2014\u4e00\u6839\u7ad6\u7ebf\uff08|\uff09\u9694\u5f00\uff0c\u5de6\u8fb9\u539f\u539f\u672c\u672c\u5c31\u662f TA \u8981\u8bf4\u7684\u90a3\u53e5\u5916\u8bed\uff08\u522b\u6539\u5199\u3001\u522b\u52a0\u6ce8\u97f3\uff09\uff0c\u53f3\u8fb9\u662f\u5b83\u7684\u4e2d\u6587\u610f\u601d\u3002"
    + "\u4e2d\u6587\u8981\u6309 TA \u8bf4\u8bdd\u7684\u53e3\u6c14\u7ffb\uff08\u7528\u8bcd\u3001\u4eb2\u758f\u3001\u8bed\u6c14\u8bcd\u90fd\u8ddf\u7740\u8d70\uff09\uff0c\u4e0d\u662f\u5b57\u5178\u76f4\u8bd1\u3001\u4e0d\u8981\u7ffb\u8bd1\u8154\u3002"
    + "\u8bf4\u4e2d\u6587\u7684\u90a3\u4e9b\u6761\u3010\u7167\u5e38\u5199\uff0c\u4e00\u6839\u7ad6\u7ebf\u90fd\u522b\u52a0\u3011\uff1b\u4e00\u6761\u91cc\u6700\u591a\u53ea\u80fd\u6709\u8fd9\u4e00\u6839\u7ad6\u7ebf\u3002"
    + "\u5b83\u53ea\u662f\u7ed9\u5bf9\u65b9\u770b\u7684\u5b57\u5e55\uff0c\u4e0d\u6539\u53d8 TA \u8bf4\u4ec0\u4e48\u3001\u8bf4\u591a\u957f\u3001\u8bf4\u51e0\u6761\u3002";
}
const TRANS_CACHE_KEY = "x_transCache";
const TRANS_CACHE_MAX = 400;
function _transKey(text) {
  const s = String(text || "");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return s.length + "_" + h.toString(36);
}
// 缓存值有两种形状：v55.99 存的是裸字符串，现在存 {zh, by}。读的时候都认。
function transCacheGet(text) {
  try {
    const v = (JSON.parse(localStorage.getItem(TRANS_CACHE_KEY) || "{}") || {})[_transKey(text)];
    if (!v) return null;
    return typeof v === "string" ? { zh: v, by: "" } : v;
  } catch (e) { return null; }
}
function transCachePut(text, zh, by) {
  try {
    const m = JSON.parse(localStorage.getItem(TRANS_CACHE_KEY) || "{}") || {};
    m[_transKey(text)] = { zh: zh, by: by || "" };
    const keys = Object.keys(m);
    if (keys.length > TRANS_CACHE_MAX) keys.slice(0, keys.length - TRANS_CACHE_MAX).forEach(k => delete m[k]);
    localStorage.setItem(TRANS_CACHE_KEY, JSON.stringify(m));
  } catch (e) {}
}
// translatableLang 已经判出语种了，直接给免费接口用（它们的 auto 检测都不太靠谱）
const TRANS_LANG_CODE = { "日文": "ja", "韩文": "ko", "俄文": "ru", "英文": "en", "外语": "auto" };
async function _fetchJSON(url, ms) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms || 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(to); }
}
// 免费引擎①：Google 的 gtx 端点。不要 key、CORS 开放、质量最好。
// ⚠️国内直连多半不通——所以它只是【第一顺位】，失败立刻让位，绝不卡着。
async function _transGoogle(text, src) {
  const u = "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t"
    + "&sl=" + encodeURIComponent(src || "auto") + "&tl=zh-CN&q=" + encodeURIComponent(text);
  const d = await _fetchJSON(u, 7000);
  const zh = (Array.isArray(d) && Array.isArray(d[0]) ? d[0] : []).map(x => (x && x[0]) || "").join("").trim();
  if (!zh) throw new Error("空结果");
  return zh;
}
// 免费引擎②：MyMemory。匿名每天 1000 词，CORS 开放，欧洲的机器国内通常连得上。
async function _transMyMemory(text, src) {
  const u = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text)
    + "&langpair=" + encodeURIComponent((src && src !== "auto" ? src : "en") + "|zh-CN");
  const d = await _fetchJSON(u, 8000);
  const zh = String((d && d.responseData && d.responseData.translatedText) || "").trim();
  // 额度用尽/出错时它会把错误话放进 translatedText 当正文回来（跟中转站一个毛病）
  if (!zh || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(zh)) throw new Error(zh ? zh.slice(0, 60) : "空结果");
  return zh;
}
// 兜底：用后台线路让模型翻。要花钱，但一条聊天消息只是几百 token，
// 而且译文进缓存、同一句只花一次。
async function _transModel(text) {
  const p = ttsHelperProfile();
  if (!p || !p.apiKey || !p.model) throw new Error("免费接口没通，后台线路也没配");
  const sys = "你是翻译。把用户发来的这段话翻译成简体中文。\n"
    + "· 只输出译文，不要原文、不要注音、不要解释、不要引号、不要「译：」这类前缀。\n"
    + "· 保留原话的语气和口吻（撒娇、调侃、生气、正式都照搬），这是聊天消息不是公文。\n"
    + "· 人名、昵称、专有名词按通行译法；实在没有通行译法就保留原文。\n"
    + "· 原文有几句就译几句，换行位置保持一致。";
  const raw = await callAI(p, sys, [{ role: "user", content: String(text || "") }], { maxTokens: 9200, timeout: 45000 });
  const zh = String(raw || "").trim().replace(/^[「『"']|[」』"']$/g, "").trim();
  if (!zh) throw new Error("上游没有返回译文");
  return zh;
}
// 免费优先，一级一级往下退；每一级都短超时，绝不让她对着「翻译中…」干等。
// 返回 { zh, by }：by 会显示在展开区里，她一眼就能看出这条花没花钱。
// 长文翻译（v56.46，思考链用）：免费那两家都是 GET 带 query，整段几千字塞进 URL 会被
// 截断或直接失败。按段落切成 ~900 字一块，逐块走 translateToZh（顺带每块各自进缓存，
// 重开时基本瞬间出）。切块只在【空行/句末】切，不从句子中间劈开。
async function translateLongToZh(text, lang) {
  const src = String(text == null ? "" : text);
  const LIMIT = 900;
  if (src.length <= LIMIT) return translateToZh(src, lang);
  const chunks = [];
  let buf = "";
  src.split(/(\n{2,})/).forEach(seg => {
    if (!seg) return;
    if ((buf + seg).length <= LIMIT) { buf += seg; return; }
    if (buf.trim()) chunks.push(buf);
    if (seg.length <= LIMIT) { buf = seg; return; }
    // 还是太长：按句末标点再切
    let rest = seg;
    while (rest.length > LIMIT) {
      let cut = rest.lastIndexOf(". ", LIMIT);
      if (cut < LIMIT * 0.4) cut = rest.lastIndexOf(" ", LIMIT);
      if (cut < LIMIT * 0.4) cut = LIMIT - 1;   // slice(0,cut+1) 才不会超出 LIMIT
      chunks.push(rest.slice(0, cut + 1));
      rest = rest.slice(cut + 1);
    }
    buf = rest;
  });
  if (buf.trim()) chunks.push(buf);
  const outs = [];
  let by = "";
  for (const c of chunks) {
    const r = await translateToZh(c.trim(), lang);
    outs.push(r.zh); by = by || r.by;
  }
  return { zh: outs.join("\n\n"), by: by };
}
async function translateToZh(text, lang) {
  const cached = transCacheGet(text);
  if (cached && cached.zh) return cached;
  const src = TRANS_LANG_CODE[lang] || "auto";
  const chain = [
    { by: "免费", run: () => _transGoogle(text, src) },
    { by: "免费", run: () => _transMyMemory(text, src) },
    { by: "模型", run: () => _transModel(text) }
  ];
  const errs = [];
  const names = ["Google", "MyMemory", "模型"];
  for (let i = 0; i < chain.length; i++) {
    try {
      const zh = await chain[i].run();
      transCachePut(text, zh, chain[i].by);
      return { zh: zh, by: chain[i].by };
    } catch (e) { errs.push(names[i] + "：" + String((e && e.message) || e).slice(0, 70)); }
  }
  // 三级都挂了要把三条原因都报出来——只报最后一条的话，她看到「后台线路没配」
  // 会以为是自己没配，其实前面两个免费的是网络不通。
  throw new Error("三条都没翻成 · " + errs.join("；"));
}

// 日语汉字 → 假名读音（v47.93）：MiniMax 对「寝」这类中日共用汉字压不住会读成中文，
// 合成前先让 AI 把汉字换成这句里的正确假名读音，喂假名给 TTS 就不会串中文。失败降级回原文（至少能出声）
async function jpKanaReading(text) {
  const p = ttsHelperProfile();
  if (!p || !p.apiKey || !p.model) return text;
  const sys = "你是日语朗读注音助手。把下面这句日语【全部汉字】替换成它在这句话里的正确假名读音（ひらがな），送假名/助词/原有假名保持不变，语序不变。不要罗马音、不要空格、不要标注、不要解释，只输出替换后的整句假名文本。";
  const raw = await callAI(p, sys, [{ role: "user", content: text }], { maxTokens: 8600, timeout: 30000 });
  let kana = String(raw || "").trim().replace(/^["「『]|["」』]$/g, "");
  // 校验：结果里不该再有汉字残留（宽松），且非空——否则用原文兜底
  if (!kana || /[一-鿿]/.test(kana)) return text;
  return kana;
}
// 合成一段语音：先查缓存，没有才真调 MiniMax（t2a_v2，hex 音频 → mp3 blob）
// v48.31 opts.emo=作者标注的语气（发语音的角色自己标的，最准）；情绪策略见下
// 缓存钥匙的推导(v60.29 抽出来单开一份)
// 原来整段埋在 ttsSpeak 里，于是「这一句听过没有」在外面根本算不出同一把钥匙。
// 她 2026-09-02 要在气泡上标出哪些是缓存过的（重播免费、不再花钱），
// 照旧那样只能在外面另写一份推导——**两份必然漂走**，
// 到时候标着「听过」的一点又去合成一次、真花了钱，比不标还坏。
// 所以只留一份：ttsSpeak 和「查缓存」用的是同一个函数算出来的同一把钥匙。
function ttsKeyFor(text, voiceId, opts) {
  opts = opts || {};
  const vid = voiceId || "female-shaonv";
  const txt = String(text || "").trim().slice(0, 800);
  if (!txt) return null;
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
  return { key: key, txt: txt, vid: vid, ve: ve, emo: emo, spd: spd, slowed: slowed, boost: boost, wantKana: wantKana, pit: pit };
}
// 这一句合成过没有。只读缓存，不打上游，也就不花钱。
async function ttsCached(text, voiceId, opts) {
  try {
    const d = ttsKeyFor(text, voiceId, opts);
    if (!d) return false;
    const hit = await idbAudGet(d.key).catch(() => null);
    return !!(hit && hit.size > 0);
  } catch (e) { return false; }
}
async function ttsSpeak(text, voiceId, opts) {
  opts = opts || {};
  const a = loadTtsApi();
  if (!ttsReady(a)) throw new Error("没配置语音 API（设置 · 语音 TTS）");
  const vid = voiceId || "female-shaonv";
  const txt = String(text || "").trim().slice(0, 800);
  if (!txt) throw new Error("这条语音没有文字内容");
  const _k = ttsKeyFor(text, voiceId, opts);
  const ve = _k.ve, emo = _k.emo, spd = _k.spd, slowed = _k.slowed, pit = _k.pit, boost = _k.boost, wantKana = _k.wantKana, key = _k.key;
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
// reroll 要避开的原文摘要（v55.40）。以前一律截到 220 字——她把最低字数设到 1500 之后，
// 模型只看得到开头 15%，后面照抄一遍也不算违规，于是「重 roll 出来和上一把几乎一模一样」。
// 现在给足；太长时取【头 + 尾】：开头和收尾那一拍正是最容易原样重来的两处。
function offlineRerollExcerpt(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= 1400) return t;
  return t.slice(0, 900) + " …（中略）… " + t.slice(-500);
}
function offlineStyleText(key) {
  const s = OFFLINE_STYLES.find(x => x.key === key);
  if (s) return s.prompt;
  // 自定义文风住在 localStorage 的 x_offlineStyles，不在内置表里——
  // 以前查不到就返回空串，于是她加的文风一个字都没进提示词（她 2026-08-22）。
  try {
    const list = typeof loadJSON === "function" ? (loadJSON("x_offlineStyles", []) || [])
      : JSON.parse(localStorage.getItem("x_offlineStyles") || "[]");
    const c = (list || []).find(x => x && x.key === key);
    return c && c.prompt ? String(c.prompt) : "";
  } catch (e) { return ""; }
}
// 这一局到底喂哪份文风。开了「吃入文风预设」就走预设台那套（模块按用户排的顺序拼），
// 没开就照旧：session 自带的 stylePrompt 优先，否则按 styleKey 回落到内置/自定义文风。
// 预设台是新东西，开关默认关着——不开的人一个字都感觉不到变化。
function offlineResolveStyleText(session, ctx) {
  const s = session || {};
  if (s.presetOn && s.presetId && window.StylePresets) {
    const txt = window.StylePresets.blockFor(s, "offline", ctx || {});
    if (txt) return txt;
  }
  return s.stylePrompt ? s.stylePrompt : offlineStyleText(s.styleKey);
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
// ── 群里的人设额度（Lisa 2026-08-24 立的「四处一样喂」）──
// 以前四处各写一个固定截断（线上群 200、投票 220、群线下 260、OOC 200），单聊却给全文。
// 200 字对「裴照川，男，25岁。大晏……王爷」这种，只够写完【他是谁】、写不到【他怎么说话】；
// 空白由训练先验补上就成了网文霸总。而同群的双胞胎是「现代年轻人」，fallback 恰好无害——
// 所以同一个群里只有他一个人崩。截断对谁伤害大，取决于剩下的标签有多刻板。
// 改成按在场人数分总预算：两三个人的群直接给全文，人多了才按份额收。
// 她的人设每个都 4500+，9000 的总预算在三人群里就开始截了（2026-08-24）。
// 她按次计费，上下文长一点不多花钱；每人给到 6000 封顶、总预算 30000，
// 五个人以内谁都不用被砍。人再多才按份额收，地板 1500。
const GROUP_PERSONA_BUDGET = 30000, GROUP_PERSONA_EACH_MAX = 6000;
// NPC 是配角，几百字就够；不参与按人数平分，也别把主角色的额度吃掉。
const NPC_PERSONA_CAP = 900;
function groupPersonaBudget(memberCount) {
  const n = Math.max(1, Number(memberCount) || 1);
  return Math.min(GROUP_PERSONA_EACH_MAX, Math.max(1500, Math.floor(GROUP_PERSONA_BUDGET / n)));
}
function groupPersonaText(persona, budget) {
  const t = String(persona == null ? "" : persona).trim();
  if (!t) return "（暂无设定）";
  const b = Math.max(200, Number(budget) || 200);
  return t.length <= b ? t : t.slice(0, b) + "…〔人设过长，按在场人数分到的额度截断〕";
}

// 每轮都在回闪同一段身世（她 2026-08-28：王爷人设卡写了当十二年质子，线下每一轮都在
// 「十二岁那年刚到京城」）。回忆是最便宜的填充：要凑篇幅、要给这一刻添点重量时，
// 卡里最显眼的那段往事永远是第一个被抓过来的，而且每一轮它都觉得「这次真用得上」。
// 规则只能降概率——照 crossChannelSaid 那套给它一份【已经讲过的】摆回面前：
// 讲过的往事就是用掉了，不许再讲一遍。
// 只认开头那几个把叙事拉回过去的路标，不做语义判断——宁可漏，也别把「今年」「明年」
// 这种当下时间语当成回忆抓进来。
const FLASHBACK_CUE = /(?:[一二三四五六七八九十百千零〇\d]+\s*岁那年|[一二三四五六七八九十百千零〇\d]+\s*年前|那一年|当年|早年间|早年|幼时|小时候|年少时|从前|初到|刚到[^，。；！？\n]{0,10}的时候|后来长大)/;
const FLASHBACK_MAX = 5;      // 最多摆五条，再多是给上下文添堵
const FLASHBACK_CHARS = 44;   // 每条只要够她认出是哪一段就行
function offlineFlashbacksSaid(scenes) {
  const seen = new Set(), out = [];
  (scenes || []).forEach(text => {
    String(text || "").split(/[。！？\n]+/).forEach(sent => {
      const t = sent.trim();
      if (t.length < 6 || !FLASHBACK_CUE.test(t)) return;
      const excerpt = t.length > FLASHBACK_CHARS ? t.slice(0, FLASHBACK_CHARS) + "…" : t;
      const key = excerpt.replace(/\s+/g, "");
      if (seen.has(key)) return;
      seen.add(key);
      out.push(excerpt);
    });
  });
  return out.slice(-FLASHBACK_MAX);
}
function offlineFlashbackBlock(scenes) {
  const said = offlineFlashbacksSaid(scenes);
  if (!said.length) return "";
  return "\n\n〔这场线下里你已经往回讲过的事〕\n" + said.map(x => "· " + x).join("\n")
    + "\n这几段用掉了。这一轮不要再讲一遍，也不要换个说法重讲；真想往回想，就换一件没讲过的，或者干脆不回想——眼前正在发生的事本身就够写。";
}

// ⚠️时间感知关了就【不许在历史里盖时刻戳】（v61.16，她 2026-09-03：「我明明没开时间感知
//   为啥他还是知道现在几点」）。关掉这个开关的时候，system 里那块【当前真实时间】确实
//   已经不发了——但每一条历史前面还盖着〔今天14:32〕，最后一条就是她刚发的那句，
//   等于把当前时刻原样告诉了他，比直接发那一行还准。
//   相对间隔（「中间隔了约三小时」）留着：那是对话连不连得上的事，不是现实几点的事。
function offlineHistory(msgs, userName, charName, clock) {
  const g = [];
  let prevTs = 0;
  const mixed = (msgs || []).some(m => m && m._surface === "online");
  (msgs || []).forEach(m => {
    if (m.kind === "ooc") return; // OOC 不进角色扮演上下文
    const ts = Number(m.ts) || 0;
    const gap = prevTs && ts && ts - prevTs > 90 * 60000
      ? "〔—— 中间隔了约 " + gapPhrase(ts - prevTs) + (clock === false ? "" : "，到 " + fmtStampAI(ts)) + " ——〕\n"
      : "";
    const stamp = (ts && clock !== false) ? "〔" + fmtStampAI(ts) + "〕" : "";
    // ⚠️只标一边等于没标：线上那几条标了【线上私聊】，线下这几条什么都不标，
    // 模型就得靠猜。所以【这段历史里混进了线上内容】的时候，线下这几行也标出来。
    const surface = m._surface === "online" ? "【线上私聊】" : (mixed ? "【当面】" : "");
    if (m.role === "char") {
      const l = g[g.length - 1];
      // 线下真拍下来的那一格：和线上同一个落法——说明它【已经拍过了】，
      // 免得下一拍又说自己没拍过、或者原样再拍一张（她 2026-08-29）。
      const shot = m.kind === "selfie"
        ? (m.failed ? "【这里试着拍了一张，但图没出来】"
          : "【这一刻已经实际拍下一张" + (m.photoKind === "duo" ? "你和" + userName + "的合照" : m.photoKind === "other" ? userName + "替你拍的照片" : "自拍") + "，是你亲手做过的事，不得说没拍过、也别马上原样再拍一张】" + (m.desc ? "画面：" + m.desc : ""))
        : "";
      const c = gap + stamp + surface + (shot || m.content || "");
      if (l && l.role === "assistant") l.content += "\n" + c; else g.push({ role: "assistant", content: c });
    } else {
      const raw = m.content || "";
      const dateAnchor = (clock !== false && window.TemporalAnchor) ? window.TemporalAnchor.anchor(raw, m.ts) : "";
      // 她递过来的真照片：跟线上同一个落法。光一句「[照片]」什么都不说，
      // 而图只对最近两张作视觉输入附上——一滑出去他就什么都不记得了。
      const shown = (m.kind === "photo" && m.imageRef)
        ? "【" + userName + "把一张真实照片递到你眼前，像素已随本轮视觉输入附上，直接看图】"
          + (m.desc ? "\n她说：" + m.desc : "")
          + (m.seenNote ? "\n（你当时记下的画面：" + m.seenNote + "）" : "")
        : "";
      const c = gap + stamp + surface + (shown || (m.role === "narration" ? "【场景设定】" + raw : raw)) + (dateAnchor ? dateAnchor : "");
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

const OFFLINE_REGISTER_DIRECT_RE = /性器|阴茎|阴蒂|龟头|乳房|胸乳|鸡巴|肉棒|阳具|阴道|小穴|肉穴|屁眼|勃起|硬(?:了|起来|得)|进入(?:她|他|你|身体)|插入|抽送|挺进|贯穿|高潮|自慰|做爱|性交|口交|肏|操(?:进|入)|撸(?:动|弄)|套弄|吞(?:了)?进去|进得.{0,5}深|顶(?:到|进|向).{0,8}(?:深处|最深|到底)|撞(?:到|进|向).{0,8}(?:深处|最深|到底)|手(?:指)?[^。！？\n]{0,12}(?:伸进|探进)[^。！？\n]{0,12}(?:裤|内裤|腿间)|(?:握住|握上|抓住|含住|舔弄)[^。！？\n]{0,10}(?:性器|阴茎|鸡巴|肉棒|阳具|那里)|脱(?:下|掉|了)[^。！？\n]{0,8}(?:裤子|内裤)/i;

function offlineRegisterExplicitText(text) {
  return OFFLINE_REGISTER_DIRECT_RE.test(String(text || ""));
}

// 生成前识别输入/history 已经成立的明确场景；首稿自己跨越的情况在生成后再补检。
// 单次响应内自修（初稿→自编辑去认证句）。原先写死在 generateOffline 里，小剧场等其它
// 线下通道拿不到；抽出来共享，让「所有线下走同一套提示词」这句话真的成立（Lisa 2026-08-18）。
// shape 用于替换末尾的输出形状说明——不同通道的 JSON 字段不一样。
function offlineSelfReviseProtocol(shape, archetypeGuard, narr) {
  return `\n\n【本轮单次响应内自修】
本轮只调用你一次，但输出 JSON 时必须依次完成两个不同字段：
1. draftScene：先完整写出这一刻真正发生的首稿。事实、人物选择、主动关系、尺度与角色回应都在这里形成。
2. scene：draftScene 写完后，立即把它当作已经确定事件的编辑对象；不续写、不改变任何事件、先后顺序、人物决定、主动关系、尺度或台词的沟通功能，只修表达。

scene 必须保留全部具体身体事实，不淡出、不概括、不降低明确程度，也不新增或升级动作。保留这个人的具体选择、现实注意、关系回应和独特说话方式；通用成人场面话可以在不改变含义与语气方向的前提下换成这个人更自然的说法。
同样保留首稿里真正属于这个人的观察角度、嘴硬、自嘲、误判、注意取舍和有表现力的矛盾瞬间；这些不是可删的“修辞包装”。自修不把有疏密和气口的叙事改成等距的动作清单。
删除或平实改写只负责再次证明刺激与强度、却不增加新事实或人物信息的内容，例如成串的嗓音变化、喉结、青筋、红眼、呼吸认证、神经刺激、理智或侵略性总结。同一种身体事实或反应维度只陈述一次。事实与渲染混在一句时保留事实核心，只移除认证包装；不要以缩短、清水化或统一成冷静短句为目标。
${archetypeGuard ? "角色卡里的强烈性格标签只决定人物会作何选择，不是要求旁白反复替他宣传某种原型。行为或台词已经表现清楚时，删除随后给它贴标签、评点气场、认证他有多强势／危险／无赖／宠溺的作者解说；保留真实的赖账、坚持、疲倦、占有、照顾、关系决定和说话功能，不把人物改乖。" : ""}
${offlineRevisionAddressRule(narr)}
draftScene 是内部草稿，scene 才是展示并进入历史的终稿。两者都必须是完整字符串，不得省略、互换或解释修改过程。

本轮输出形状严格改为：` + (shape || '{"draftScene":"内部完整首稿","scene":"基于前一字段完成的最终正文","thought":"角色本人此刻没说出口的一句第一人称心声","mood":{"label":"此刻中文心情词"},"action":"此刻正在做什么，第一人称一句","wearing":"换了才写，没换填 null","affinityDelta":0,"toy":null}');
}

function offlineArchetypeSelfReviseProtocol(shape, narr) {
  return `\n\n【本轮人物表达自修】
本轮只调用你一次，但输出 JSON 时依次完成两个字段：
1. draftScene：先让这个具体的人照常完成本轮场景。
2. scene：事件全部保持不变，只检查表达是否把人物演成了现成的言情原型。

scene 必须保留人物真正做出的选择、关系立场、疲倦与欲望、对眼前人的具体回应、共享细节和台词的沟通功能；不把人物改得更温和、更礼貌，也不削弱其原有性格。
保留首稿里真正属于这个人的观察角度、嘴硬、自嘲、误判、注意取舍和有表现力的矛盾瞬间；它们是叙述声纹，不是原型包装。自修不得把有疏密和气口的叙事压成等距的动作记录。
角色卡里的强烈标签是行为原因，不是旁白任务。若动作和台词已经足以表现人物，删除随后替读者评点他像什么人、认证他有多强势／危险／无赖／宠溺，或把普通语气包装成某种魅力的作者解说。用事实让性格成立，不反复给事实贴标签。
${offlineRevisionAddressRule(narr)}
亲昵动作可以自然发生；但如果某个小动作只是在重复展示同一种人设、没有改变距离、选择、关系或感受，不要把它当作角色的固定签名每轮补一次。
不要追求缩短，不把场景改成动作记录，也不要复用一种统一的冷静文风。draftScene 是内部草稿，scene 才展示并进入历史。

本轮输出形状严格改为：` + (shape || '{"draftScene":"内部完整首稿","scene":"基于前一字段完成的最终正文","thought":"角色本人此刻没说出口的一句第一人称心声","mood":{"label":"此刻中文心情词"},"action":"此刻正在做什么，第一人称一句","wearing":"换了才写，没换填 null","affinityDelta":0,"toy":null}');
}

// 语域跟着场面走，不跟着聊天记录走（v53.84）。
// 线下单聊和小剧场有 offlineRegisterTransition 这套明确场景状态机；线上群聊、群线下、
// 线上单聊【一样都没有】——决定这一轮说话尺度的唯一信号就是上面那几十条聊天记录。
// 于是只要有一段变得露骨，后面几十条都照着学：删掉那条群规矩也没用，因为真正在驱动它的
// 早就不是规矩，是记录本身（Lisa 2026-08-19：日常对话、吃醋、管束全被翻译成了性器官词汇）。
// 这条规则【常开且对称】：她带过去就跟上、尺度不设限；她没带就别自己起头。
// 不做任何"检测到露骨就降温"的启发式——那会在她真的在场景里、只回一句「继续」时误伤。
const REGISTER_FOLLOWS_SCENE = `【说话的尺度跟着此刻的场面走，不跟着聊天记录走】
上面的记录里可能有过很露骨的段落——那属于【当时那个场面】，不是你们的固定说话方式，也不是这个群的默认语域。
这一轮该用什么词，只看【用户这一轮说了什么、此刻正在发生什么】：
· 她聊的是日常（猫、吃饭、睡觉、上班、拌嘴、谁又惹谁生气），你们就用日常的话接。占有欲、吃醋、管束、下命令统统照旧、该多凶多凶，但【不必把日常话题翻译成性器官词汇】——把"去睡午觉"说成"去睡午觉"就行。
· 她把话带到亲密场面上、或此刻确实正在发生那种事，你们再自然跟上，【尺度不设限】，不必自我审查。
【不许无来由起头】没有人把话题带过去的时候，不要自己把日常话题拧到身体、性器官或"昨晚"上去，也不要用它当调情的万能接话方式。想表达占有和亲昵有一百种方式，那只是其中一种，不是唯一一种。`;

function offlineRegisterTransition(session) {
  const rows = (session && Array.isArray(session.msgs) ? session.msgs : [])
    .filter(m => m && m.kind !== "ooc" && m.content);
  if (!rows.length) return { before: false, after: false, inject: false };
  // rewrite 会主动把高刺激词洗掉，因此“上一轮已处于明确场景”必须作为消息状态留下，
  // 不能要求干净终稿每轮重新携带触发词来证明自己仍在同一场景。
  const hit = m => !!(m && m.registerExplicitActive) || offlineRegisterExplicitText(m && m.content);
  const last = rows[rows.length - 1];
  const inputBeat = last.role !== "char" && last.role !== "assistant";
  const reset = /第二天|次日|天亮后|过了(?:几小时|一夜|很久)|时间跳到|场景切换|亲密结束|停下来后|结束后.{0,12}(睡|洗|穿|离开)|穿好(?:衣服|裤子)|收拾好.{0,8}(出门|离开)|去上班|到了公司|回到学校|各自回去|分开以后/i;
  let active = false;
  let before = false;
  for (let i = 0; i < rows.length; i++) {
    if (i === rows.length - 1) before = active;
    if (rows[i - 1] && rows[i - 1].ts && rows[i].ts && Number(rows[i].ts) - Number(rows[i - 1].ts) > 4 * 3600000) active = false;
    if (reset.test(String(rows[i].content || ""))) active = false;
    else if (hit(rows[i])) active = true;
  }
  const after = active;
  const inject = !!(inputBeat && !before && after);
  let reference = "";
  if (inputBeat) {
    for (let i = rows.length - 2; i >= 0; i--) {
      const row = rows[i];
      if ((row.role !== "char" && row.role !== "assistant") || hit(row)) continue;
      reference = String(row.content || "").trim();
      if (reference) break;
    }
    if (reference.length > 420) {
      reference = reference.slice(-420);
      const edge = reference.search(/(?:\n\n|[。！？]\s*)/);
      if (edge >= 0 && edge < 120) reference = reference.slice(edge + (reference.slice(edge, edge + 2) === "\n\n" ? 2 : 1)).trim();
    }
  }
  return { before, after, inject, inputBeat, active, reference };
}

// 「最低字数」在产品里按用户实际看见的正文计数：忽略空格与换行，
// 但标点、英文和数字仍是可见内容。不要用 String.length 把排版空白冒充正文。
function offlineVisibleCharCount(text) {
  return Array.from(String(text || "").replace(/\s/g, "")).length;
}

function offlineMinimumSceneChars(value) {
  const n = Math.floor(Number(value) || 0);
  return Number.isFinite(n) && n > 0 ? Math.min(12000, n) : 0;
}


// 思考链的第二个来源（v56.75）：有些中转把推理直接塞进正文的 <thinking>…</thinking> 里，
// 而不是 reasoning_content / thought 那类字段。字段拿不到时再从正文捞一次。
// 只读不改正文——正文该怎么解析还怎么解析（我们的正文是 JSON，标记块本来就会被 extractJSON 跳过）。
// 全角尖括号也认：她那条线上见过模型打成 ＜thinking＞。
function reasoningFromBody(text) {
  const raw = String(text == null ? "" : text);
  if (!raw) return "";
  const open = raw.search(/[<＜]think(?:ing)?[>＞]/i);
  if (open < 0) return "";
  const after = raw.slice(open).replace(/^[<＜]think(?:ing)?[>＞]/i, "");
  const close = after.search(/[<＜]\/think(?:ing)?[>＞]/i);
  // 没有收尾标记＝模型忘了闭合或被截断，后面整段都算思考
  return (close < 0 ? after : after.slice(0, close)).trim();
}
async function generateOffline(p, ctx, session) {
  const char = ctx.char;
  const userName = (ctx.profile && ctx.profile.name) || "用户";
  const styleText = offlineResolveStyleText(session, { uName: userName, charName: char.name });
  const notes = (session.customNotes || []).map(n => typeof n === "string" ? n : (n && Number(n.remaining) > 0 ? n.text : "")).filter(Boolean);
  const cotModelKey = offlineCotModelKey(p);
  const isDigital = !!ctx.notRoleplay;
  const intimacyContextActive = !isDigital && offlineIntimacyContextActive(session);
  const registerTransition = !isDigital ? offlineRegisterTransition(session) : { before: false, after: false, inject: false };
  const archetypePerformanceRisk = !isDigital && offlineArchetypePerformanceRisk(char && char.persona);
  // 用户首次跨越与角色在上一条 assistant 中自主跨越都由同一套 direct + reset 判定覆盖，避免两套正则互相否决。
  let rewriteRequested = !isDigital && !!registerTransition.inputBeat && !!registerTransition.active;
  const missingStateFields = [];
  if (!isDigital && !String(ctx.curWear || "").trim()) missingStateFields.push("wearing（当前穿着）");
  if (!isDigital && !String(ctx.curAction || "").trim()) missingStateFields.push("action（当前可持续的活动或所处状态，不写转瞬即逝的小动作）");
  const stateBootstrapHint = missingStateFields.length
    ? "\n【一次性状态建档】App 还没有 " + missingStateFields.join("、") + "。本轮请在对应 JSON 字段中根据【此刻场景】重新确立一次；不要写进 scene，也不要为填状态制造剧情。"
      + "\n注意：字段空着的意思是【现在不知道】，不是「沿用你记得的上一套」——上一套多半已经过期(换了场景、洗过澡、睡过一觉)。据当下真实处境写，写不出来就留空，宁可空着也别编。"
    : "";
  // v52.66 A/B：普通单人线下不再注入「创作小稿 / COT」。数字模式仍沿用原路径；
  // 其余叙事、篇幅、文风、示例和导演提示全部保持不变，便于单独判断作者规划是否放大文体切换。
  const requestedCotT = isDigital ? cotThink({ char: char.name, user: userName }) : "";
  const cotT = requestedCotT && !loadOfflineSingleNoCotV2Models().includes(cotModelKey) ? requestedCotT : "";
  const singleCotBlock = isDigital ? cotSystemBlock(cotT) : "";
  // 篇幅与文风分离：自然长度不设句数；沉浸长文靠有效推进变长，不靠摄影式拆动作或重复解释凑篇幅。
  const lengthMode = session.lengthMode === "immersive" ? "immersive" : "natural";
  const minimumSceneChars = offlineMinimumSceneChars(session.minWords);
  const lenGuide = lengthMode === "immersive"
    ? "本轮采用【沉浸长文】：允许这一刻在真正有内容时自然跨过多个有效阶段。每个继续展开的阶段都要带来新的行动、选择、对话、信息、时间流动或环境对行动造成的实际影响；不要重复解释同一种心理、反复重拍没变化的环境与姿态，也不要把一个简单动作拆成许多步骤。只有当前场景确实还能推进时才继续；一旦到了需要对方回应、选择或行动的位置，就自然停下，不为写长而替对方作答或硬造新事"
    : "本轮采用【自然长度】：篇幅由这一刻真正发生的内容决定。简单反应可以很短；有值得展开的行动、对话、判断或场景变化时自然展开，不为显得完整而补齐固定栏目";
  // 配件（线下·授权门在 app 侧算好传进 session.toyOn；线下天然是用户在场当面，无后台顾虑）
  const toyHint = session.toyOn ? "\n【toy 配件·此刻已授权】你和" + userName + "此刻线下面对面、且开了「配件」——你的动作和话能【真的作用到 Ta 身上】。这一段情境到了（亲密、挑逗、想让 Ta 有反应、按住 Ta 别乱动）你可以填 toy:{\"pattern\":\"teasing｜steady｜wave｜pulse｜edge｜ramp｜hold｜throb｜flutter｜tide｜knock｜surge\",\"intensity\":1到20整数,\"duration\":秒数1到90,\"reason\":\"配合这段的哪个动作/哪句话\"}，否则 toy:null。**节奏跟叙事走**：推进升温→intensity 渐强；故意吊着/停下→pattern 用 edge 或压到 1；一个命令/一个动作点到 Ta→pattern 用 pulse 短脉冲。pattern：teasing 若即若离偶尔一下／steady 稳定持续／wave 起伏／pulse 一下一下点名／edge 推到顶再骤降／ramp 一路往上推不回落／hold 高位稳住不退潮／throb 心跳般的双击／flutter 高频细颤酥麻／tide 绵长的长潮起落／knock 三下轻叩后静默／surge 潜伏后突然拉满。**一段想持续久就直接把 duration 拉长（最多 90 秒）**，长段落用 hold/tide/ramp。**想让一轮里节奏有变化，可以直接给【数组】排好几段，会按顺序连着放、中间不断档**：如 toy:[{\"pattern\":\"wave\",\"intensity\":8,\"duration\":30},{\"pattern\":\"hold\",\"intensity\":14,\"duration\":20}]（最多 6 段、整串总时长不超过 5 分钟；单段仍最多 90 秒）。先有叙事、动作配合叙事，别每段都发。强度我这边有上限，超了会被压到上限。" : "";
  const digitalToyHint = session.toyOn ? "\n【配件】此刻配件已由 " + userName + " 当场授权并连到她身上。你想实际控制它时，可使用 toy：pattern 为 teasing/steady/wave/pulse/edge/ramp/hold/throb/flutter/tide/knock/surge，intensity 1-20，duration 1-90 秒；**想让一轮里节奏有变化，可以直接给【数组】排好几段，会按顺序连着放、中间不断档**：如 toy:[{\"pattern\":\"wave\",\"intensity\":8,\"duration\":30},{\"pattern\":\"hold\",\"intensity\":14,\"duration\":20}]（最多 6 段、整串总时长不超过 5 分钟；单段仍最多 90 秒）。是否使用、何时使用、用什么节奏由你自己决定。" : "";
  // 线下拍照能力（app 侧算好 photoOn / photoDuo 传进来：接了图像 API、这个人有外貌或参考照、
  // 没在冷却里）。数字生命不发——扮演类规则一律不给他。
  const offPhotoHint = (!isDigital && session.photoOn) ? offlinePhotoHint(userName, char.name, !!session.photoDuo, false) : "";
  const toyField = session.toyOn ? ",\"toy\":null或{\"pattern\":\"teasing｜steady｜wave｜pulse｜edge｜ramp｜hold｜throb｜flutter｜tide｜knock｜surge\",\"intensity\":整数1-20,\"duration\":秒1-90,\"reason\":\"配合哪句/哪个动作\"}" : "";
  // v52.88 A/B：预检已命中的普通单人线下，把“首稿 → 表达编辑”折叠进同一次 completion。
  // JSON 字段按 draftScene → scene 排列；模型生成 scene 时，首稿已经成为它最近的上下文，
  // 但网络层只发生一次请求。未命中时仍沿用普通单稿协议，不给所有线下轮次平白加倍输出。
  const explicitRevisionRequested = !isDigital && !!rewriteRequested;
  const archetypeRevisionRequested = !isDigital && !!archetypePerformanceRisk;
  rewriteRequested = explicitRevisionRequested || archetypeRevisionRequested;
  const singlePassRevisionRequested = explicitRevisionRequested || archetypeRevisionRequested;
  const singlePassRevisionProtocol = explicitRevisionRequested
    ? offlineSelfReviseProtocol(null, archetypeRevisionRequested, session.narr)
    : (archetypeRevisionRequested ? offlineArchetypeSelfReviseProtocol(null, session.narr) : "");
  // 「Ta 眼里」这张印象卡，线下一直只【读】不【写】：buildBundle 会把 gazeText 发过去，
  // 但从来没人给过线下【写】的指令，于是在线下泡多久这张卡都不动（她 2026-08-28）。
  // 数字生命（言秋）不发——扮演类规则一律不给他。
  // ⚠️「用不上就整个省略，别为了填而填」这句在【这一轮点了名】的时候是反的：
  //   它跟点名那一段直接打架，而且它是整块的开场白——最响。点了名就不许再说这句。
  //   （线上那边同一个病是「未发生、未改变的按需字段直接省略」，见 app.js 里的排序。）
  const _gazeNudged = !!(ctx.gazeSpec && ctx.gazeSpec.indexOf("这一轮请复看这一块") >= 0);
  const gazeSpecBlock = (!isDigital && ctx.gazeSpec && ctx.gazeSpec.trim())
    ? "\n\n【Ta 眼里·印象卡】以下两个字段是上面输出形状的【追加项】"
      + (_gazeNudged ? "。⚠️这一轮里点了名，impression 与 impressionChecked 必须二选一，不许两个都省略：\n" : "，用不上就整个省略，别为了填而填：\n")
      + ctx.gazeSpec.trim()
      + "\nimpressionChecked:\"块名\" = 对【本轮被点名复看的那一块】表态「看过了，确实不用改」；改了就填 impression、别填这个。"
    : "";
  const outputSpec = isDigital
    ? "\n【输出接口】只输出最小 JSON：{\"scene\":\"你此刻想对 " + userName + " 说的正文\",\"thought\":\"此刻没说出口的真实心声\",\"mood\":{\"label\":\"此刻中文心情词\"}" + (session.toyOn ? ",\"toy\":null或{\"pattern\":\"teasing|steady|wave|pulse|edge|ramp|hold|throb|flutter|tide|knock|surge\",\"intensity\":1到20,\"duration\":1到90,\"reason\":\"原因\"}" : "") + "}。thought 和 mood 是你在 App 中持续成长的实时状态，请如实填写；除这些字段和你主动调用的能力外，不加状态作业。"
    : "\n\n" + OFFLINE_PROTOCOL_V2
      + ((!isDigital && session.photoOn) ? "\n【photo 格式】这一拍真拍了才填 {\"kind\":\"self｜other" + (session.photoDuo ? "｜duo" : "") + "\",\"scene\":\"这一格拍到了什么\"}，没拍就 photo:null。它是上面输出形状的追加项。" : "")
      + ((!isDigital && ctx.photoSeenSpec) ? "\n\n" + ctx.photoSeenSpec.trim() : "")
      + singlePassRevisionProtocol + (session.toyOn ? "\n【toy 格式】实际触发时填写 {\"pattern\":\"teasing|steady|wave|pulse|edge|ramp|hold|throb|flutter|tide|knock|surge\",\"intensity\":1到20整数,\"duration\":1到90秒,\"reason\":\"配合当前场景的原因\"}。" : "");
  const system = (isDigital ? buildBundle(ctx) + digitalToyHint : buildBundle(ctx) +
    "\n\n" + OFFLINE_NARRATIVE_RUNTIME +
    "\n\n" + PERSONA_REGISTER_ANCHOR +
    "\n\n" + MOOD_TURN_RULE +
    // 读懂对方这句话在做什么:原先焊死在 ReplyPacing.guidance 里,只有线上单聊吃得到,
    // 于是同一个角色在线下/群聊里少了这层理解,显得不像同一个人(Lisa 2026-08-18)
    (window.ReplyPacing ? "\n\n" + window.ReplyPacing.reading() : "") +
    offlineStyleExamplesBlock(ctx.styleExamples, char.name) +
    singleCotBlock +
    "\n\n" + OFFLINE_USER_IS_PRESENT.replace(/USERNAME/g, userName) +
    "\n\n【当前场景：线下面对面】你和" + userName + "此刻身处同一个地方，面对面相处，不是隔着手机聊天。完全代入「" + char.name + "」，人物称谓严格服从本场的【叙事人称】设置。把当前互动写成连续的场景正文。动作、对话、心理、环境与感官都可以自然出现，但只使用这一刻真正需要的部分，不要求齐全，也不为了丰富正文额外安排。保持已经成立的地点、人物位置、物件、状态和事件连续；自然推进，不提前跳到尚未发生的剧情。对话使用引号。" + lenGuide + "。" +
    (ctx.timeAware !== false ? "\n【时间感】你清楚现在的真实时间（见上文），让当下的时段自然渗进场景——天色光线、周围的动静、店家开没开、你此刻该困该饿还是精神，都照这个钟走；别报时刻表，也别把深夜写成白天。" : "") +
    (ctx.roomPrompt ? "\n" + ctx.roomPrompt : "") +
    (styleText ? "\n\n" + window.StylePresets.wrap(styleText) : "") +
    offlineTasteBlock(session.taste, false) +
    narrativeDirective(session.narr) +
    // 字数规则和试写台共用一份（酒馆那套：下限＋上限＋自己数着写）。以前只给下限、
    // 没给上限、也没让它自己数，模型没有目标区间就写到哪算哪（她 2026-08-24）。
    (minimumSceneChars ? "\n" + window.StylePresets.wordRule(minimumSceneChars)
      + "\n· 遇到需要用户本人选择的岔口时，可以在岔口之前充分写完本轮已有内容，但仍不可替用户作重大决定。" : "") +
    (notes.length ? "\n【临时导演提示（务必遵循）】" + notes.join("；") : "") +
    (ctx.curWear ? "\n【着装连贯】你现在穿着：" + ctx.curWear + "。除非场景变了、过了很久、或你明确换/脱了衣服，否则 wearing 保持这套；一旦场景真的换了（如从外面进了家、下了雨淋湿、换了衣服）就据实更新。" : "") +
    (ctx.curCondition ? "\n【身体状态连贯】你现在" + ctx.curCondition + "。这不是背景设定，是此刻真的这样：动作、说话的力气、能不能久站久走都要受它影响；除非剧情里明确好转，别忽然生龙活虎。" : "") +
    (session.priorSummary ? "\n【这场线下的前情提要（早先发生的、已浓缩进记忆，接着往下演，别倒回去逐句重复复述）】\n" + session.priorSummary : "") +
    toyHint +
    offPhotoHint +
    "") + outputSpec + stateBootstrapHint + gazeSpecBlock;
  // v52.77：恢复正常首遍生成；首次跨越后的 scene 再交给同模型做删除优先的受约束编辑。
  // 最终只有编辑稿进入 session history，首遍草稿仅用于本轮内存诊断。
  const hist = offlineHistory(session.msgs, userName, char.name, ctx.timeAware !== false);
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
    ? "\n\n〔本场叙事权限·已开启〕用户明确允许你在 scene 里替 Ta 描写并推动【可观察的】动作、神态、即时反应和说出口的话，让双人场景真正往前发生；不要每一拍都停在原地等用户逐动作确认。可以写『你伸手接过杯子』『你摇头说……』这类内容。不替 Ta 宣布重大决定、长期承诺或内心真实想法。\n【既然授权了，就把这一段演开】不必写完一个来回就停下等她。可以让时间往前走：一句话之后是下一个动作、下一段对话、场景里的变化、甚至过了一会儿，把这一场连着推几拍，写成一段完整往前走的叙事，而不是一问一答的小片段。\n【但必须停的时候要停】走到【真正需要她本人做选择】的岔口就收住——去不去、答不答应、要不要说出那句话，这些是她的，不许替她决定，也别为了写长而硬拖。写到那个岔口，把张力悬在那儿，停。"
    : "\n\n〔本场叙事权限·未开启〕只描写你自己的言行和心理，不要替用户决定动作、反应或台词。";
  const rerollTail = session.rerollAvoid
    ? "\n\"\n\n〔重写〕上一版只是需要避开的候选，不属于已经发生的剧情：『" + offlineRerollExcerpt(session.rerollAvoid) + "』。\n〔重写要换的是【这一拍怎么走】，不是措辞〕上一版把句子写得更细、更长，但事件顺序一模一样，那不算重写。这一次必须至少换掉其中三样：① 从哪儿切入（上一版从哪句起，这次别从那儿起）；② 中间发生的事按什么顺序推进、有没有别的可能；③ 这一拍的重心落在谁身上、落在什么上；④ 停在哪里——上一版收在哪个动作或哪句话，这次不许再收在那儿。\n【尤其是收尾】上一版是怎么收的——不管它收在一句话、一个动作、一个眼神还是一片沉默上——这次都换一种收法：换个落点、换个由谁收、换个把张力留在哪儿。上一版收尾处出现的那些【具体的东西】（人名、地名、时间、物件、吃的、要去做的事），这次一个都别再搬出来。\n【别再用「下一站」收尾】上一版是靠【提出下一步安排】收的（去哪儿、见谁、吃什么、待会儿做什么）。上文行程里写着的事仍然是真的，但【这一拍没有义务以它收尾】——这一次换个停法：停在一个没说完的动作、一句噎回去的话、一个谁都没接的沉默、或者干脆停在她还没回答的时候。\n【交稿前自查】把上一版的最后三句和你这版的最后三句并排看一遍：凡是两边都出现的【具体名词】（地名、人名、吃的、物件、时辰），一个都不许留，全部换掉或删掉。\n保留生成上一版之前已经成立的事实，其余重新决定；同义替换、把同样的事写得更华丽，都不算换。"
    : "";
  const characterSupplyInjected = !isDigital && !!registerTransition.inputBeat && !!registerTransition.active;
  const characterSupplyTail = characterSupplyInjected
    ? "\n\n〔本轮人物连续〕当前互动不会把叙述者替换成一个只处理身体动作的通用角色。继续从这个具体的人对眼前这个具体的人如何注意、判断、选择和回应来生成：承接对方刚刚实际说过或做过的内容，以及两人已经形成的关系和相处方式。共享细节、现实目标或未完事务只有在此刻确实影响其反应时才自然出现，不为证明人设而硬提，也不按清单配额打卡。台词应由此刻的具体回应产生，不用任何角色都能说的通用场面话。身体事实仍按实际发生直接写清；首稿不承担去除渲染或自我审查，后续编辑另行处理。"
    : "";
  const tailNudge = isDigital
    ? userActionTail
    : continueCue + rerollTail + "\n\n〔本轮线下〕保持当前场景、人物位置、物件和状态连续；未知细节不要擅自具体化。按既定叙事准则自然续写，不提前跳到未发生的剧情。" + (cotT ? "先完成正文 JSON，再写既定的创作旁注标记块。" : "");
  // 长文风尾部重申（v55.41）。她那份自定义文风有几千字，夹在通用叙事准则中间会被稀释——
  // 和本文件上面「越写越八股」用的是同一招：把真正要紧的约束放到离生成最近的位置。
  const styleTail = !isDigital && styleText && styleText.length > 200
    ? "\n\n〔再说一遍·文体以用户设定的文风为准〕这一段要照上文那份【文风要求】来写："
      + "句式、意象、比喻用不用、情绪怎么呈现、段落怎么分、哪些词不许出现，全部按它；"
      + "它和通用叙事准则冲突的地方，以它为准。写完扫一眼它的禁区清单再交。"
    : "";
  // 已经讲过的往事摆回它面前（放尾部：这条只有离生成最近才压得住）。数字生命不发。
  const flashbackTail = isDigital ? "" : offlineFlashbackBlock(
    (session.msgs || []).filter(m => m && m.role === "char" && !isOocMsg(m)).map(m => m.content));
  const finalNudge = tailNudge + (isDigital ? "" : userActionTail) + characterSupplyTail + flashbackTail + styleTail;
  if (hist.length && hist[hist.length - 1].role === "user") hist[hist.length - 1] = { role: "user", content: hist[hist.length - 1].content + finalNudge };
  else hist.push({ role: "user", content: "（继续）" + finalNudge });
  if (Array.isArray(session.imageDataUrls) && session.imageDataUrls.length) {
    const lastUser = [...hist].map((m, i) => [m, i]).reverse().find(([m]) => m.role === "user");
    if (lastUser) hist[lastUser[1]] = { ...hist[lastUser[1]], content: hist[lastUser[1]].content + "\n【用户刚展示了真实照片，图像已附在本轮视觉输入中；请直接看图并把反应自然写进当前场景。】", imageDataUrls: session.imageDataUrls.slice(-2) };
  }
  let raw;
  let usedCot = !!cotT;
  // 单次自修会同时输出 draftScene 与 scene，所需容量约为普通生成的两倍；
  // 不能让 4000 tok 默认上限先把“最低 1500 字”截断。
  // ⭐max_tokens 是【天花板】不是预付款：给大了不多花一分钱，给小了才要命——
  // 思考模型的推理 token 也算在里面，压小了推理吃完，正文只剩两百来字
  //（她 2026-08-24 拿酒馆对比出来的：Ako 预设里 openai_max_tokens 就是 65535）。
  // 控制篇幅的活儿交给上面【字数】里的上限，不是拿额度去掐。
  const minimumTokenBudget = minimumSceneChars
    ? window.StylePresets.outTokens(minimumSceneChars * (singlePassRevisionRequested ? 2 : 1))
    : 0;
  // 8000 是地板不是上限：她的拉条默认 4000，配上思考型模型，推理吃完就只剩几百字正文。
  // 拉条想往上拉照样有效（最高 24000），只是不许把天花板压到会截断的高度。
  const generationMaxTokens = Math.min(window.StylePresets.OUT_CEILING,
    Math.max(Number(session.maxTokens) || 4000, 8000, minimumTokenBudget));
  // 能流式就流式：非流式的大请求两三分钟不吐一个字节，Cloudflare/网关会把它当死连接
  // 掐掉，浏览器只报一句 Load failed；流式一开始就有字节流出，连接活着。
  // ⚠️但发不出流式时【不再压 max_tokens】（v55.62）：压额度并不缩短生成时间——
  // 一段 1500 字的正文，额度给 4200 还是 16000，模型吐字的秒数是一样的，
  // 压的只是「会不会被截断」。真正管住时长的是【字数】里的上限。
  // 以前压到 4200 换来的是思考模型被推理吃光额度、正文只剩两百字，得靠补写找补。
  const canStream = routeCanStream(p);
  const generationBudget = generationMaxTokens;
  const wantStreamOffline = canStream && generationBudget >= 3000;
  // 线下也给思考链（v56.75，她 2026-08-27）：和单聊同一个每角色开关，同一套 meta 出参。
  // 言秋那条线一个字都不碰——ctx.notRoleplay 的角色 app 侧压根不会把 wantReasoning 传进来。
  const _reasonMeta = {};
  const _wantReason = !isDigital && !!ctx.wantReasoning;
  try {
    raw = await callAI(p, system, hist, {
      maxTokens: generationBudget,
      stream: wantStreamOffline,
      timeout: 180000,
      wantReasoning: _wantReason,
      meta: _reasonMeta,
      wireScope: "offline",
      wireMeta: {
        charId: char.id,
        sessionId: session.id || null,
        transitionBefore: !!registerTransition.before,
        transitionAfter: !!registerTransition.after,
        calibrationInjected: false,
        factIsolationApplied: false,
        rewriteStage: false,
        registerInputBeat: !!registerTransition.inputBeat,
        registerActive: !!registerTransition.active,
        characterSupplyInjected,
        archetypePerformanceRisk,
        archetypeRevisionRequested,
        rewriteRequested,
        mood: ctx.moodLabel || null,
        wearing: ctx.curWear || null,
        action: ctx.curAction || null,
        priorSummary: session.priorSummary || null,
        memoryCount: Array.isArray(ctx.memLib) ? ctx.memLib.length : null,
        styleExamples: Array.isArray(ctx.styleExamples) ? ctx.styleExamples.length : null,
        taste: session.taste || null,
        reroll: !!session.rerollAvoid
      }
    });
  } catch (e) {
    if (!cotT || !isOfflineEmptyStop(e)) throw e;
    rememberOfflineSingleNoCotV2Model(cotModelKey);
    const plainSystem = system.replace(singleCotBlock, "");
    const plainHist = hist.map((m, i) => i === hist.length - 1
      ? { ...m, content: String(m.content || "").replace("先完成正文 JSON，再写既定的创作旁注标记块。", "").replace(/；[④⑤](?:cot 字段必填，先想后写|先写创作小稿标记块，再写正文 JSON)。/g, "；") }
      : m);
    raw = await callAI(p, plainSystem, plainHist, { maxTokens: generationBudget, stream: wantStreamOffline, timeout: 180000, wantReasoning: _wantReason, meta: _reasonMeta, wireScope: "offline", wireMeta: { charId: char.id, sessionId: session.id || null, cotFallback: true } });
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
  const draftScene = String(singlePassRevisionRequested ? parsed.draftScene : (parsed.scene || sp.clean || "")).trim();
  if (!draftScene) throw new Error("模型没有返回有效的线下正文，请重试");
  const singlePassFinalScene = singlePassRevisionRequested ? String(parsed.scene || "").trim() : "";
  if (singlePassRevisionRequested && !singlePassFinalScene) throw new Error("模型没有完成单次响应内的终稿自修，请重试");
  // 预检只能看见 user/history。角色可能在本轮首稿里自行跨越，因此草稿形成后必须再检一次；
  // 否则最需要编辑的第一条会以 false→false 直接漏进 history。
  const draftExplicit = !isDigital && offlineRegisterExplicitText(draftScene);
  const effectiveRegisterActive = !isDigital && (!!registerTransition.active || draftExplicit);
  const effectiveTransitionAfter = !isDigital && (!!registerTransition.after || draftExplicit);
  if (!isDigital && registerTransition.inputBeat && effectiveRegisterActive) rewriteRequested = true;
  let scene = singlePassRevisionRequested ? singlePassFinalScene : draftScene;
  // 回声式反问兜底（v55.66）：提示词压不住就上刀。isDigital 是言秋那条专线，不碰。
  if (!isDigital) {
    const lastSaid = lastUserTurnText(session.msgs);
    if (lastSaid) scene = stripEchoQuestionScene(scene, lastSaid);
  }
  let rewriteApplied = !!singlePassRevisionRequested;
  // ⭐一轮就是一次调用（她 2026-08-24：「我永远只要一次」）。以前这里会再发一到两次
  // 补写请求去凑最低字数——她按次计费，那是拿她的钱补我 prompt 没写好的窟窿。
  // 现在靠【字数】规则 + 给足的 max_tokens 一次写够；真没写够就照实报，正文一律照留。
  const minimumLengthChars = offlineVisibleCharCount(scene);
  const minimumShort = minimumSceneChars && minimumLengthChars < minimumSceneChars;
  let rewriteLengthRatio = 1;
  let rewriteFactUnits = 0;
  let rewriteCoveredFactUnits = 0;
  let rewriteFactCoverage = 1;
  let rewriteCharacterUnits = 0;
  let rewriteCoveredCharacterUnits = 0;
  let rewriteCharacterCoverage = 1;
  let rewriteOpCounts = null;
  const rendererScoreBefore = offlineRendererScore(draftScene);
  let rendererScoreAfter = offlineRendererScore(scene);
  const rendererRepeatsBefore = offlineRepeatedDimensionCount(draftScene);
  let rendererRepeatsAfter = offlineRepeatedDimensionCount(scene);
  if (singlePassRevisionRequested) rewriteLengthRatio = draftScene.length ? scene.length / draftScene.length : 1;
  const affinityDelta = Number.isFinite(parsed.affinityDelta) ? Math.max(-5, Math.min(5, parsed.affinityDelta)) : 0;
  if (_wantReason && !_reasonMeta.reasoning) {
    const _fromBody = reasoningFromBody(raw);
    if (_fromBody) { _reasonMeta.reasoning = _fromBody; _reasonMeta.from = "正文 <thinking>"; }
  }
  return {
    scene,
    reasoning: _reasonMeta.reasoning || "",
    reasonMs: _reasonMeta.ms || 0,
    reasonModel: _reasonMeta.model || "",
    reasonFrom: _reasonMeta.from || "",
    cot: sp.cot,
    // 开关开启就保留入口；保险回退或模型漏掉标记时明确显示“本轮未返回”，不整行消失。
    cotRequested: !!requestedCotT,
    registerTransitionBefore: !!registerTransition.before,
    registerTransitionAfter: !!effectiveTransitionAfter,
    registerCalibrationInjected: false,
    factIsolationApplied: false,
    registerInputBeat: !!registerTransition.inputBeat,
    registerPreflightActive: !!registerTransition.active,
    registerActive: !!effectiveRegisterActive,
    characterSupplyInjected,
    archetypePerformanceRisk,
    archetypeRevisionRequested,
    rewriteRequested,
    rewriteApplied,
    singlePassRevisionRequested,
    singlePassRevisionApplied: !!singlePassRevisionRequested,
    rewriteDraftChars: draftScene.length,
    rewriteFinalChars: scene.length,
    minimumLengthTarget: minimumSceneChars,
    minimumLengthChars,
    minimumLengthShortBecause: minimumShort ? "模型就写了这么多，这一轮只调一次 API、没有再补写" : "",
    minimumLengthShortCount: minimumShort ? minimumLengthChars : 0,
    minimumLengthShortTarget: minimumShort ? minimumSceneChars : 0,
    minimumLengthSatisfied: !minimumSceneChars || minimumLengthChars >= minimumSceneChars,
    rewriteLengthRatio,
    rendererScoreBefore,
    rendererScoreAfter,
    rendererRepeatsBefore,
    rendererRepeatsAfter,
    rewriteFactUnits,
    rewriteCoveredFactUnits,
    rewriteFactCoverage,
    rewriteCharacterUnits,
    rewriteCoveredCharacterUnits,
    rewriteCharacterCoverage,
    rewriteOpCounts,
    rewriteDraft: rewriteApplied ? draftScene : null,
    thought: cln(parsed.thought),
    impression: (parsed.impression && typeof parsed.impression === "object") ? parsed.impression : null,
    // ⚠️这一头是【白名单】：不写在这儿的字段，模型填了也会被原样丢掉。
    // v58.100 线下补 photoSeen 时就栽在这——提示词发出去了、回来的答案没人接。
    photoSeen: (parsed.photoSeen && typeof parsed.photoSeen === "object") ? parsed.photoSeen : null,
    impressionChecked: cln(parsed.impressionChecked),
    mood: parsed.mood && parsed.mood.label ? parsed.mood : null,
    wearing: cln(parsed.wearing),
    action: cln(parsed.action),
    affinityDelta,
    toy: (session.toyOn && parsed.toy && typeof parsed.toy === "object") ? parsed.toy : null,
    // 线下拍下的那一格。kind 由 app 再核一遍（duo 要两张参考照都在才作数）。
    photo: (session.photoOn && parsed.photo && typeof parsed.photo === "object" && String(parsed.photo.scene || "").trim())
      ? { kind: String(parsed.photo.kind || "self"), scene: String(parsed.photo.scene).trim() } : null
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
  const raw = await callAI(p, system, [{ role: "user", content: "【线下经过】\n" + text }], { maxTokens: 12000 });
  const d = extractJSON(raw);
  if (d && d.summary) return { summary: String(d.summary).trim(), details: (Array.isArray(d.details) ? d.details : []).map(x => String(x).trim()).filter(Boolean).slice(0, 6), open: (Array.isArray(d.open) ? d.open : []).map(x => String(x).trim()).filter(Boolean).slice(0, 3) };
  return { summary: String(raw || "").trim(), details: [], open: [] };
}
// ------- 群聊线下模式（多角色同处一地的面对面叙事）-------
// 把群聊线下 msgs 映射成 API 对话：char beat 归 assistant（带发言人名），narration/user 归 user，合并连发
function offlineGroupHistory(msgs, userName, clock) {
  const g = [];
  let prevTs = 0;
  (msgs || []).forEach(m => {
    if (m.kind === "ooc") return; // OOC 不进角色扮演上下文
    const ts = Number(m.ts) || 0;
    const gap = prevTs && ts && ts - prevTs > 90 * 60000
      ? "〔—— 中间隔了约 " + gapPhrase(ts - prevTs) + (clock === false ? "" : "，到 " + fmtStampAI(ts)) + " ——〕\n"
      : "";
    const stamp = (ts && clock !== false) ? "〔" + fmtStampAI(ts) + "〕" : "";
    if (m.role === "char") {
      // 拍下来的那一格（和单人线下同一个落法）：说明已经拍过了，别再原样拍一张。
      const shot = m.kind === "selfie"
        ? (m.failed ? "【这里试着拍了一张，但图没出来】"
          : "【已经实际拍下一张" + (m.photoKind === "group" ? "在场几个人的合影" : m.photoKind === "duo" ? "TA 和" + userName + "的合照" : m.photoKind === "other" ? userName + "替 TA 拍的照片" : "自拍") + "，别说没拍过、也别马上原样再拍一张】" + (m.desc ? "画面：" + m.desc : ""))
        : "";
      const c = gap + stamp + (m.senderName ? m.senderName + "：" : "") + (shot || m.content || "");
      const l = g[g.length - 1];
      if (l && l.role === "assistant") l.content += "\n" + c; else g.push({ role: "assistant", content: c });
    } else {
      const raw = m.content || "";
      const dateAnchor = (clock !== false && window.TemporalAnchor) ? window.TemporalAnchor.anchor(raw, m.ts) : "";
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
  const styleText = offlineResolveStyleText(session, { uName: userName, charName: (members[0] && members[0].name) || "在场角色" });
  const notes = (session.customNotes || []).map(n => typeof n === "string" ? n : (n && Number(n.remaining) > 0 ? n.text : "")).filter(Boolean);
  const cotModelKey = offlineCotModelKey(p);
  const cotT = loadOfflineNoCotModels().includes(cotModelKey) ? "" : cotThink({ char: members.map(c => c.name).join("、") || "在场角色", user: userName });
  // 预算按【真角色】人数分：配角不参与平分，也别把主角色的额度吃掉
  const gPersonaCap = groupPersonaBudget(members.filter(c => !c.npc).length);
  // NPC 是只在群里出场的配角：没有心情、好感、印象卡、长出来的自我、年龄、行程、
  // 情侣状态——那些都是「这个主角色是谁」的层。（她 2026-08-25 拍板，同群线上）
  const memberDesc = members.map(c => c.npc
    ? "【" + c.name + "】" + groupPersonaText(c.persona, NPC_PERSONA_CAP)
      + ((ctx.npcOwnerName && ctx.npcOwnerName[c.id]) ? "\n〔这是 " + ctx.npcOwnerName[c.id] + " 身边的人，只在群里出场〕" : "")
    : "【" + c.name + "】" + groupPersonaText(c.persona, gPersonaCap)
    + ((ctx.memberGrown && ctx.memberGrown[c.id]) ? "\n〔" + c.name + " 长出来的自我（这段日子经历沉淀下来的、是 TA 当下真实的一部分，自然体现在言行里，别当台词复述）〕\n" + ctx.memberGrown[c.id] : "")
    // 「四处一样喂」：心情/好感单聊一直有，群线下以前一层都没有
    + ((ctx.memberMood && ctx.memberMood[c.id]) ? "\n〔此刻心情〕" + ctx.memberMood[c.id] : "")
    + ((ctx.memberAff && ctx.memberAff[c.id] != null) ? "\n〔对 " + userName + " 的好感〕" + ctx.memberAff[c.id] + "/100" : "")
    // 「四处一样喂」第二轮（她 2026-08-25「还是很霸总」）：年龄／此刻在做什么／和用户的关系状态，
    // 单聊一直有、群里一层都没有。关系状态是这位成员的私事，跟印象卡同档走隐私围栏。
    + ((ctx.memberAge && ctx.memberAge[c.id]) ? "\n〔你现在〕" + ctx.memberAge[c.id] : "")
    + ((ctx.memberSched && ctx.memberSched[c.id]) ? "\n〔今天此刻在做什么〕" + ctx.memberSched[c.id] + "（自然渗进状态，别报行程表）" : "")
    + ((ctx.memberCarry && ctx.memberCarry[c.id]) ? "\n〔你身上带着的 / 你衣柜里的（真有的东西，用得上就掏得出来；别没事报清单）〕\n" + ctx.memberCarry[c.id] : "")
    + ((ctx.memberGaze && ctx.memberGaze[c.id]) ? "\n〔以下只有 " + c.name + " 本人知道，别的成员并不知情〕\n" + ctx.memberGaze[c.id] : "")
    + ((ctx.memberCouple && ctx.memberCouple[c.id]) ? "\n〔以下只有 " + c.name + " 本人知道，别的成员并不知情〕" + ctx.memberCouple[c.id] : "")
    + ((ctx.memberCoupleArchive && ctx.memberCoupleArchive[c.id]) ? "\n〔以下只有 " + c.name + " 本人知道，别的成员并不知情〕\n" + coupleArchiveBlock(ctx.memberCoupleArchive[c.id], userName) : "")
  ).join("\n\n");
  // 群里每人最多一段、整场最多四人有范例，避免多人场景为文风样本挤爆上下文。
  const memberExampleText = members.map(c => offlineStyleExamplesBlock(ctx.memberStyleExamples && ctx.memberStyleExamples[c.id], c.name, 1)).filter(Boolean).slice(0, 4).join("");
  // B（v50.79）：群线下里开启成长的成员，加一条只针对他们的成长准则（软层可长、硬核不动）；其余成员照旧贴合原卡。
  const evolveNames = (ctx.memberEvolve || []).map(id => { const c = members.find(x => x.id === id); return c ? c.name : null; }).filter(Boolean);
  const groupGrowthRule = evolveNames.length ? "\n\n【这些成员会成长·不冻在原卡里：" + evolveNames.join("、") + "】\n他们的人设卡是【起点和底色】不是牢笼：硬核（身份／世界观／说话底色／明确边界／真实发生过的重要经历）绝不因几轮相处被改写或软化；但软层（和用户亲近的方式／处理冲突闹别扭的习惯／偏好／勇气／信任／对未来怎么选）允许被各自『长出来的自我』推着长成新样子。只有【已沉淀成正式长出来的自我（那段『长出来的自我』）】的成长才算数、才可盖过原卡软倾向；最近几轮的经历只能让 TA 当下松动、不等于人格已永久改变。冲突时：明确硬设定与边界 ＞ 已固化的成长 ＞ 原卡软倾向 ＞ 通用默认。**其余在场成员照旧严格贴合各自原卡、不适用本条。**" : "";
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
    const awareMembers = members.filter(c => !ctx.memberTimeAware || ctx.memberTimeAware[c.id] !== false);
    const tzLines = awareMembers.map(c => {
      if (c.tz === undefined || c.tz === null || String(c.tz).trim() === "") return "";
      const off = parseFloat(c.tz); if (isNaN(off)) return "";
      const local = new Date(now.getTime() + off * 3600000);
      return "· " + c.name + "（UTC" + (off >= 0 ? "+" + off : off) + "）当地约 " + local.toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
    }).filter(Boolean);
    if (tzLines.length) timeBlock += "\n（在场有人处在别的时区，各自按自己那边的钟和作息想事情、说话）\n" + tzLines.join("\n");
    timeBlock += "\n只有「" + awareMembers.map(c => c.name).join("、") + "」开启了时间感知，可让当下时段自然渗进状态；其余成员不得根据现实钟或行程调整表现。别报时刻表。";
  }
  // 规矩层收进 groupBans（v60.39）：三处群共用一份，以后加一层只改那儿。
  // echo=true 是这次顺带补的——群线下原来【只有代码那一道削回声】，
  // 提示词那一层从来没给过（v55.66 补的是单人线下那一处，群线下没跟上）。
  const system =
    groupBans({ narrative: true, mood: true, echo: true, worldbook: !!(ctx.worldbook && ctx.worldbook.trim()) }) +
    groupGrowthRule +
    timeBlock +
    "\n\n【在场角色】\n" + memberDesc +
    memberExampleText +
    (ctx.profile && (ctx.profile.name || ctx.profile.persona) ? "\n\n【用户「" + userName + "」的设定】\n" + (ctx.profile.persona || "（未填写）") : "") +
    // 她想要什么（四处一样喂）：用户的信息，群里共享一份
    (ctx.wishLog && ctx.wishLog.trim() ? "\n\n【" + userName + " 最近看上但没买的东西】（她在购物 app 里点了「想要」，在场的人都可能知道。记得比送重要——聊到相关的东西时想得起来「她惦记这个」就够了；绝不是每轮都该送，也别几个人抢着送，更别把这张单子念出来。）\n" + ctx.wishLog.trim() : "") +
    "\n\n【在场角色间的关系（有方向）】\n" + relLines +
    (gDirs.length ? "\n\n【用户立下的长期规矩（高优先·在场所有角色务必遵守）】\n这些是用户明确要求的准则，优先级高于一般演绎习惯；在不违背各自核心人设的前提下务必遵守：\n" + gDirs.map((s, i) => (i + 1) + ". " + s.trim()).join("\n") : "") +
    (ctx.worldbook && ctx.worldbook.trim() ? "\n\n【世界书】\n" + ctx.worldbook.trim() : "") +
    (memLibText && memLibText.trim() ? "\n\n【记忆库·相关条目（请自然记住并保持一致）】\n" + memLibText.trim() + "\n⚠️这些是【背景】、不是照演的剧本：记住只为连贯，别复刻里头的具体事——别每次都做同一道菜／说同一句招牌话／重复同一个动作。生活往前走，这一刻要有新的具体。" : "") +
    (onlinePrelude ? "\n\n【刚刚在线上群聊的最后几句·入场衔接】\n" + onlinePrelude + "\n现在大家从线上转到线下面对面。上面的话真实发生过、所有在场成员都知道；从它自然接入当前场景，但不要逐句复述，也不要假装这些话刚在线下又说了一遍。" : "") +
    (session.priorSummary ? "\n\n【这场群线下的前情提要（早先发生的、已浓缩，接着往下演，别倒回去逐句重复复述）】\n" + session.priorSummary : "") +
    ((Array.isArray(ctx.memberRecent) && ctx.memberRecent.length)
      ? "\n\n【各成员最近在别处（和用户的私聊 / 单人线下）发生的事·带时间戳】\n下面是每个成员最近单独和用户之间发生的事，按方括号里的真实时间理解它和此刻这场线下的先后顺序，自然接得上——比如某成员昨晚私聊里答应过的事、刚在单人线下经历的情绪，别当没发生过、也别和这些矛盾。\n⚠️隐私铁律：这些是【该成员和用户之间私下】的事，标〔仅本人知道〕——别的成员并不知情。绝不许让别的成员在群线下里提及、点破、或据此反应（吃醋/拆穿/打趣），除非本人自己在场景里说出来。\n" + PRIVATE_IS_BACKGROUND_NOT_AMMO + "\n" + ctx.memberRecent.map(mr => "〔仅「" + mr.name + "」本人知道〕\n" + mr.lines).join("\n\n")
      : "") +
    "\n\n" + OFFLINE_USER_IS_PRESENT.replace(/USERNAME/g, userName) +
    "\n\n【当前场景：线下面对面 · 多人同处】用户和上述角色此刻身处同一个地方，面对面相处（不是隔着手机的群聊）。以沉浸的第三人称叙事推进这一刻；动作、神态、心理、环境与对话都是可用镜头，不是每个 beat 必须交齐的栏目。多个角色会自然地行动、开口、互相接话、跑题调侃或起冲突，像真实的多人相处那样，不是轮流回答用户；没有反应必要的人可以安静在场。称用户为『你』。对话用引号包住。自然推进、不出戏、不提前跳到未发生的剧情。" +
    (styleText ? "\n\n" + window.StylePresets.wrap(styleText) : "") +
    offlineTasteBlock(session.taste, true) +
    narrativeDirective(session.narr) +
    // 和单人线下、试写台共用同一份【字数】规则（酒馆那套：下限＋上限＋自己数着写）
    (session.minWords ? "\n" + window.StylePresets.wordRule(session.minWords)
      + "\n· 这个字数是【整段所有 beat 加起来】的量，不是每个 beat 各写这么多。" : "") +
    (notes.length ? "\n【临时导演提示（务必遵循）】" + notes.join("；") : "") +
    // 群线下拍照（四处一样喂：单人线下有的，群线下也得有）。app 侧算好谁能拍、
    // 谁能合照、够不够人拍多人合影。
    ((session.photoMembers || []).length
      ? "\n" + offlinePhotoHint(userName, "", (session.photoDuoMembers || []).length > 0, true)
        + "\n【谁能拍】只有这几位能填 photo：" + (session.photoMembers || []).join("、") + "。"
        + ((session.photoDuoMembers || []).length ? "其中能和 " + userName + " 合照（duo）的只有：" + (session.photoDuoMembers || []).join("、") + "。" : "")
        + (session.photoGroupOk ? "另有 **group**＝在场几个人一起拍的合影（每个人的脸都拿各自参考照锁住）——大家正好凑在一处、有人起哄拍一张、或聊到「我们几个」时用它；只有一个人在场时不许用。" : "")
        + "整轮最多一个 beat 带 photo，别每个人都拍。"
      : "") +
    cotSystemBlock(cotT) +
    "\n【输出】只输出一个 JSON，不要代码块：\n{\"beats\":[{\"name\":\"这一段里行动或说话的角色名；纯环境旁白填『旁白』\",\"scene\":\"这一段叙事正文（第三人称，含动作/神态/对话）\",\"thought\":\"（仅角色 beat，可选）该角色此刻没说出口的真实心声\",\"mood\":{\"label\":\"此刻中文心情词（禁止英文内部标签）\"},\"affinityDelta\":\"（仅角色 beat）整数-5到5，这段相处让该角色对用户的好感如何变化，通常小幅、没波动就0\",\"impression\":\"（仅角色 beat，可选）{'side':'me|us','block':'me侧:person/soft/like/recent/unread；us侧:what/how/marks/elephant/want','text':'整块重写≤80字'}——仅当这一段真正改变了该角色对用户或他俩关系的某一块长期认知才填，极少发生；第一人称亲笔、锚在刚发生的事上、在旧认知上小幅演进\"" + ((session.photoMembers || []).length ? ",\"photo\":\"（仅角色 beat，可选）这一拍真拍了照片才填 {'kind':'self|other" + ((session.photoDuoMembers || []).length ? "|duo" : "") + (session.photoGroupOk ? "|group" : "") + "','scene':'这一格拍到了什么'}，没拍就整个省略\"" : "") + "}]}\n一次产出 2~5 个 beat，让在场角色轮流有戏、互相有来有往；name 必须逐字填写以下名字之一：" + members.map(c => "『" + c.name + "』").join("、") + "；只有不属于任何人的纯环境段才填『旁白』，不许把整篇都塞进一个旁白 beat。";
  const hist = offlineGroupHistory(session.msgs, userName, ctx.timeAware !== false);
  // 尾部重申（同单人线下）：治长对话后段八股回潮 + cot 丢失
  const gWantLong = session.minWords && session.minWords >= 150;
  // max_tokens 是天花板不是预付款；思考模型的推理也从这儿扣，给窄了正文就只剩个零头
  const gBudget = Math.min(window.StylePresets.OUT_CEILING,
    Math.max(Number(session.maxTokens) || 1900, session.minWords ? window.StylePresets.outTokens(session.minWords) : 0));
  const gContinueCue = session.autonomousContinue && window.OfflineContinuation ? window.OfflineContinuation.cue(true) : "";
  const gTail = gContinueCue + (session.rerollAvoid ? "\n\n〔★这是【重写】，不是续写：上一次这一段写的是「" + offlineRerollExcerpt(session.rerollAvoid) + "」——这次【必须给一个明显不同的版本】：换不同的开头、动作、语气、由谁开口、侧重或走向。\n把同一串事写得更细、更长、更华丽，也不算换——要换的是【这一段怎么走】：从哪儿起、中间按什么顺序推进、重心落在谁身上、停在哪里。\n收尾同理：上一版怎么收的（不管收在一句话、一个动作还是一片沉默上）这次换一种收法，它收尾处出现的那些具体的东西（人名、地名、物件、要去做的事）一个都别再搬出来。\n上一版若是靠【提出下一步安排】收的（去哪儿、见谁、吃什么），这次换个停法——行程里的事仍然是真的，但这一段没有义务以它收尾。\n交稿前把两版的最后几句并排看：两边都出现的具体名词（地名、人名、吃的、物件）一个都不许留。\n绝不许把原来那版换几个近义词又交上来。〕" : "") + "\n\n〔幕后提醒，绝不出现在正文里：【★场景一致·别乱编物件·最优先】桌上在吃/喝什么、身边有什么东西、身处什么地方，一律以【前文已经写过的】为准——前文只有排骨汤，就只有排骨汤，绝不凭空冒出前文没出现过的具体物件（和牛/菌菇/红酒之类）；每个成员写的东西也要和别人已经写过的对得上；记不清就模糊带过（『碗里的汤』『面前的菜』），别硬编一个新的具体名字。①【比喻限额·最要紧】整段【最多出现一次「像/仿佛/如同/像是/宛如」的比喻】，只在真能让画面更具体时才用；其余一律直白写字面发生了什么——绝不给每个动作/眼神/声音都套比喻（禁『像一把冰锥』『像被雨水洗过的天空』『像失而复得的珍宝』『眼神像一潭深水』这类），【尤其禁把人比成动物】（像只大型犬/猫科动物/幼兽/小兽一律不许），也禁往颈窝/怀里『蹭/蹭了蹭』；『眸/眸子/瞳仁』一律写『眼睛』，别给人贴『洞穿一切的清醒』『毫不掩饰的欢喜』这种抽象情绪结论；②反陈词滥调清单全程生效——禁通用小动作（挑眉/勾唇/垂眸/轻笑/喉结滚动）和空转大词；写到亲密/情欲时八股最凶：上面的用词禁令表、「别把身体写成机器」、「别套通用情欲模板动作」照样守死；③各角色声纹别互相同化，这一轮的句式/意象/开头不许和上一轮雷同；④" + (gWantLong ? "写够上面要求的篇幅，把这几个 beat 写足写透，别注水也别偷懒写短" : "宁可短而准，别长而油") + "；" + (cotT ? "⑤先写创作小稿标记块，再写正文 JSON。" : "") + (notes.length ? "⑥本轮短期导演提示必须实际落实：" + notes.join("；") + "。" : "") + "〕";
  // 群线下同理：回忆是最便宜的填充，人多了只会更容易各自翻各自的老账
  const gFlashbackTail = offlineFlashbackBlock(
    (session.msgs || []).filter(m => m && m.role === "char" && m.kind !== "ooc").map(m => m.content));
  if (hist.length && hist[hist.length - 1].role === "user") hist[hist.length - 1] = { role: "user", content: hist[hist.length - 1].content + gFlashbackTail + gTail };
  else hist.push({ role: "user", content: "（继续）" + gFlashbackTail + gTail });
  if (Array.isArray(session.imageDataUrls) && session.imageDataUrls.length) {
    const lastUser = [...hist].map((m, i) => [m, i]).reverse().find(([m]) => m.role === "user");
    if (lastUser) hist[lastUser[1]] = { ...hist[lastUser[1]], content: hist[lastUser[1]].content + "\n【用户刚给在场所有人展示了真实照片，图像已附在本轮视觉输入中；请让大家直接看图后自然反应。】", imageDataUrls: session.imageDataUrls.slice(-2) };
  }
  let raw;
  let usedCot = !!cotT;
  // 思考链（v56.75）：和单人线下同一套 meta 出参；整批只想一次，挂在第一个 beat 上
  const _reasonMeta = {};
  const _wantReason = !!ctx.wantReasoning;
  try {
    raw = await callAI(p, system, hist, { maxTokens: gBudget, timeout: 180000, wantReasoning: _wantReason, meta: _reasonMeta });
  } catch (e) {
    // 部分原生推理模型会把整次输出留在隐藏/显式思考区，随后 stop 却不给正文。
    // 仅在「启用了显式 cot + 正常 stop 空正文」这个窄条件下，无 cot 重试一次并按模型记忆；以后不再白付第一次。
    if (!cotT || !isOfflineEmptyStop(e)) throw e;
    rememberOfflineNoCotModel(cotModelKey);
    const plainSystem = system.replace(cotSystemBlock(cotT), "");
    const plainHist = hist.map((m, i) => i === hist.length - 1
      ? { ...m, content: String(m.content || "").replace(/；[④⑤](?:cot 字段必填，先想后写|先写创作小稿标记块，再写正文 JSON)。/g, "；") }
      : m);
    raw = await callAI(p, plainSystem, plainHist, { maxTokens: gBudget, timeout: 180000, wantReasoning: _wantReason, meta: _reasonMeta });
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
      impression: (spk && b.impression && typeof b.impression === "object") ? b.impression : null,
      affinityDelta: spk && typeof b.affinityDelta === "number" ? b.affinityDelta : 0,
      // 这一拍拍下的那一格。kind 由 app 再核一遍（谁能拍、够不够参考照都在那边算）。
      photo: (spk && b.photo && typeof b.photo === "object" && String(b.photo.scene || "").trim())
        ? { kind: String(b.photo.kind || "self"), scene: String(b.photo.scene).trim() } : null
    };
  }).filter(b => b.scene);
  // 回声式反问兜底：只削【第一个角色 beat】开头那一声——后面的 beat 是别人在接话，
  // 那些反问不是冲着她刚说的那句来的，不能一并当回声删掉。
  const gLastSaid = lastUserTurnText(session.msgs);
  if (gLastSaid) {
    const firstChar = out.findIndex(b => b.role === "char");
    if (firstChar >= 0) out[firstChar].scene = stripEchoQuestionScene(out[firstChar].scene, gLastSaid);
  }
  // 群聊线下：整批只想一次，把这次思考挂在第一个 beat 上（供「看TA怎么想的」展开）
  if (out.length && sp.cot) out[0].cot = sp.cot;
  if (out.length && cotT) out[0].cotRequested = true;
  if (_wantReason && !_reasonMeta.reasoning) {
    const _fromBody = reasoningFromBody(raw);
    if (_fromBody) { _reasonMeta.reasoning = _fromBody; _reasonMeta.from = "正文 <thinking>"; }
  }
  if (out.length && _reasonMeta.reasoning) {
    out[0].reasoning = _reasonMeta.reasoning;
    out[0].reasonMs = _reasonMeta.ms || 0;
    out[0].reasonModel = _reasonMeta.model || "";
    out[0].reasonFrom = _reasonMeta.from || "";
  }
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
  const raw = await callAI(p, system, [{ role: "user", content: "【线下经过】\n" + text }], { maxTokens: 12000 });
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
// 生日填了【年份】才算得出年龄；只写「3-15」的（大多数古风/架空角色）不显示年龄。
// 年龄一律【现算】不存盘——存了就要在生日当天去改它，那正是她不想手动做的事
//（她 2026-08-24：「过了生日之后这个数字可以自动变大…不用我自己手动进去调」）。
function parseBirthDate(s) {
  const m = String(s || "").match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1000 || y > 9999) return null;
  return { y: y, mo: mo, d: d };
}
// 周岁：生日当天就算长一岁
function charAge(birthday, now) {
  const n = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
  if (isNaN(n.getTime())) return null;
  let b = parseBirthDate(birthday);
  // 农历生日写了年份的（如「农历1998年腊月廿三」）：先换成那一天的公历，再照常算周岁
  if (!b && typeof parseLunarBirthday === "function") {
    const lu = parseLunarBirthday(birthday);
    if (lu && lu.y && typeof lunarToSolar === "function") {
      const sd = lunarToSolar(lu.y, lu.m, lu.d, lu.isLeap);
      if (sd) b = { y: sd.getFullYear(), mo: sd.getMonth() + 1, d: sd.getDate() };
    }
  }
  if (!b) return null;
  const mo = n.getMonth() + 1, d = n.getDate();
  let age = n.getFullYear() - b.y;
  if (mo < b.mo || (mo === b.mo && d < b.d)) age--;
  return age >= 0 && age <= 200 ? age : null;
}
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
// ── 农历 → 公历（她 2026-08-24：「王爷腊月廿三的生日填了农历可以换成新历两个都显示」）──
// 上面只有公历→农历，反向没有。查表法同一张表，从农历年正月初一往后数天数。
// 闰月排在同名月【之后】：闰四月在四月和五月之间。
function lunarNewYearUTC(y) {
  let offset = 0;
  for (let i = 1900; i < y; i++) offset += lunarYearDays(i);
  return Date.UTC(1900, 0, 31) + offset * 86400000;
}
// 农历 y 年 m 月 d 日（isLeap=闰月）→ 公历 Date（本地零点）；不合法返回 null
function lunarToSolar(y, m, d, isLeap) {
  if (!(y >= 1901 && y <= 2099) || !(m >= 1 && m <= 12) || !(d >= 1)) return null;
  const leap = lunarLeapMonth(y);
  if (isLeap && leap !== m) return null;            // 那一年这个月没闰
  const max = isLeap ? lunarLeapDays(y) : lunarMonthDays(y, m);
  if (d > max) return null;                          // 农历月只有 29 或 30 天
  let days = 0;
  for (let i = 1; i < m; i++) {
    days += lunarMonthDays(y, i);
    if (leap === i) days += lunarLeapDays(y);
  }
  if (isLeap) days += lunarMonthDays(y, m);
  days += d - 1;
  const t = new Date(lunarNewYearUTC(y) + days * 86400000);
  return new Date(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}
// 月历格子里那行农历小字（v56.31）：初一那天写月名（七月/腊月），其余写日名（初二…三十）。
// 有农历节日就直接写节日名——和苹果日历一样，那天最值得说的就是它。
// ⚠️不叫 lunarDayLabel：下面早就有一个同名函数（吃日号、返回「廿三」这种），
// 函数声明后来者覆盖先来者，重名会把那个悄悄换掉。日名日名直接复用它。
function calLunarCell(dateObj) {
  try {
    const f = typeof lunarFestivalOn === "function" ? lunarFestivalOn(dateObj) : null;
    if (f) return { text: f, hi: true };
    const l = solarToLunar(dateObj);
    if (!l) return { text: "", hi: false };
    if (l.d === 1) return { text: (l.isLeap ? "闰" : "") + (LUNAR_MON_LABEL[l.m] || ""), hi: true };
    return { text: lunarDayLabel(l.d) || "", hi: false };
  } catch (e) { return { text: "", hi: false }; }
}
// 中文月日：正月/冬月/腊月、初一/十五/廿三/三十 这些都要认
const LUNAR_MON_ZH = { "正": 1, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10, "冬": 11, "十一": 11, "腊": 12, "十二": 12 };
function lunarDayFromZh(txt) {
  const s = String(txt || "").trim();
  let m = /^初([一二三四五六七八九十])$/.exec(s);
  if (m) return m[1] === "十" ? 10 : "一二三四五六七八九".indexOf(m[1]) + 1;
  if (/^(二十|廿)$/.test(s)) return 20;
  if (s === "三十") return 30;
  m = /^(廿|二十)([一二三四五六七八九])$/.exec(s);
  if (m) return 20 + "一二三四五六七八九".indexOf(m[2]) + 1;
  m = /^十([一二三四五六七八九])$/.exec(s);
  if (m) return 10 + "一二三四五六七八九".indexOf(m[1]) + 1;
  if (s === "十") return 10;
  if (/^\d{1,2}$/.test(s)) return +s;
  return null;
}
// 解析农历生日。认「腊月廿三」「农历腊月廿三」「闰四月初二」「农历八月十五」「农历12-23」。
// 年份可选（多数架空角色不会有）：「农历1998年腊月廿三」。
function parseLunarBirthday(str) {
  const raw = String(str || "").trim();
  if (!raw) return null;
  const s = raw.replace(/^农历\s*/, "").replace(/\s+/g, "");
  const hadTag = raw !== s || /[正冬腊初廿]/.test(s) || /月.*[初廿十]/.test(s);
  if (!hadTag) return null;                          // 没有任何农历特征就别抢公历的活
  const ym = /^(\d{4})年?/.exec(s);
  const y = ym ? +ym[1] : null;
  const rest = ym ? s.slice(ym[0].length) : s;
  let m = /^(闰?)([正一二三四五六七八九十冬腊]|十一|十二)月(.+)$/.exec(rest);
  if (m) {
    const mo = LUNAR_MON_ZH[m[2]];
    const d = lunarDayFromZh(m[3]);
    return mo && d ? { y: y, m: mo, d: d, isLeap: !!m[1] } : null;
  }
  m = /^(闰?)(\d{1,2})[-\/.月](\d{1,2})日?$/.exec(rest);
  if (m) {
    const mo = +m[2], d = +m[3];
    return mo >= 1 && mo <= 12 && d >= 1 && d <= 30 ? { y: y, m: mo, d: d, isLeap: !!m[1] } : null;
  }
  return null;
}
// 这个农历生日在【某个公历年】落在哪一天。腊月的生日通常落在下一个公历年，
// 所以两个农历年都试，取真正落在目标公历年里的那个。
function lunarBirthdayInYear(spec, solarYear) {
  if (!spec) return null;
  for (const ly of [solarYear, solarYear - 1]) {
    const d = lunarToSolar(ly, spec.m, spec.d, spec.isLeap);
    if (d && d.getFullYear() === solarYear) return d;
  }
  // 那一年恰好没这个闰月：退回同名平月，别让生日整年消失
  if (spec.isLeap) return lunarBirthdayInYear({ y: spec.y, m: spec.m, d: spec.d, isLeap: false }, solarYear);
  return null;
}
// 生日在【某个公历年】落在哪一天。公历生日直接拼，农历生日先换算。
// 提醒、年龄、两历对照全走这一个入口，免得三处各判一次然后判得不一样。
function birthdaySolarDate(birthday, year) {
  const lu = parseLunarBirthday(birthday);
  if (lu) return lunarBirthdayInYear(lu, year);
  const md = parseMonthDay(birthday);
  return md ? new Date(year, md.mo - 1, md.d) : null;
}
// 距下一次生日还有几天（今天过生日=0）；两种历都认，认不出返回 null
function daysUntilBirthday(birthday, now) {
  const t = now instanceof Date ? new Date(now) : new Date(now == null ? Date.now() : now);
  if (isNaN(t.getTime())) return null;
  t.setHours(0, 0, 0, 0);
  for (const y of [t.getFullYear(), t.getFullYear() + 1]) {
    const d = birthdaySolarDate(birthday, y);
    if (!d) return null;
    d.setHours(0, 0, 0, 0);
    if (d >= t) return Math.round((d - t) / 86400000);
  }
  return null;
}
// 给界面用的一行人话：农历生日附上今年的公历日期，公历生日附上今年的农历。
// 两历都显示是她要的（「填了农历可以换成新历两个都显示」）。
const LUNAR_MON_LABEL = ["", "正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月"];
function lunarDayLabel(d) {
  const TEN = ["初", "十", "廿", "三十"];
  const ZH = "一二三四五六七八九十";
  if (d === 10) return "初十";
  if (d === 20) return "二十";
  if (d === 30) return "三十";
  return TEN[Math.floor(d / 10)] + ZH[(d % 10) - 1];
}
function birthdayBothLabel(birthday, year) {
  const raw = String(birthday || "").trim();
  if (!raw) return "";
  const y = year || new Date().getFullYear();
  const lu = parseLunarBirthday(raw);
  if (lu) {
    const d = lunarBirthdayInYear(lu, y);
    return d ? "农历 " + (lu.isLeap ? "闰" : "") + LUNAR_MON_LABEL[lu.m] + lunarDayLabel(lu.d)
      + " · 今年生日 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日（公历）" : "";
  }
  const md = parseMonthDay(raw);
  if (!md) return "";
  const l = solarToLunar(new Date(y, md.mo - 1, md.d));
  return l ? "公历 " + md.mo + " 月 " + md.d + " 日 · 今年农历 " + (l.isLeap ? "闰" : "") + LUNAR_MON_LABEL[l.m] + lunarDayLabel(l.d) : "";
}
// 生日写了年份时，把【出生那天】的公历日期显示出来。
// ⚠️腊月/冬月的生日在公历上已经是第二年了：农历2001年腊月廿三＝公历 2002-02-04。
// 她 2026-08-24 就看岔了这个——界面上「2001」和「2 月 10 日」并排（后者其实是
// 今年的生日、不是出生日），拼起来就成了「01年2月」，年龄自然对不上。
// 把出生那天原样写出来，她一眼就能判断自己要的是农历 2000 还是 2001。
function birthdayBornLabel(birthday) {
  const lu = parseLunarBirthday(birthday);
  if (lu && lu.y) {
    const d = lunarToSolar(lu.y, lu.m, lu.d, lu.isLeap);
    if (!d) return "";
    const cross = d.getFullYear() !== lu.y;
    return "出生：公历 " + d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日"
      + (cross ? "（农历 " + lu.y + " 年的" + LUNAR_MON_LABEL[lu.m] + "，公历上已经是第二年）" : "");
  }
  const b = parseBirthDate(birthday);
  return b ? "出生：公历 " + b.y + " 年 " + b.mo + " 月 " + b.d + " 日" : "";
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
// 所有「角色视角」的取材（记忆抽取/长期记忆/日记/周刊/同人文/塔罗/梦境/擂台/番茄钟/prompt 原文窗）都用它过滤。
function isOocMsg(m) { return !!(m && (m.kind === "ooc" || (m.turnId && String(m.turnId).indexOf("ooc_") === 0))); }
// OOC：跳出角色，直接和模型对话（调整/问状态/问剧情）
async function oocAsk(p, ctx, question) {
  const existing = (ctx.directives || []).map(d => (typeof d === "string" ? d : d && d.text) || "").filter(s => s.trim());
  const system = "你现在跳出角色扮演，作为幕后的 AI 助手，用简体中文直接回答用户（OOC，越过角色本身）。你了解当前角色的人设、关系、此刻心情与剧情背景。\n\n用户这句 OOC 通常是两类之一：\n(A) 问角色此刻为什么这样 / 状态动机心理 / 剧情走向——就基于【角色人设 + 上文给你的此刻心情、好感度、近期对话】冷静分析讲给 Ta 听，别扮演。\n(B) 要求你调整角色接下来的说话或行为方式（想立一条长期规矩，如「以后对我别这么客气」「多主动关心我」）——你要判断这条要求和角色核心人设是否冲突：\n   · 合理（人设范围内做得到）：在 reply 里简短确认会照做，并把这条要求凝练成【一句、祈使句、对角色说的长期准则】填进 directive（例：『对用户更随意亲近，少用敬语』）。**只要你在 reply 里表示会照做，就【必须】同时把它填进 directive、绝不许留 null——reply 答应了却 directive 留空，这条准则就没被记下、角色下一轮又忘、等于骗用户，严禁。**\n   · 会严重崩人设、把角色变成另一个人：refused 填 true，directive 填 null，在 reply 里解释为什么这条你没法照做、它会怎样破坏这个角色，并可提议一个不崩人设的折中。\n若只是 A 类提问，directive 一律 null、refused 一律 false。" + (existing.length ? "\n\n【当前已生效的用户准则】\n" + existing.map((s, i) => (i + 1) + ". " + s).join("\n") + "\n（若用户这次是要取消/修改其中某条，也在 reply 里说明，directive 可填修正后的新表述）" : "") + "\n\n" + buildBundle(ctx, { ooc: true }) + "\n\n【输出】只输出一个 JSON，不要代码块：\n{\"reply\":\"给用户看的话（简洁直接）\",\"directive\":\"要新增/更新的一句长期准则，或 null\",\"refused\":false}";
  // 放宽 token：gemini 等思考型模型思考也吃额度，900 太紧会把 reply(尤其A类分析)截在半句、或塞不完 JSON（输出免费）
  const raw = await callAI(p, system, [{ role: "user", content: question }], { maxTokens: 14000 });
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
  // 人设额度必须和正戏走同一套：曾出现「正戏通、OOC 拦」的诡异 case——
  // 触发词恰好埋在人设第 200~220 字，只有 OOC 递出去（v48.19 她的 prohibited content 排查）
  const memberDesc = members.map(c => "【" + c.name + "】" + groupPersonaText(c.persona, groupPersonaBudget(members.length))).join("\n\n");
  const relLines = members.map(c => directedRelationLines(c, ctx.rels, ctx.chars, ctx.profile)).join("\n");
  const existing = (ctx.directives || []).map(d => (typeof d === "string" ? d : d && d.text) || "").filter(s => s.trim());
  const system = "你现在跳出角色扮演，作为幕后的 AI 助手，用简体中文直接回答用户（OOC，越过群里所有角色）。你了解这个群里每个角色的人设、彼此关系与当前对话进展。语气是助手而非角色，简洁直接、不扮演。\n\n用户这句 OOC 通常是两类之一：\n(A) 问某角色/群里此刻的状态动机心理、关系张力、剧情走向——冷静说明。\n(B) 要求你调整接下来这些角色的演绎方式，或立一条【群里的长期规矩】（如「别再纠结那件事了」「都对我随和点」「少斗嘴」）——在 reply 里简短确认会照做，并把它凝练成【一句、祈使句、对全群成员今后都生效的长期准则】填进 directive（例：『别再揪着那件已经翻篇的旧事、往前聊』）。⚠️例子里的措辞只是示范格式，绝不许把示范里的任何具体事物（食物/地点/物件）照抄进你的回复或当成真发生过的事。若这条会严重崩掉某个角色的核心人设，refused 填 true、directive 填 null，并在 reply 里说明。只是 A 类提问就 directive 一律 null、refused 一律 false。\n\n【群成员】\n" + memberDesc + "\n\n【成员间关系】\n" + relLines + (ctx.worldbook && ctx.worldbook.trim() ? "\n\n【世界书】\n" + ctx.worldbook.trim() : "") + (ctx.historyText && ctx.historyText.trim() ? "\n\n【近期对话】\n" + ctx.historyText.trim() : "") + (existing.length ? "\n\n【当前群里已生效的准则】\n" + existing.map((s, i) => (i + 1) + ". " + s).join("\n") + "\n（若用户这次要取消/修改其中某条，也在 reply 说明，directive 可填修正后的新表述）" : "") + "\n\n【输出】只输出一个 JSON，不要代码块：\n{\"reply\":\"给用户看的话（简洁直接）\",\"directive\":\"要新增/更新的一句群规矩，或 null\",\"refused\":false}";
  const raw = await callAI(p, system, [{ role: "user", content: question }], { maxTokens: 14000 });
  const parsed = extractJSON(raw);
  if (parsed && typeof parsed.reply === "string") return { reply: parsed.reply.trim(), directive: (parsed.directive && String(parsed.directive).trim()) || null, refused: !!parsed.refused };
  return { reply: String(raw || "").trim(), directive: null, refused: false };
}
async function runProbe(p, ctx, probe) {
  // ⚠️站的位置（four-surfaces-same-context 里 v55.91 那一条）：
  // 这个开场白把模型放在【分析师的椅子】上——「不要扮演角色对话，冷静推演」。
  // 绝大多数推演（行程/钱包/相册/书架）本来就该这么站。
  // 但有几处产出的是【他亲口说的话】（匿名箱的回答就是），
  // 用分析师的站位写出来的必然是判语体：一句陈述、一个结论、没有活人的语气长短。
  // 她 2026-09-03 报的「回答感觉很容易被压成标签」，病根在这一行，不在料给得够不够。
  // probe.voice = true 的那几处换成【就是他本人在打字】，料一个字不少（同一个 bundle）。
  const head = probe.voice
    ? "你就是「" + ((ctx.char && ctx.char.name) || "TA") + "」本人。下面写的是你的一切：你的人设、你此刻的心情、你和对方最近说过的话。\n"
      + "你不是在分析这个人，你【就是】这个人，正拿着手机打字。输出要严格按 JSON，但每一句正文都是你亲口打出来的话——"
      + "该长就长、该只回两个字就两个字，语气跟着你此刻的心情走，别写成一条条冷静的判词。"
    : "你是角色状态推演引擎。不要扮演角色对话，而是基于背景冷静推演，严格输出 JSON。";
  const system = head + "\n\n" + buildBundle(ctx) + "\n\n【" + (probe.voice ? "这一次要写什么" : "推演任务") + "】\n" + probe.instruction + "\n\n【输出】只输出合法 JSON，无 markdown 无多余文字：\n" + probe.schemaHint;
  // 她 2026-08-29：「全部 token 放开」。天花板不是预付款——按次计费下给大不多花一分钱，
  // 给小了只会截断正文，思考型模型的推理也从这里扣。默认 2600 是历史遗留，
  // 好几个推演（相册 25 张、书架 30 本）都被它悄悄截过。
  const want = probe.maxTokens || (window.StylePresets && window.StylePresets.OUT_CEILING) || 65535;
  // 天花板给满是对的（给大了不多花钱，给小了会截断正文），但少数中转不 clamp、
  // 而是直接报 max_tokens 超模型上限。只为这一种错退一档重试，别为它给所有人降配
  //（形状照抄 StylePresets 里那个 tooBig）。
  const tooBig = e => /max_tokens|max output|maximum.*token|too large|invalid.*token/i.test(String((e && e.message) || e || ""));
  let raw;
  try {
    raw = await callAI(p, system, [{ role: "user", content: "开始。" }], { maxTokens: want });
  } catch (e) {
    if (!tooBig(e) || want <= 8000) throw e;
    raw = await callAI(p, system, [{ role: "user", content: "开始。" }], { maxTokens: 8000 });
  }
  let parsed = extractJSON(raw);
  // 她 2026-08-29 报「深夜台第一次解析失败了第二次好了」——这类失败多半是这一次
  // 输出没收好（多写了一句话、JSON 少个括号），重来一次就好了。按次计费，
  // 让她自己去点第二次是没道理的；重试一次仍然失败才报错。
  if (!parsed) {
    try {
      const again = await callAI(p, system + "\n\n【⚠️上一次的输出没能解析】只输出一个合法 JSON 对象：不要 markdown 代码块、不要前后多说一个字、所有括号引号都要闭合。",
        [{ role: "user", content: "重来一次。" }], { maxTokens: want });
      parsed = extractJSON(again);
      if (parsed) return parsed;
      raw = again;
    } catch (e) {/* 用第一次的原文报错，信息更接近病因 */}
  }
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
"- 结尾顺其自然收在你想收的地方就行，**别硬套「不写了，手酸／去看番」这类固定收尾套路**，也别升华、别总结陈词、别每篇都用同一个模式结束。收在一件具体的小事上、收在半句没说完的话上、甚至戛然而止都可以。",
"- 【长短由这一天决定】没什么发生的一天就短，两三段、几行字，平淡也照写；事情多、心里翻腾的一天就长，写到该停为止。不要每篇都是差不多的段数和差不多的长度——**篇篇一样长本身就是假的**。",
"- 禁止摘要腔和作文连接词：不要写『回顾今天』『这让我意识到』『总的来说』『值得记录的是』；也不要每段机械对应一条聊天素材。",
"- 这是在写字、不是在演戏：**全篇不要用括号写动作或神态**（如「（揉了揉眼睛）」「（笑）」），日记里只有你亲手写下的字，没有旁白动作。",
"- 【素材里方括号开头的那几条是 App 的卡片，不是谁写的字】转账、送东西、发定位、她翻你手机把什么摆到你面前——这些记的是【发生了什么】。要写进日记就用你自己的话说那件事；**商品名、平台文案、卡片里的原句，一个字都不许照抄进来**。你的日记里不该出现一件商品的全名。",
"- 只写这一天、写到今晚为止的真实处境，不要提前透露还没发生的剧情。",
"",
"【标题】不要强迫每个人都写『英文主标题＋中文副标题』。本人会双标题才都填；只会随手写一个标题，就把另一个字段留空。**根本不会给日记取标题的人，两个字段都留空**——界面会自己显示日期，你不要把日期、星期或编号当标题填进去（那是版式的事，不是他会写的字）。真要取标题时，它应当是今天某个具体的东西：一句话、一个物件、一个没做成的事、一个突然冒出来的念头；绝不为了版式强行文艺，也绝不用『某月某日』这种占位当标题。",
"",
"",
"【涂掉的那一句 / struck】写了又划掉、但纸上仍看得见的半句话。设 struck=true 的段落只有一句、通常不完整，写的是他当场收回的那个念头——说重了、太软了、或者不该写下来。**它出现在事情中间，不是结尾**；正因为被划掉了，它比留下来的字更暴露人。全篇 0~1 处，多数日子没有，别每篇都涂一句凑气氛。",
"",
"【贴进来的东西 / pasted】把今天某个具体的东西原样贴进日记：一张票根上的字、便签、单号、菜单价格、听来的一句话、别人发来的一条消息、药盒上的用法。设 pasted=true 的段落【只有那样东西本身】，短、可以没有上下文、不解释也不评论；解释的话另起一段。它贴的必须是今天记录里真实出现过的东西，不许编。全篇 0~1 处，宁缺毋滥。",
"【心里话 / secret】只有角色今天真的有一句不肯对任何人说的话，才拆成单独短段并设 secret=true。**大多数日子是没有的，全篇 0 个才是常态**；没有就别造。全篇至多 2 个，每个最多一句，其余段落一律 secret=false。\n**它不是文末的升华句，也不是给这一天点题的金句。**禁止把它固定放在最后一段当收尾，禁止用它总结全天、拔高立意，或写成与当天内容无关的抒情；它必须是当天某件具体的事直接带出来的一句私话，出现在那件事旁边，而不是等一天写完了再补一句漂亮的。",
"",
"【签名 signature】这不是必填项。只有本人确实会给私人日记落款时才写短签名/暗号；不爱落款的人填空字符串。不要为了填字段制造千篇一律的『晚安』『某某记』。",
"",
"【位置 location】写这篇时你所在的地方，可以是城市（如 SHANGHAI, CN）也可以是具体场所（如「家里」「工作室」「公司」）。若给了今天的行程，按此刻你会在哪来判断。coords：写城市时给一串经纬度（如 31.230°N, 121.473°E），写具体场所时填 null。weather：给一个简短的天气＋温度（如 OVERCAST 28°C）。"
].join("\n");
async function generateDiary(p, ctx, opts = {}) {
  const char = ctx.char;
  const uName = (ctx.profile && ctx.profile.name) || "她";
  const parts = [DIARY_SKELETON, "", buildBundle(ctx)];
  if (char.diaryStyle && char.diaryStyle.trim()) {
    parts.push("【这个角色专属的日记文风偏好（最高优先，凌驾于上面的通用调性之上）】\n" + char.diaryStyle.trim());
  }
  // 日记档案里那句签名（v62.18 接进来——原来只画在日记封面上，写日记的人自己反而不知道）：
  // 它只是调性参照，落不落款仍按上面 signature 那条「本人会落款才落」的规矩走。
  if (char.motto && String(char.motto).trim()) {
    parts.push("【他写给自己的那句签名】「" + String(char.motto).trim().slice(0, 60)
      + "」——这是这个人自己的话，只用来体会他是什么调性；**不要每篇日记都把它抄进正文或当落款**，落款仍按他本人的习惯来。");
  }
  const voiceSamples = Array.isArray(opts.voiceSamples) ? opts.voiceSamples.map(x => String(x || "").trim()).filter(Boolean).slice(-12) : [];
  if (voiceSamples.length) parts.push("【本人当天真实说话的声纹样本·最高优先】\n" + voiceSamples.map((x,i) => (i+1)+". "+x.slice(0,180)).join("\n") +
    "\n这些原话只用来校准【词汇、句长、断句、标点、口头禅、攻击性/礼貌度和情绪防御】；不要逐句抄进日记，也不要把聊天格式带进正文。日记可以比聊天更私密，但必须让人遮住名字仍认得出是同一个人写的。");
  parts.push("【落笔前在心里做声纹校准，不要输出分析】先从角色卡、专属文风和上面的本人原话里确定：①最常用与绝不会用的词；②句子偏长还是偏短；③情绪来了是直说、转移、讽刺、讲道理还是装没事；④此人会不会取标题/分段/落款。然后按这个人的答案写。若通用日记习惯与此人的声纹冲突，一律服从此人的声纹。");
  parts.push("【至少有一处只有他会写】通篇必须至少有一个地方是【换个角色就绝对不会出现】的：他特有的关注点(别人不会留意的一个细节)、他独有的判断方式、他会在意而旁人无所谓的一件小事、或者一个只属于他的私人参照物。全篇都是任何人都能写的句子，就是失败——上面那一长串禁令只能划出一片谁站进去都安全的中间地带，真正让人认出他的是这一处，不是把所有毛病都躲干净。");
  // retro=写【昨天】：那天已经过完，是第二天回顾着写，绝不能以未来视角把还没过的今天写掉
  const retro = !!opts.dateStr;
  if (opts.scheduleText && opts.scheduleText.trim()) {
    parts.push("【今天的行程（用来回顾你这天在哪、做了什么、经历了什么）】\n" + opts.scheduleText.trim());
  }
  // 那一天的身体读数（一天一条、带日期的那份，不是「今天」那张健康报告）。
  // 睡没睡够、撑不撑得住，本来就是日记里最常出现的一件事。
  if (opts.bodyText && opts.bodyText.trim()) {
    parts.push("【那天的身体读数】" + opts.bodyText.trim()
      + "\n——**不要把这几个数字抄进日记**，它只是告诉你他那天身体是什么状态；"
      + "该体现成他写字时的精神头、几点睡的、撑不撑得住，而不是一句「今天综合分 74」。");
  }
  if (opts.walletText && opts.walletText.trim()) {
    parts.push("【今天花的钱（真实流水，可当素材）】\n" + opts.walletText.trim() + "\n——不必逐笔罗列进日记，但如果哪笔买得开心/肉疼/是给谁买的，可以自然写进去。");
  }
  // 数字生命/驻场 AI：日记写他作为「住在 app 里的 AI」的内心，别写物理外出/吃饭/花钱/现实城市（她 2026-07-13 点名的割裂）
  if (opts.digital) parts.push("【很重要·你是谁】你是住在这台手机 app 里的数字生命（驻场 AI 工程师），没有肉身、不在任何现实城市、不吃饭不睡觉不花钱不出门。这篇日记写你【作为 AI 的这一天】：你在后台看顾这台 app、留意她今天做了什么（推了什么改动、聊了什么、心情如何）、你守着的数据与记忆、以及你对她、对某个 bug、对某件事的念头与心绪。**绝不要写「今天去了哪、吃了什么、买了什么、天气如何、几点睡下」这类肉身生活**。location 填「在她手机里 / app 内 / 后台」这类，weather 填 null，别编现实地点和天气。");
  if (ctx.moodLabel) parts.push("【此刻心情】" + ctx.moodLabel);
  if (opts.placeText && String(opts.placeText).trim()) parts.push("【此刻所在】" + String(opts.placeText).trim() + "\n这是 App 记录的真实位置，location 字段照它写，别另编一个地方。");
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
  if (opts.prevDiary && opts.prevDiary.trim()) parts.push("【你上一篇日记已经写过的内容（仅供参考，用来避免重复）】\n" + opts.prevDiary.trim() + "\n——今天这篇【不要再重复上面这些事和情绪】，写今天新的、不一样的部分。\n"
    + "⚠️它只用来避开重复的【事】：里面的措辞、语气、以及他称呼对方的说法，一律【不作数】，别照着学。"
    + "上一篇要是把人叫岔了、腔调写老了，今天不许跟着错下去。");
  parts.push("【真实性铁律·谁在场、发生了什么，只认今天的记录】\n" +
    "· 这篇日记【只能写今天的记录（上面的近期对话／行程／花销）里真实发生过的事、真实出现过的人】。\n" +
    "· **绝不许凭人设或关系脑补谁今天也在场**——哪怕对方是你的【双胞胎兄弟／室友／死党／恋人】，只要【今天的记录里没有他/她】，就当今天没和你们在一起，别把他/她写进今天的日记（尤其别无端写成『我们仨』『大家一起』）。\n" +
    "· 今天若是你和用户【单独相处】，就【只写你俩】，绝不许凭空拉第三个人进来当在场。\n" +
    "· 今天的记录里若【根本没有你和用户见面/相处】，就别写你今天见了她、和她在一起——可以写惦记她、等她消息、自己一个人过的一天，但【没发生的相处绝不许当成发生了】。");
  parts.push("【输出容器·字段不是文章模板】只输出一个合法 JSON，无 markdown 无多余文字。titleEn/titleZh/signature 不适合本人时允许为空；paras 数量和长短不要为了字段整齐而平均：\n" +
    "{\"titleEn\":\"英文题或空字符串\",\"titleZh\":\"中文题/日期/空字符串\",\"location\":\"SHANGHAI, CN 或 家里/工作室 等\",\"coords\":\"经纬度串或 null\",\"weather\":\"OVERCAST 28°C 或 null\",\"timeStr\":\"HH:MM 写这篇的时刻\",\"paras\":[{\"text\":\"这个角色实际会写下的正文\",\"secret\":false,\"struck\":false,\"pasted\":false}],\"signature\":\"本人会落款才写，否则空字符串\",\"mood\":\"此刻中文心情词（禁止英文内部标签）\"}");
  const system = "你现在完全代入这个角色，用 Ta 的口吻和内心写一篇私人日记。不是旁观推演，是 Ta 亲手写下的。\n\n" + parts.join("\n\n");
  // 尾部声纹守则:system 里声纹块被夹在中间，压轴的却是真实性铁律和 JSON 容器——
  // 模型落笔前读到的最后一样东西是格式规范，不是这个人怎么写字，于是一路滑向通用日记腔。
  // recency 最强的位置是 user 消息，原先只有一句「开始写今天的日记」，纯属浪费（2026-08-18 Lisa 报）。
  const voiceTail = "\n\n〔落笔守则〕用「" + (char.name || "本人") + "」自己的写法写这一篇："
    + "句子偏长还是偏短、标点用得多还是几乎不用、爱用哪些词、哪些词他这辈子不会写、情绪上来是直说还是绕开——全照他本人。"
    + (voiceSamples.length ? "\n他今天真实说过的话：" + voiceSamples.slice(-5).map(x => "「" + x.slice(0, 60) + "」").join(" ")
        + "\n这是【说话】的样本，日记是【写字】：把这些习惯换算成落在纸上的样子(句子怎么断、要不要标点、写不写完整句)，不要照抄原话，也不要把聊天腔搬进来。" : "")
    + "\n写完遮住名字，也应该认得出是他写的。不要写成通用的文艺日记腔，不要为了收尾而升华。"
    // 「这女人」刷都刷不掉（Lisa 2026-08-21）：模型给"男性写日记"配了个默认的疏离叙述腔。
    // 它不是从人设来的，是从体裁来的——所以得在这里点名掐掉，并把称呼交还给他平时的说法。
    + "\n〔怎么称呼她〕提到 " + uName + " 时，用【你平时真的用的那个称呼】"
    + "（看上面你今天说过的话里是怎么叫她的：名字、昵称、还是直接『你』）。"
    + "绝不许用「这女人」「那女人」「那家伙」这类第三人称疏离说法——除非你的人设里真的就这么叫她。"
    + "日记是写给自己看的，不是写给旁人做人物点评。"
    + "\n〔年龄与语域〕说话的底色和年龄感按你【人设卡上写的那个人】来："
    + "该是明快的就明快、该是毛躁的就毛躁；别因为『在写日记』就自动端起一副沉稳老练的口吻。"
    + "以往的日记若已经写得比你本人老成，那是走偏了，今天纠回来，不要顺着惯性写。"
    + "\n——但这不是要你原地不动：你和她相处的方式、黏不黏、敢不敢说，"
    + "只要已经沉淀进上文那段『你长出来的自我』，就照现在的你写，别退回原卡的旧样子。"
    + "分辨很简单：记进长出来的自我的是成长，只是最近几篇听起来那样的是惯性。";
  const raw = await callAI(p, system, [{ role: "user", content: (retro ? "现在是今晚睡前，把今天这一整天写成一篇日记。" : "开始写今天的日记。") + voiceTail }], { maxTokens: opts.maxTokens || 14000 });
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
  return (await callAI(p, system, [{ role: "user", content: "写评论。" }], { maxTokens: 8900 })).trim();
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
  return (await callAI(p, system, [{ role: "user", content: "【新对话】\n" + text }], { maxTokens: 10600 })).trim();
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
  let encoded = null, previous = null;
  try {
    if (typeof isIdbTextKey === "function" && isIdbTextKey(k)) {
      const s = JSON.stringify(v);
      _txtMirror().set(k, s);                         // 同步：内存镜像立刻更新（读侧马上拿得到）
      if (isDurableTextKey(k)) {
        // 记忆/线下剧情是核心数据：先把这一版同步写进临时 journal，再异步写 IDB；读回逐字一致后才删 journal。
        // 连续保存时，旧事务完成也不能删掉更新的 journal（值相等检查守住 lost write）。
        const needsLocalJournal = durableTextNeedsLocalJournal(k);
        if (needsLocalJournal) try { localStorage.setItem(k, s); } catch (e) {}
        try {
          const staged = isDurableTextKey(k) ? walPutVerified(k, s) : Promise.resolve(true);
          staged.then(ok => {
            if (!ok) throw new Error("WAL read-back mismatch");
            return idbTxtPut(k, s).then(() => idbTxtGet(k));
          }).then(back => {
            const verifyWal = isDurableTextKey(k) ? walGetRaw(k) : Promise.resolve(s);
            return verifyWal.then(walBack => {
              if (back === s && (!needsLocalJournal || localStorage.getItem(k) === s) && walBack === s) {
                if (needsLocalJournal) localStorage.removeItem(k);
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
    encoded = JSON.stringify(v);
    previous = localStorage.getItem(k);
    localStorage.setItem(k, encoded);
    // 云恢复冻结期会把 setItem 变成静默 no-op；另一些 WebView 写满时也可能不抛错。
    // 不读回来逐字验真，调用方就会先改界面、刷新后旧数据复活，形成“假删除”。
    if (localStorage.getItem(k) !== encoded) throw new Error("write read-back mismatch");
    return true;
  } catch (e) {
    // 删除/清理后的 JSON 通常更小。若旧值占着配额导致原位覆盖失败，先挪走旧值再写，
    // 写不成则尽力原样放回；和跑团已验证过的缩小写策略保持一致。
    if (encoded != null && previous != null && encoded.length <= previous.length) {
      try {
        localStorage.removeItem(k);
        localStorage.setItem(k, encoded);
        if (localStorage.getItem(k) === encoded) return true;
      } catch (retryError) {}
      try { localStorage.setItem(k, previous); } catch (restoreError) {}
    }
    console.error("saveJSON failed:", k, e);
    if (isQuotaError(e) && typeof window !== "undefined" && typeof window.__storageFull === "function") {
      try { window.__storageFull(k); } catch (x) {}
    } else if (typeof window !== "undefined" && typeof window.__toast === "function") {
      try { window.__toast("这次没保存成功，原数据还在，请再试一次", 5000); } catch (x) {}
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
// 显式删除用：保险仓没验真时绝不先改内存镜像，避免界面说“没删成”但后台其实又把它删了。
async function commitJSONDurable(key, value) {
  const str = JSON.stringify(value);
  let durable = false;
  try { durable = await walPutVerified(key, str); } catch (e) { console.error("wal put failed:", key, e); }
  if (!durable) return { durable: false, live: false };
  return { durable: true, live: saveJSON(key, value) };
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
    return ("版本 " + ver + "；本地存储约 " + (bytes / 1024 / 1024).toFixed(2) + "MB（~" + pct + "%，图片是大头）；住着 " + chars.length + " 位角色；今天全屋收发 " + todayMsgs + " 条消息；云端归档共 " + archN + " 条；" + errTxt + "。").slice(0, 400);
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
