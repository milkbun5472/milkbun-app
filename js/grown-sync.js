// ============================================================
// 长出来的那几样：搬出 saves blob，各自成行
// ============================================================
// 她 2026-09-04 第二次丢数据：为了换图标没备份就重装，中间又开了书签里那个
// 几个月前的旧网页版，旧版把它自己那份 x_ 全量推上去，把她的整份 saves 盖了。
// 记忆和聊天活下来了——不是因为「它们在云上」，而是因为它们各自有一张行表
//（memories 每行自带 char_ids、chat_archive 按 char_id 只追加），
// 而那个旧版客户端【代码里根本没有这两张表】，所以碰都碰不到。
// 心上（x_desires）和 Ta 眼里（x_gaze）只住在 saves 那一份 blob 里，
// 一次整行 upsert 就没了，而那一行没有历史。
//
// ⚠️病根不是「闸没写好」：v61.63 那道过期设备闸写在【客户端】里，
//   而肇事的是一个你改不到的旧客户端。用新代码去管旧客户端，永远管不住。
//   唯一挡得住的形状是【它不认识的那张表】。
//
// 这个文件只干合并那件事，不碰网络——纯函数，好测。
// 合并的两条铁律：
//   ① 只进不出：任何一边有的都留着。云端读失败、表还没建、行是空的，
//      都绝不能把本机抹掉——她已经因为「一边把另一边盖掉」丢过两次。
//   ② 同一件东西按【它自己的时刻】取新的，不按整份取新的。
//      整份取新会让「本机新长的一条」和「云端另一条」互相吃掉。
(function (root) {
  "use strict";
  const num = v => Number(v) || 0;
  const obj = v => (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
  const arr = v => Array.isArray(v) ? v : [];

  // 一条一条按 key 合并，同 key 取 stamp 大的那条
  function mergeList(a, b, keyOf, stampOf) {
    const out = new Map();
    const put = row => {
      if (!row) return;
      const k = keyOf(row);
      if (k == null || k === "") return;
      const old = out.get(k);
      if (!old || stampOf(row) >= stampOf(old)) out.set(k, row);
    };
    arr(a).forEach(put); arr(b).forEach(put);
    return [...out.values()];
  }

  // ── 心上 ──────────────────────────────────────────────────
  // list/persona 按 id 认人（同一条念想两边都改过，取被想起得更近的那份）；
  // log/milestones/briefs 是日志，按【时刻+正文】去重，两边的都留着。
  // avoid 按 topic。lastMuse 这类游标取更晚的那个。
  function mergeHeartBox(a, b) {
    a = obj(a); b = obj(b);
    const later = k => {
      const x = String(a[k] || ""), y = String(b[k] || "");
      return x > y ? x : y;         // 都是 YYYY-MM-DD 或 toDateString，字典序够用时取大
    };
    const logKey = e => num(e && e.ts) + "|" + String((e && e.text) || "").slice(0, 40);
    return {
      ...a, ...b,
      list:       mergeList(a.list, b.list, e => e && e.id, e => Math.max(num(e.lastTouch), num(e.gradTs), num(e.ashTs), num(e.born))),
      persona:    mergeList(a.persona, b.persona, e => e && e.id, e => num(e.ts)),
      avoid:      mergeList(a.avoid, b.avoid, e => e && e.topic, e => num(e.ts)),
      log:        mergeList(a.log, b.log, logKey, e => num(e.ts)).sort((x, y) => num(y.ts) - num(x.ts)),
      milestones: mergeList(a.milestones, b.milestones, logKey, e => num(e.ts)).sort((x, y) => num(y.ts) - num(x.ts)),
      briefs:     mergeList(a.briefs, b.briefs, logKey, e => num(e.ts)).sort((x, y) => num(y.ts) - num(x.ts)),
      lastMuse: later("lastMuse"), lastMellow: later("lastMellow"),
      lastSolstice: later("lastSolstice"), lastObserve: later("lastObserve")
    };
  }

  // ── Ta 眼里 ───────────────────────────────────────────────
  // blocks 每一块自己带 ts，逐块取新的；hist 是旧版快照，按【块+时刻】去重全留；
  // checks 是「他又想了一遍」的时刻，逐块取晚的。
  function mergeGazeBox(a, b) {
    a = obj(a); b = obj(b);
    const blocks = {};
    const ba = obj(a.blocks), bb = obj(b.blocks);
    new Set([...Object.keys(ba), ...Object.keys(bb)]).forEach(k => {
      const x = ba[k], y = bb[k];
      blocks[k] = (!y || (x && num(x.ts) >= num(y.ts))) ? x : y;
    });
    const checks = {};
    const ca = obj(a.checks), cb = obj(b.checks);
    new Set([...Object.keys(ca), ...Object.keys(cb)]).forEach(k => { checks[k] = Math.max(num(ca[k]), num(cb[k])); });
    return {
      ...a, ...b, blocks, checks,
      hist: mergeList(a.hist, b.hist, e => String((e && e.k) || "") + "|" + num(e && e.ts), e => num(e.ts))
              .sort((x, y) => num(y.ts) - num(x.ts)).slice(0, 120),
      seeded: !!(a.seeded || b.seeded),
      turns: Math.min(num(a.turns), num(b.turns)),   // 保守：谁数得少按谁来，别白白跳过点名
      refuse: Math.max(num(a.refuse), num(b.refuse))
    };
  }

  const MERGERS = { heart: mergeHeartBox, gaze: mergeGazeBox };

  // 整份合并：{charId: box} × {charId: box} → {charId: box}
  // ⚠️一边没有的角色【原样保留另一边的】——这就是「只进不出」。
  function mergeMap(kind, local, remote) {
    const f = MERGERS[kind];
    if (!f) return obj(local);
    const l = obj(local), r = obj(remote), out = {};
    new Set([...Object.keys(l), ...Object.keys(r)]).forEach(id => {
      if (!l[id]) { out[id] = r[id]; return; }
      if (!r[id]) { out[id] = l[id]; return; }
      out[id] = f(l[id], r[id]);
    });
    return out;
  }

  // 哪几个角色的这一份跟合并后不一样 → 只推这几行，别每次整份重推
  function changedIds(kind, before, merged) {
    const b = obj(before), m = obj(merged), out = [];
    Object.keys(m).forEach(id => {
      if (JSON.stringify(b[id]) !== JSON.stringify(m[id])) out.push(id);
    });
    return out;
  }

  root.GrownSync = { KINDS: Object.keys(MERGERS), mergeMap, changedIds, mergeHeartBox, mergeGazeBox, mergeList };
})(typeof window !== "undefined" ? window : globalThis);
