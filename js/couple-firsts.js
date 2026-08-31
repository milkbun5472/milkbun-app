// 里程碑册（言秋提，她 2026-08-31 拍板）
//
// 「第一次通话、第一次吵架、第 100 天、第一封情书……引擎其实都看得见这些事件，只是没人记。」
//
// ⚠️关键的一条：**全部从已有数据【推】出来，一个钩子都不挂。**
// 一件件去调用点上挂「记一笔第一次」是这个库反复栽的那个形状——
// 一层写在三处、第四处没跟上（见 four-surfaces-same-context.md）。挂五个钩子就有五处会腐烂，
// 而且补挂之前发生过的事永远补不回来。推导没有这个问题：以前发生的也照样算数。
//
// 也因此这一层【零调用】。言秋原提案里「配一句角色口吻的注」要花钱，
// 这儿改成【引原物】——第一封情书就引那封信的标题，第一样放进抽屉的就引它的名字。
// 引来的是真的，比现编一句更像回事。
(function (root) {
  "use strict";
  const DAY = 86400000;
  // 天数那几档：走到了才出现。520 和 1314 是中文语境里真的会过的日子。
  const DAY_MARKS = [100, 200, 365, 520, 700, 1000, 1314, 1500, 2000];

  function firstOf(list, tsOf, ok) {
    let best = null;
    (Array.isArray(list) ? list : []).forEach(function (x) {
      if (!x || (ok && !ok(x))) return;
      const t = Number(tsOf(x)) || 0;
      if (!t) return;
      if (!best || t < best.t) best = { t: t, x: x };
    });
    return best;
  }
  const trim = function (s, n) {
    const v = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return v.length > (n || 22) ? v.slice(0, n || 22) + "…" : v;
  };

  // d: { since, letters, exdiary, notes, drawer, timeline, cards, duoPhotos,
  //      offlines, calls }  —— 全是这位恋人自己那一份，调用方筛好再进来
  function coupleFirsts(d, now) {
    const D = d || {}, t0 = Number(now) || Date.now();
    const out = [];
    const add = function (key, zh, t, note) { if (t) out.push({ key: key, zh: zh, ts: t, note: note || "" }); };

    const since = Number(D.since) || 0;
    add("since", "在一起的第一天", since, "");

    const off = firstOf(D.offlines, function (s) { return s.startTs; });
    add("offline", "第一次面对面", off && off.t, "");

    const call = firstOf(D.calls, function (m) { return m.ts; });
    add("call", "第一次通话", call && call.t, call ? trim(call.x.text, 30) : "");

    const duo = firstOf(D.duoPhotos, function (p) { return p.ts; });
    add("duo", "第一张合照", duo && duo.t, duo ? trim(duo.x.desc, 26) : "");

    const lt = firstOf(D.letters, function (l) { return l.createdAt; }, function (l) { return l.authorId && l.authorId !== "user"; });
    add("letter", "他写的第一封信", lt && lt.t, lt ? trim(lt.x.title, 22) : "");

    const ex = firstOf(D.exdiary, function (e) { return e.createdAt || e.ts; });
    add("exdiary", "交换日记的第一页", ex && ex.t, "");

    const nt = firstOf(D.notes, function (n) { return n.createdAt; });
    add("note", "便签墙上的第一张", nt && nt.t, nt ? trim(nt.x.content, 26) : "");

    const dw = firstOf(D.drawer, function (x) { return x.ts; });
    add("drawer", "他第一次往抽屉里放东西", dw && dw.t, dw ? trim(dw.x.title, 22) : "");

    const pact = firstOf(D.pacts, function (p) { return p.ts; });
    add("pact", "第一件说好的事", pact && pact.t, pact ? trim(pact.x.text, 26) : "");

    const card = firstOf(D.cards, function (c) { return c.ts; });
    add("card", "第一次抽卡", card && card.t, card ? card.x.r + "·" + trim(card.x.name, 16) : "");
    const ssr = firstOf(D.cards, function (c) { return c.ts; }, function (c) { return c.r === "SSR"; });
    add("ssr", "抽到的第一张 SSR", ssr && ssr.t, ssr ? trim(ssr.x.name, 20) : "");

    // 天数：走到了才算数，没到的不列（列出来就成了倒计时，那是「我们的日子」那一页的活）
    if (since) DAY_MARKS.forEach(function (n) {
      const t = since + (n - 1) * DAY;      // 在一起当天算第 1 天
      if (t <= t0) add("day" + n, "第 " + n + " 天", t, "");
    });

    return out.sort(function (a, b) { return a.ts - b.ts; });
  }

  const api = { coupleFirsts: coupleFirsts, DAY_MARKS: DAY_MARKS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CoupleFirsts = api;
})(typeof window !== "undefined" ? window : globalThis);
