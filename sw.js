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
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Main shell and embedded app documents have distinct offline entries.
  const scope = new URL("./", self.location.href);
  const mainDocument = url.pathname === scope.pathname || url.pathname === new URL("index.html", scope).pathname;
  const navigationKey = mainDocument ? "__index__" : "__page__:" + url.origin + url.pathname;
  // 导航：主壳＝「旧版先进、新版后台下齐再换」（2026-11-21 她要的）；子页面照旧网络优先。
  //   开机慢的病根不是 index.html，是它后面那 7 块 bundle：网慢时每次重开都从头下，
  //   永远下不完。所以——
  //   · 拿到新 index：它点名的 ?v= 文件【全在缓存里】→ 直接用新版（秒开）；
  //   · 有缺的、且手上有一份完整的旧 index → 先用旧版开门，后台把缺的一块块下进缓存，
  //     全下齐了才把新 index 换进来；下次打开就是新版，而且还是秒开。
  //     中途被杀也不白下：已下好的块留着，下次接着补。
  //   · 没有旧 index（第一次装、按过「清掉离线缓存」）→ 照旧直接用新版。
  //   · 断网/超时 → 用缓存那份。
  //   GitHub Pages（家里）和 CF（公共版）一样不认 ?v=，同一套逻辑两边通用。
  //   ⚠️缓存里的 __index__ 永远是「点名文件全齐」的那一份，旧版开门不会缺块。
  //   ⚠️后台下新块时【不清】同路径旧版本：旧 index 还要用它们；换 index 那一刻才清。
  //     （CF 不认 ?v=，旧 URL 一旦被删再去网上拿，拿回来的是新内容——新旧混跑，必须防。）
  if (req.mode === "navigate") {
    if (!mainDocument) {
      event.respondWith((async () => {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          const cache = await caches.open(SHELL_CACHE);
          if (fresh.ok) await cache.put(navigationKey, fresh.clone());
          return fresh;
        } catch (e) {
          const cached = await caches.match(navigationKey);
          if (cached) return cached;
          throw e;
        }
      })());
      return;
    }
    event.respondWith(serveShell(event, req));
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
        keys.forEach(k => {
          try {
            const ku = new URL(k.url);
            if (ku.origin === url.origin && ku.pathname === url.pathname && ku.search !== url.search) cache.delete(k);
          } catch (e) {}
        });
      }
    }
    return res;
  })());
});

// ===== 主壳：旧版先进、新版后台下 =====
function shellAssets(html) {
  const out = new Set();
  const re = /(?:src|href)="([^"]+[?&]v=[^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    try {
      const u = new URL(m[1].replace(/&amp;/g, "&"), self.registration.scope);
      if (u.origin === self.location.origin) out.add(u.href);
    } catch (e) {}
  }
  return [...out];
}
async function missingAssets(cache, urls) {
  const miss = [];
  for (const u of urls) {
    const hit = await cache.match(u);
    if (!hit || looksLikeFallback(new URL(u), hit)) miss.push(u);
  }
  return miss;
}
let shellJob = null;   // 同一时刻只跑一份后台下载
async function installShell(html, headers, urls) {
  const cache = await caches.open(SHELL_CACHE);
  for (const u of await missingAssets(cache, urls)) {
    const res = await fetch(u, { cache: "no-store" });
    if (!res.ok || looksLikeFallback(new URL(u), res)) throw new Error("shell asset " + res.status + " " + u);
    await cache.put(u, res);
  }
  // 块全齐 → 换 index → 清掉被新 index 取代的同路径旧版本
  await cache.put("__index__", new Response(html, { headers }));
  const want = new Map(urls.map(u => { const x = new URL(u); return [x.pathname, x.search]; }));
  for (const k of await cache.keys()) {
    try {
      const ku = new URL(k.url);
      if (ku.origin === self.location.origin && want.has(ku.pathname) && want.get(ku.pathname) !== ku.search) await cache.delete(k);
    } catch (e) {}
  }
}
async function serveShell(event, req) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match("__index__");
  let fresh;
  try {
    // 有旧版兜底时网络最多等 4 秒：拿不到就先用旧版开门
    const ctl = cached && typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 4000) : 0;
    try { fresh = await fetch(req, { cache: "no-store", signal: ctl ? ctl.signal : undefined }); }
    finally { if (timer) clearTimeout(timer); }
  } catch (e) {
    if (cached) return cached;
    throw e;
  }
  if (!fresh.ok) return cached || fresh;
  const html = await fresh.clone().text();
  const urls = shellAssets(html);
  const headers = new Headers(fresh.headers);
  const miss = await missingAssets(cache, urls);
  if (!miss.length || !cached) {
    // 新版块已齐（或第一次装没得选）：用新版；块没齐的话由页面自己按缓存优先去拉
    if (!miss.length) await cache.put("__index__", new Response(html, { headers }));
    else event.waitUntil(installShell(html, headers, urls).catch(e => console.warn("[sw] 首装补块未完成", e)));
    return new Response(html, { status: fresh.status, statusText: fresh.statusText, headers });
  }
  if (!shellJob) {
    shellJob = installShell(html, headers, urls)
      .catch(e => console.warn("[sw] 新版后台下载未完成，下次接着下", e))
      .finally(() => { shellJob = null; });
  }
  event.waitUntil(shellJob);
  return cached;
}

// ===== 页面发来「显示本地通知」的指令（纯前端，不依赖推送服务器）=====
// 这是 iOS PWA 也能弹锁屏通知的关键：页面 postMessage → SW showNotification。
self.addEventListener("message", (event) => {
  const d = event.data || {};
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
