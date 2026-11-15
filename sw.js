// ========== ARCHIVE Service Worker ==========
// v2（2026-07-19 她到家问「断网能不能打开」）：锁屏通知 + 离线壳缓存。
// 缓存策略专门绕开「旧版本粘住」老坑：
//   · 导航（index.html）＝网络优先——在线永远拿最新版，断网才退回缓存副本；
//   · 带 ?v= 的资源＝缓存优先——版本号即指纹，同 URL 内容永不变，缓存天然不脏；
//     换版本时 URL 变了自然重新拉，旧版本条目就地清理（同路径不同 ?v= 删旧留新）。
// 断网能干什么：翻聊天/记忆库/图库/记账/日历（全在本机）；callAI 和云同步仍需网。
const SW_VERSION = "archive-sw-v8";
const SHELL_CACHE = "archive-shell-" + SW_VERSION;

// 安装即接管，激活即控制所有页面（不等下次刷新）
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  // 清掉旧命名的缓存（SW_VERSION 升级时整柜换新）
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith("archive-shell-") && k !== SHELL_CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));

// ===== 离线壳缓存 =====
const CACHEABLE_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"]; // 字体也缓（跨域 opaque 可存）
// ⚠️托管方（CF Pages / GitHub Pages）对【不存在的路径】不返回 404，而是把首页
//   原样发回来：200 + text/html。于是「文件漏发了」在网络层看起来跟「拿到了」一样。
//   这一层缓存又是【缓存优先】的，res.ok 为真就 put——坏响应被按同一个 ?v= 存住，
//   之后每次都命中它，换多少次服务器都不会好（2026-10-05 绒绒小镇就是这么卡住的：
//   漏发的那几个 .mjs/.json 被缓存成了首页 HTML，模块一解析就炸）。
//   所以：资源路径拿到 html＝兜底页，既不许存，命中了也要当没命中并就地删掉。
const ASSET_EXT = /\.(m?js|json|glb|gltf|css|png|jpe?g|webp|svg|woff2?|ttf|mp3|wav|ogg|mp4)$/i;
function looksLikeFallback(url, res) {
  try {
    if (!res || !ASSET_EXT.test(url.pathname)) return false;
    return /text\/html/i.test(res.headers.get("content-type") || "");
  } catch (e) { return false; }
}
function isVersionedAsset(url) {
  return url.origin === self.location.origin && /[?&]v=/.test(url.search);
}
function isStaticSameOrigin(url) {
  // webp 是 v61.43 补的：秋秋的头像和图标是 webp（同一张画 png 要 80KB、webp 只要 15KB）。
  // 不写进来的话它俩每次都走网络，离线时秋秋就是两个空框。
  return url.origin === self.location.origin && (/\.(js|css|png|webp|json|ico)$/.test(url.pathname) || (/\/(?:apps\/(?:fairy-garden|train|pets)|art\/(?:pet-career|pet-house|train-carriage))\//.test(url.pathname) && /\.(mjs|glb)$/.test(url.pathname)));
}
// ===== 主页面先用存着的、新版后台下齐再换（她 2026-11-15）=====
// 存进去的首页不能是「跳转过来的」响应：Safari 拒绝把带跳转记录的响应交给页面导航。
async function storableDoc(res) {
  if (typeof Response === "undefined" || !res || !res.redirected) return res.clone ? res.clone() : res;
  return new Response(await res.clone().blob(), { status: res.status, headers: res.headers });
}
async function navFromNetwork(req, key) {
  try {
    const fresh = await fetch(req, { cache: "no-store" });
    const cache = await caches.open(SHELL_CACHE);
    if (fresh.ok) await cache.put(key, await storableDoc(fresh));
    return fresh;
  } catch (e) {
    const cached = await caches.match(key);
    if (cached) return cached;
    throw e;
  }
}
// 首页开机要用的文件：<script src> / <link href> 带的，加上公共版排队清单里写的那几块。
//   点进去才加载的（data-src）不在这儿——它们本来就是用到时才下。
function bootAssets(html, base) {
  const out = [], seen = {};
  const add = (u) => {
    try {
      const abs = new URL(u, base);
      if (abs.origin !== self.location.origin || seen[abs.href]) return;
      if (!/\.(m?js|css)$/i.test(abs.pathname)) return;
      seen[abs.href] = 1; out.push(abs.href);
    } catch (e) {}
  };
  let m;
  const tagRe = /<(?:script|link)\b[^>]*\s(?:src|href)="([^"]+)"/gi;
  while ((m = tagRe.exec(html))) add(m[1]);
  const seqRe = /["'](js\/bundle[^"']*\.js\?v=[^"']+)["']/g;
  while ((m = seqRe.exec(html))) add(m[1]);
  return out;
}
let staging = null;
function stageOnce() {
  if (!staging) staging = stageUpdate().catch(() => {}).then(() => { staging = null; });
  return staging;
}
async function stageUpdate() {
  const scope = new URL("./", self.location.href);
  const key = "__index__";
  const res = await fetch(scope.href, { cache: "no-store", credentials: "same-origin" });
  if (!res || !res.ok) return;
  const html = await res.clone().text();
  // 进门页（还没输口令）或者拿回来的不像首页：不许当成新版存进去
  if (!/js\/(?:bundle|app)\.js\?v=/.test(html)) return;
  const cache = await caches.open(SHELL_CACHE);
  const old = await cache.match(key);
  const oldHtml = old ? await old.clone().text() : "";
  // 先清【上上版】的残留：此刻存着的首页就是正在用的那一版，它用不到的同名旧文件才能删
  if (oldHtml) await pruneExcept(cache, bootAssets(oldHtml, scope.href));
  if (oldHtml === html) return;                                     // 没有新版
  const list = bootAssets(html, scope.href);
  // 一块一块下：下好一块就存一块，被打断了下次接着来；有一块拿不到就先不换
  for (const href of list) {
    if (await cache.match(href)) continue;
    const r = await fetch(href);
    if (!r || !r.ok || looksLikeFallback(new URL(href), r)) return;
    await cache.put(href, r.clone());
  }
  const doc = typeof Response === "undefined" ? res : new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  await cache.put(key, doc);
  // ⚠️换上的这一刻不清旧文件：旧页面可能还在用（下一次 stageUpdate 开头才清）
  const now = docSig(html);
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach(c => { try { if (served.get(c.id) !== now) c.postMessage({ type: "QQ_UPDATE_READY" }); } catch (e) {} });
}
// 同路径、?v= 不在 keep 里的旧版本删掉（只删开机清单里那几个路径的）
async function pruneExcept(cache, keepList) {
  try {
    const keep = {}, paths = {};
    keepList.forEach(h => { keep[h] = 1; const u = new URL(h); if (/[?&]v=/.test(u.search)) paths[u.pathname] = 1; });
    const keys = await cache.keys();
    await Promise.all(keys.map(k => {
      try { const u = new URL(k.url); if (paths[u.pathname] && !keep[u.href]) return cache.delete(k); } catch (e) {}
    }));
  } catch (e) {}
}
// 存着的首页开机要用的那几个文件：缓存优先那条路「新版本进来就删同名旧版」时，这几个不许删
async function indexKeepSet() {
  try {
    const r = await caches.match("__index__");
    if (!r) return {};
    const keep = {};
    bootAssets(await r.clone().text(), new URL("./", self.location.href).href).forEach(h => { keep[h] = 1; });
    return keep;
  } catch (e) { return {}; }
}
// 每个页面拿到的是哪一版首页（页面回来问「有新版吗」时对一下）
const served = new Map();
function docSig(t) { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return t.length + ":" + h; }
async function markServed(event, res) {
  try { const id = event.resultingClientId || event.clientId; if (id && res) served.set(id, docSig(await res.clone().text())); } catch (e) {}
}
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Main shell and embedded app documents have distinct offline entries.
  const scope = new URL("./", self.location.href);
  const mainDocument = url.pathname === scope.pathname || url.pathname === new URL("index.html", scope).pathname;
  const navigationKey = mainDocument ? "__index__" : "__page__:" + url.origin + url.pathname;
  // 主页面：手机里存着一份就先用存着的（秒开），新版在后台一块一块下，下齐了才换上（见 stageUpdate）。
  //   她 2026-11-15「以后打开就还是之前缓存过的，让他们自己点更新」：国内连这个地址每秒几 KB，
  //   每发一版就要在白屏前干等十来分钟、一打断就白下。
  //   ⚠️救援页跳回来带 ?launch=/&fresh=：那是「我要最新的」，照旧网络优先。
  if (req.mode === "navigate" && mainDocument && !/[?&](?:launch|fresh)=/.test(url.search)) {
    event.respondWith((async () => {
      let cached = null;
      try { cached = await caches.match(navigationKey); } catch (e) {}
      if (cached) {
        await markServed(event, cached);
        const bg = stageOnce();
        if (event.waitUntil) event.waitUntil(bg);
        return cached;
      }
      const res = await navFromNetwork(req, navigationKey);
      await markServed(event, res);
      return res;
    })());
    return;
  }
  // 导航：网络优先，断网退缓存
  if (req.mode === "navigate") {
    // iOS 主屏幕 Web App 还会在 Cache Storage 外保留 HTTP 磁盘缓存；导航显式 no-store（在 navFromNetwork 里）。
    event.respondWith(navFromNetwork(req, navigationKey));
    return;
  }

  // 版本化资源/静态文件/字体：缓存优先
  const cacheable = isVersionedAsset(url) || isStaticSameOrigin(url) || CACHEABLE_HOSTS.includes(url.host);
  if (!cacheable) return; // supabase/API 等一律不碰，直连网络
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const hit = await cache.match(req);
    if (hit && !looksLikeFallback(url, hit)) return hit;
    if (hit) { try { await cache.delete(req); } catch (e) {} }   // 存住的是兜底页：清掉，这一次重新去拿
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque") && !looksLikeFallback(url, res)) {
      cache.put(req, res.clone());
      // 同路径旧版本就地清理（防 ?v= 逐版累积吃存储）
      if (isVersionedAsset(url)) {
        const keys = await cache.keys();
        // ⚠️存着的首页（可能是后台刚下齐、还没换上的新版）开机要用的那几块不许删：
        //   旧页面这时候再要一次旧文件，会把刚下好的新文件挤掉（2026-11-15 实测撞到）
        const keep = await indexKeepSet();
        keys.forEach(k => {
          try {
            const ku = new URL(k.url);
            if (keep[ku.href]) return;
            if (ku.origin === url.origin && ku.pathname === url.pathname && ku.search !== url.search) cache.delete(k);
          } catch (e) {}
        });
      }
    }
    return res;
  })());
});

