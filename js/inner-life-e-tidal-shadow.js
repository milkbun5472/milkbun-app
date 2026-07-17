// 内在生活系统 E · 潮汐消息流影子接线（v49.39）
// 只记录独立 IndexedDB 状态：不注入、不 hold、不改变回复、不写记忆。
(function () {
  "use strict";
  const Core = window.InnerLifeETidalCore, Store = window.InnerLifeEAfterglowShadow;
  if (!Core || !Store) return;
  let ownerPromise = null, queue = Promise.resolve();

  async function ownerId() {
    if (!ownerPromise) ownerPromise = Promise.resolve().then(async () => {
      const user = window.Cloud && window.Cloud.getUser ? await window.Cloud.getUser() : null;
      return user && user.id ? String(user.id) : "local-device";
    }).catch(() => "local-device");
    return ownerPromise;
  }

  function enqueue(event, at) {
    queue = queue.then(async () => {
      const owner = await ownerId(), previous = await Store.getTidalState(owner);
      const result = Core.reduceTidal(previous, event, Number(at) || Date.now());
      await Store.putTidalState(owner, result.next);
      return result;
    }).catch(() => null);
    return queue;
  }

  function onUserMessage(text, at) {
    try {
      const classified = Core.classifyTidalMessage(text);
      return classified.event ? enqueue(classified.event, at) : Promise.resolve(null);
    } catch (_) { return Promise.resolve(null); }
  }
  const onSessionOpenNoMessage = at => enqueue(Core.EVENTS.SESSION_OPEN_NO_MESSAGE, at);
  const onForegroundNoMessage = at => enqueue(Core.EVENTS.FOREGROUND_TICK_NO_MESSAGE, at);
  async function status() { try { return Store.getTidalState(await ownerId()); } catch (_) { return null; } }

  window.InnerLifeETidalShadow = { onUserMessage, onSessionOpenNoMessage, onForegroundNoMessage, status };
})();
