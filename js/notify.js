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
    if (url.searchParams.has("notifChar") || url.searchParams.has("notifScreen")) {
      window.__pendingNotif = { charId: url.searchParams.get("notifChar") || "", screen: url.searchParams.get("notifScreen") || "", roomId: url.searchParams.get("notifRoom") || "main" };
      ["notifChar", "notifScreen", "notifRoom"].forEach(k => url.searchParams.delete(k));
      window.history.replaceState(window.history.state, "", url.href);
    }
  } catch (e) {}
  const LS_KEY = "x_notifEnabled";
  const supported = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;

  function permission() { return supported() ? Notification.permission : "unsupported"; }
  function isOn() { try { return supported() && Notification.permission === "granted" && localStorage.getItem(LS_KEY) === "1"; } catch (e) { return false; } }

  // 请求权限（必须由用户点击触发）。返回 Promise<'granted'|'denied'|'default'|'unsupported'>
  async function enable() {
    if (!supported()) return "unsupported";
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
      screen: opts.screen || "",
      roomId: opts.roomId || "main",
    };
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    try {
      if (sw) { sw.postMessage(payload); return true; }
      // 首次授权时注册可能已激活但还没有 controller，优先走移动端支持的注册通知。
      const reg = navigator.serviceWorker.getRegistration ? await navigator.serviceWorker.getRegistration() : null;
      if (!isOn() || (opts.onlyWhenHidden !== false && document.visibilityState === "visible")) return false;
      if (reg && reg.showNotification) {
        await reg.showNotification(payload.title, {
          body: payload.body, icon: payload.icon, tag: payload.tag,
          data: {charId: payload.charId, screen: payload.screen, roomId: payload.roomId}
        });
        return true;
      }
      const n = new Notification(payload.title, { body: payload.body, icon: payload.icon, tag: payload.tag });
      n.onclick = function () { window.focus(); if (window.__openFromNotif) window.__openFromNotif(payload.charId, payload.screen, payload.roomId); n.close(); };
      return true;
    } catch (e) { return false; }
  }

  // 每个已交付气泡一个稳定标识：不同气泡不覆盖，同一个气泡重报不堆重复通知。
  function chatBubble(opts) {
    return push({ ...opts, tag: "bubble-" + JSON.stringify([opts.chatKey, opts.turnId, opts.bubbleId]) });
  }

  // 发一条测试通知（设置页「测试」按钮用；延迟一点方便切后台看锁屏效果）
  function test(delayMs) {
    if (!isOn()) return false;
    setTimeout(() => {
      push({ title: "秋秋机 · 通知测试", body: "这是一条测试通知。实际后台送达取决于浏览器是否仍在运行。", tag: "notif-test", onlyWhenHidden: false });
    }, delayMs || 0);
    return true;
  }

  window.Notify = { supported, permission, isOn, enable, disable, push, chatBubble, test };
})();
