// ============================================================
// 锁屏通知（PWA / Service Worker）
// 前端本地通知：页面 postMessage → sw.js showNotification。
// iOS 16.4+ 需先「添加到主屏」以独立 app 打开、并授权，才能收到锁屏通知。
// 页面仍能处理回复时可后台通知；系统冻结/回收页面后不保证送达，不做保活或补调模型。
// ============================================================
(function () {
  // 冷启动通知携带目标，等 App 的角色资料装好后再打开；不把目标写进永久存档。
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("notifChar") || url.searchParams.has("notifGroup") || url.searchParams.has("notifScreen")) {
      window.__pendingNotif = { charId: url.searchParams.get("notifChar") || "", groupId: url.searchParams.get("notifGroup") || "", screen: url.searchParams.get("notifScreen") || "", roomId: url.searchParams.get("notifRoom") || "main" };
      ["notifChar", "notifGroup", "notifScreen", "notifRoom"].forEach(k => url.searchParams.delete(k));
      window.history.replaceState(window.history.state, "", url.href);
    }
  } catch (e) {}
  const LS_KEY = "x_notifEnabled";
  // ⚠️原生壳那座桥（她 2026-09-09：「不知道为啥现在我的 xcode 壳开不了锁屏通知」）。
  //   病根：**WKWebView 根本不暴露 Notification API**，下面 supported() 第一句
  //   "Notification" in window 在壳里恒为 false，于是那个开关点了永远打不开。
  //   iOS 上的 Web 通知只在 Safari 和「添加到主屏」的 PWA 里有，壳里没有。
  //   所以壳自己出这一层（tools/ios-shell 的 nativeNotify + UNUserNotificationCenter）；
  //   桥在就走桥，不在才回到 Web 那条老路——两条路对外是同一套 API，调用方一个字都不用改。
  const bridge = () => { try { return window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeNotify; } catch (e) { return null; } };
  const ask = async (payload) => { const h = bridge(); if (!h) return null; try { return await h.postMessage(payload); } catch (e) { return null; } };
  let _nativePerm = "default";   // 桥那头的授权状态；开机问一次，之后每次 enable 再刷新
  if (bridge()) ask({ action: "status" }).then(r => { if (r && r.permission) _nativePerm = r.permission; });

  const webSupported = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
  const supported = () => !!bridge() || webSupported();
  // 壳里那句话得说人话（她 2026-09-10：「壳开不了通知宝宝」）。
  // 旧壳＝装着 nativeMedia 那座桥（v1 就有）、却没有 nativeNotify（v66.22 才加）。
  // 这时候弹「此设备/浏览器不支持通知」是把她引到死路上：真正要做的是在 Xcode 里重 build 一次。
  const oldShell = () => { try { return !bridge() && !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeMedia); } catch (e) { return false; } };
  function whyUnsupported() {
    if (supported()) return "";
    return oldShell() ? "壳还是旧的：在 Xcode 里重新 build 一次就有通知了" : "此设备/浏览器不支持通知";
  }

  function permission() { return bridge() ? _nativePerm : (webSupported() ? Notification.permission : "unsupported"); }
  function isOn() {
    try {
      if (!supported()) return false;
      if (localStorage.getItem(LS_KEY) !== "1") return false;
      return bridge() ? _nativePerm === "granted" : Notification.permission === "granted";
    } catch (e) { return false; }
  }

  // 请求权限（必须由用户点击触发）。返回 Promise<'granted'|'denied'|'default'|'unsupported'>
  async function enable() {
    if (bridge()) {
      const r = await ask({ action: "permission" });
      _nativePerm = (r && r.permission) || "denied";
      if (_nativePerm === "granted") localStorage.setItem(LS_KEY, "1");
      return _nativePerm;
    }
    if (!webSupported()) return "unsupported";
    let perm = Notification.permission;
    if (perm !== "granted") { try { perm = await Notification.requestPermission(); } catch (e) { perm = Notification.permission; } }
    if (perm === "granted") localStorage.setItem(LS_KEY, "1");
    return perm;
  }
  function disable() { localStorage.setItem(LS_KEY, "0"); }

  // 弹一条通知。onlyWhenHidden=true 时，页面在前台就不弹（默认 true，符合"切出去才提醒"）。
  async function push(opts) {
    opts = opts || {};
    if (!isOn()) return false;
    if (opts.onlyWhenHidden !== false && document.visibilityState === "visible") return false;
    const payload = {
      type: "SHOW_LOCAL_NOTIFICATION",
      title: opts.title || "秋秋机",
      body: String(opts.body || "").slice(0, 280),
      icon: opts.icon || "icon-192.png",
      tag: opts.tag || "",
      charId: opts.charId || "",
      groupId: opts.groupId || "",
      screen: opts.screen || "",
      roomId: opts.roomId || "main",
    };
    // 壳里走原生那座桥；桥不在才回到 service worker 那条老路
    if (bridge()) { const r = await ask({ ...payload, action: "show" }); return !!(r && r.ok); }
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    try {
      if (sw) { sw.postMessage(payload); return true; }
      // 首次授权时注册可能已激活但还没有 controller，优先走移动端支持的注册通知。
      const reg = navigator.serviceWorker.getRegistration ? await navigator.serviceWorker.getRegistration() : null;
      if (!isOn() || (opts.onlyWhenHidden !== false && document.visibilityState === "visible")) return false;
      if (reg && reg.showNotification) {
        await reg.showNotification(payload.title, {
          body: payload.body, icon: payload.icon, tag: payload.tag,
          data: {charId: payload.charId, groupId: payload.groupId, screen: payload.screen, roomId: payload.roomId}
        });
        return true;
      }
      const n = new Notification(payload.title, { body: payload.body, icon: payload.icon, tag: payload.tag });
      n.onclick = function () { window.focus(); if (window.__openFromNotif) window.__openFromNotif(payload.charId, payload.screen, payload.roomId, payload.groupId); n.close(); };
      return true;
    } catch (e) { return false; }
  }

  // 每个已交付气泡一个稳定标识：不同气泡不覆盖，同一个气泡重报不堆重复通知。
  function chatBubble(opts) {
    return push({ ...opts, tag: "bubble-" + JSON.stringify([opts.chatKey, opts.turnId, opts.bubbleId]) });
  }
  // 群里那一条（v66.20，她 2026-09-09：「群聊和旁观群能不能也做锁屏通知」）。
  // ⚠️走的是同一个 chatBubble：tag 的形状一样（chatKey/turnId/bubbleId），
  //   所以「同一个气泡重报不堆重复」那条对群一样成立。差别只是多带一个 groupId。
  function groupBubble(opts) {
    return chatBubble({ ...opts, screen: "gthread" });
  }

  // 发一条测试通知（设置页「测试」按钮用；延迟一点方便切后台看锁屏效果）
  function test(delayMs) {
    if (!isOn()) return false;
    setTimeout(() => {
      push({ title: "秋秋机 · 通知测试", body: "这是一条测试通知。实际后台送达取决于浏览器是否仍在运行。", tag: "notif-test", onlyWhenHidden: false });
    }, delayMs || 0);
    return true;
  }

  window.Notify = { supported, whyUnsupported, permission, isOn, enable, disable, push, chatBubble, groupBubble, test };
})();
