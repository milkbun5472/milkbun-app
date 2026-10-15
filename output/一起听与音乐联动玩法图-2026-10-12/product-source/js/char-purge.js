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
  // 记录里认人的那一栏不止 charId（她 2026-10-10：「重置也该带上钱包和购物外卖」「看看还有哪些会留存」）：
  //   朋友圈、交换日记写的是 characterId；TA 送的订单、外卖、你收下的东西写的是 fromCharId；
  //   你钱包里的流水把人藏在出处 ref.charId 里；TA 发的论坛帖写的是 authorId。
  //   群聊消息的 senderId 不算——群聊是大家共有的，不在这儿清。
  const hit = (v, ids) => v && typeof v === "object" && (ids.has(v.charId) || ids.has(v.char_id) || ids.has(v.cid)
    || ids.has(v.characterId) || ids.has(v.fromCharId) || ids.has(v.authorId) || !!(v.ref && typeof v.ref === "object" && ids.has(v.ref.charId)));
  // 重置时按类挑（她 2026-10-08「出一堆开关 show 哪些会被清除，可以自行选择哪些要留」）。
  //   每张存档归到一类；没认领的都算「其他」。设置类永远不清（那是她给 TA 调的样子）。
  const CATS = [
    { id: "chat", zh: "聊天和线下记录", desc: "线上私聊、单人线下、侧房聊天，云端的旧聊天归档；未读和开场白" },
    { id: "memory", zh: "记忆", desc: "记忆库里只属于 TA 的那些（共用的只把 TA 摘掉）、长期记忆" },
    { id: "state", zh: "心情和状态", desc: "此刻心情、状态卡、心声、TA 自己的念头和你给的指令" },
    { id: "bond", zh: "好感和关系", desc: "好感度、你们之间的关系设定、称呼、情侣空间、亲属卡、拉黑" },
    { id: "life", zh: "日程、日记和梦", desc: "日程、日记、日历事件、时光胶囊、约会记录、平行线和梦" },
    { id: "phone", zh: "手机和社交", desc: "查手机、朋友圈、论坛、偷看记录" },
    { id: "money", zh: "我的钱包和购物外卖", desc: "你钱包流水里跟 TA 有关的那几笔、TA 送你或替你付的订单和外卖记录、你收下的 TA 送的东西、你送 TA 还在路上的礼物。余额不动" },
    { id: "things", zh: "其他", desc: "约定、收藏、TA 自己的钱包、随身物品、抽卡这些剩下的" }
  ];
  const SETTINGS = /^x_(chatSettings|offlineSettings|offlineStyles|charCurrency|avatarSwap|groupSettings|liveCfg|callAuto\w*|callStayAfterBye|phoneAuto|phoneKeep|phoneLang|phoneLooks|phoneTlKeep|voiceLib|makeup|musicCard)$/;
  function catOf(key) {
    const k = String(key);
    if (SETTINGS.test(k)) return "settings";
    if (/^x_(chat|offline):/.test(k) || /^x_(chatArch|unread|openers|greetLog|lastRoom|ambientCount|ambientTs|whispers|pinnedChats)$/.test(k)) return "chat";
    if (/^x_(memories|rerollMemoryJournal)$/.test(k)) return "memory";
    if (/^x_(states|stateHist|roomStates|roomStateHist|moods|thoughtCtr|desires|directives)$/.test(k)) return "state";
    if (/^x_jiwen(Seen|Why)?$/.test(k)) return "state";   // 动念的存档键（键名沿用旧名，见 dongnian-rename 测试）
    if (/^x_(affinities|affBase|rels|couples|couple\w*|charTitle|loveLetter|tiesPos|friendGroups|blocks|kinshipCards|myKinCards)$/.test(k)) return "bond";
    if (/^x_(schedules|diaries|calEvents|capsules|dateVisits|dateAskLast|ifLines|worlds|studio)$/.test(k)) return "life";
    if (/^x_(phone\w*|moments\w*|forum\w*|snoops|peek\w*|eyesAlertLog|shua|wxReactDay|anon|anonPool)$/.test(k)) return "phone";
    if (/^x_(walletLog|shopOrders|takeoutLog|inventory|giftOut|cartPaid)$/.test(k)) return "money";
    return "things";
  }
  // keep：这几张表不碰（删卷宗不传）；only：只清这几类（Set of CATS id，删卷宗不传＝全清）
  function sweep(idList, store, keep, only) {
    const keepSet = new Set(keep || []);
    const onlySet = only ? new Set(only) : null;
    const ids = new Set((idList || []).filter(Boolean).map(String));
    const ls = store || (typeof localStorage !== "undefined" ? localStorage : null);
    const changed = [];
    if (!ls || !ids.size) return changed;
    const keys = [];
    const seen = new Set();
    const add = k => { if (k && k.indexOf("x_") === 0 && !SKIP.test(k) && !keepSet.has(k) && (!onlySet || onlySet.has(catOf(k))) && !seen.has(k)) { seen.add(k); keys.push(k); } };
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
  return { sweep, owner, CATS, catOf };
});