// ===== 页面发来「显示本地通知」的指令（纯前端，不依赖推送服务器）=====
// 这是 iOS PWA 也能弹锁屏通知的关键：页面 postMessage → SW showNotification。
self.addEventListener("message", (event) => {
  const d = event.data || {};
  // 页面回到前台时问一声有没有新版（App 一直开着不重新打开的人也能等到更新）
  if (d.type === "QQ_CHECK_UPDATE") {
    // 先下（有新版的话），再对一下这个页面拿到的那一版跟存着的是不是同一版：不是就告诉它
    const job = stageOnce().then(async () => {
      try {
        const src = event.source, r = await caches.match("__index__");
        if (!src || !r || !served.has(src.id)) return;
        if (served.get(src.id) !== docSig(await r.clone().text())) src.postMessage({ type: "QQ_UPDATE_READY" });
      } catch (e) {}
    });
    if (event.waitUntil) event.waitUntil(job);
    return;
  }
  if (d.type !== "SHOW_LOCAL_NOTIFICATION") return;
  event.waitUntil(self.registration.showNotification(d.title || "秋秋\u673a", {
    body: d.body || "",
    icon: d.icon || "icon-192.png",
    badge: "icon-192.png",
    tag: d.tag || ("archive-" + Date.now()),
    renotify: !!d.tag,
    // groupId：群聊/旁观群那一路（v66.20，她 2026-09-09 要的）。点开要能直接落进那个群，
    // 所以它得跟 charId 一样一路传到底：这儿存进 data、下面 notificationclick 再取出来。
    data: { charId: d.charId || "", groupId: d.groupId || "", screen: d.screen || "", roomId: d.roomId || "main" },
    vibrate: [80, 40, 80],
    requireInteraction: false,
  }));
});

