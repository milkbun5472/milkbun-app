// 删角色＝连TA的东西一起清（她 2026-10-05：「主动删除就是不要的」）。
// ⚠️「找回失联的角色」管的是【数据意外丢了】；她亲手删的人不在那条路上，不许留尾巴。
// 做法是扫本机所有 x_ 开头的存档，三种形状各清各的：
//   · 「x_xxx:角色id」这种按人分开的键（x_chat:、x_offline: ……）→ 整个键删掉
//   · 以角色 id 为键的表（x_chatSettings、x_schedules ……）→ 删掉那一格
//   · 一串记录、每条带 charId 的（x_favorites、x_promises ……）→ 滤掉TA的
// 只认【完整的 id】：id 是随机串，不会跟别的东西撞名。
// 不碰的：同步账本／云端那几把锁（动了会把同步搞乱），角色名单和群（调用方自己处理）、记忆库（走 saveMemLib 才同步得上云）。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CharPurge = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const SKIP = /^x_(characters|groups|memLib)$|cloud|ledger|outbox|sync|vault|cred|lsjournal/i;
  const owner = key => String(key).split("::room::")[0];
  const hit = (v, ids) => v && typeof v === "object" && (ids.has(v.charId) || ids.has(v.char_id) || ids.has(v.cid));
  // keep：这几张表不碰（「完全重置」留着她给 TA 调的设置，删卷宗不传）
  function sweep(idList, store, keep) {
    const keepSet = new Set(keep || []);
    const ids = new Set((idList || []).filter(Boolean).map(String));
    const ls = store || (typeof localStorage !== "undefined" ? localStorage : null);
    const changed = [];
    if (!ls || !ids.size) return changed;
    const keys = [];
    const seen = new Set();
    const add = k => { if (k && k.indexOf("x_") === 0 && !SKIP.test(k) && !keepSet.has(k) && !seen.has(k)) { seen.add(k); keys.push(k); } };
    for (let i = 0; i < ls.length; i++) add(ls.key(i));
    // ⚠️大部分存档早就不在 localStorage 本体里了（2026-10-04 全搬进 IndexedDB，内存里有一份镜像 __txtMirror）。
    //   只数 localStorage 的键会一个都扫不到——读写照旧走 getItem/setItem，那一层会自己转进大仓库。
    const g = typeof window !== "undefined" ? window : globalThis;
    if (!store && g.__txtMirror) g.__txtMirror.forEach((v, k) => { if (v != null) add(k); });
    keys.forEach(k => {
      // 侧房的键长这样：x_chat:角色id::room::房间id——认人看 ::room:: 前面那段
      if (k.indexOf(":") > 0 && ids.has(owner(k.slice(k.indexOf(":") + 1)))) { ls.removeItem(k); changed.push(k); return; }
      let v; try { v = JSON.parse(ls.getItem(k)); } catch (e) { return; }
      if (Array.isArray(v)) {
        const n = v.filter(x => !hit(x, ids));
        if (n.length !== v.length) { ls.setItem(k, JSON.stringify(n)); changed.push(k); }
      } else if (v && typeof v === "object") {
        let dirty = false;
        Object.keys(v).forEach(p => { if (ids.has(owner(p))) { delete v[p]; dirty = true; } });
        if (dirty) { ls.setItem(k, JSON.stringify(v)); changed.push(k); }
      }
    });
    return changed;
  }
  return { sweep, owner };
});
