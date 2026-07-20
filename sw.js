// ========== ARCHIVE Service Worker ==========
// v2（2026-07-19 她到家问「断网能不能打开」）：锁屏通知 + 离线壳缓存。
// 缓存策略专门绕开「旧版本粘住」老坑：
//   · 导航（index.html）＝网络优先——在线永远拿最新版，断网才退回缓存副本；
//   · 带 ?v= 的资源＝缓存优先——版本号即指纹，同 URL 内容永不变，缓存天然不脏；
//     换版本时 URL 变了自然重新拉，旧版本条目就地清理（同路径不同 ?v= 删旧留新）。
// 断网能干什么：翻聊天/记忆库/图库/记账/日历（全在本机）；callAI 和云同步仍需网。
const SW_VERSION = "archive-sw-v2";
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
function isVersionedAsset(url) {
  return url.origin === self.location.origin && /[?&]v=/.test(url.search);
}
function isStaticSameOrigin(url) {
  return url.origin === self.location.origin && /\.(js|css|png|json|ico)$/.test(url.pathname);
}
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 导航：网络优先，断网退缓存
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL_CACHE);
        cache.put("__index__", fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match("__index__");
        if (cached) return cached;
        throw e;
      }
    })());
    return;
  }

  // 版本化资源/静态文件/字体：缓存优先
  const cacheable = isVersionedAsset(url) || isStaticSameOrigin(url) || CACHEABLE_HOSTS.includes(url.host);
  if (!cacheable) return; // supabase/API 等一律不碰，直连网络
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque")) {
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

// ===== 页面发来「显示本地通知」的指令（纯前端，不依赖推送服务器）=====
// 这是 iOS PWA 也能弹锁屏通知的关键：页面 postMessage → SW showNotification。
self.addEventListener("message", (event) => {
  const d = event.data || {};
  if (d.type !== "SHOW_LOCAL_NOTIFICATION") return;
  self.registration.showNotification(d.title || "ARCHIVE", {
    body: d.body || "",
    icon: d.icon || "icon-192.png",
    badge: "icon-192.png",
    tag: d.tag || ("archive-" + Date.now()),
    renotify: !!d.tag,
    data: { charId: d.charId || "", screen: d.screen || "" },
    vibrate: [80, 40, 80],
    requireInteraction: false,
  });
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
  const screen = (event.notification.data && event.notification.data.screen) || "";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (c.url.startsWith(self.registration.scope)) {
          c.focus();
          c.postMessage({ type: "OPEN_FROM_NOTIF", charId: charId, screen: screen });
          return;
        }
      }
      return self.clients.openWindow(self.registration.scope);
    })
  );
});