// ===== 远程推送（若将来接了推送服务器才会走到；纯前端用不到）=====
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || "ARCHIVE", {
    body: d.body || "",
    icon: d.icon || "icon-192.png",
    badge: "icon-192.png",
    tag: d.tag || "archive-push",
    data: { charId: d.charId || "", screen: d.screen || "" },
    vibrate: [80, 40, 80],
  }));
});

// ===== 点通知：聚焦已开的窗口并让它打开对应聊天，否则开新窗口 =====
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const charId = (event.notification.data && event.notification.data.charId) || "";
  const groupId = (event.notification.data && event.notification.data.groupId) || "";
  const screen = (event.notification.data && event.notification.data.screen) || "";
  const roomId = (event.notification.data && event.notification.data.roomId) || "main";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (c.url.startsWith(self.registration.scope)) {
          return c.focus().then(() => c.postMessage({ type: "OPEN_FROM_NOTIF", charId, groupId, screen, roomId }));
        }
      }
      const url = new URL(self.registration.scope);
      if (charId) url.searchParams.set("notifChar", charId);
      if (groupId) url.searchParams.set("notifGroup", groupId);
      if (screen) url.searchParams.set("notifScreen", screen);
      url.searchParams.set("notifRoom", roomId);
      return self.clients.openWindow(url.href);
    })
  );
});
