// ============================================================
// 只带几个人走、合并进来（群友 2026-10-29：「为了 char 不打架，分开装了四份，想把几个人整合起来」）
//   pick：从一整份存档里挑出【只跟这几个人有关】的那部分。
//   merge：把挑出来的那部分【加进】另一份存档，原来的人和设置一根不动。
//   纯函数，不碰 localStorage / IndexedDB / 界面；读写都在 app.js 那头。
//
// 怎么认「跟谁有关」——不按一个个存档键去写规则（几十个键，写一张表迟早漏一个），只看三样：
//   ① 键名里带着谁的编号（x_offline:c123、c123::房间）；
//   ② 键值是个以编号为键的表（{ c123: …, c456: … }）——只留选中那几个人的那几格；
//   ③ 键值是个列表——每一条里提到谁：只提到选中的人才留，提到了没选的人就不带（关系线、群这类）。
//   哪个人都没提到的（全局设置、主题、API、面具、钱包余额……）一律不带——它们属于那一份手机，不属于这几个人。
//   群：成员全是选中的人才跟着走，它自己的编号也当成「要带的人」。
// ⚠️编号认的是整词（前后不是字母数字），「c1」不会认成「c10」里的那一截。
// ============================================================
(function () {
  "use strict";
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // 前后不是字母数字就算一个整词——下划线、冒号、短横算分隔（x_offline_c1、img_c1_3、c1::房间 都认得出）。
  //   长的排前面：c1_mw4t 和 c1 同时在场时先认长的。
  const sortLong = ids => ids.slice().sort((a, b) => b.length - a.length);
  const wordRe = ids => ids.length ? new RegExp("(?<![A-Za-z0-9])(?:" + sortLong(ids).map(esc).join("|") + ")(?![A-Za-z0-9])") : null;
  const parse = v => { if (typeof v !== "string") return undefined; try { return JSON.parse(v); } catch (e) { return undefined; } };
  const listOf = (data, k) => { const v = parse(data && data[k]); return Array.isArray(v) ? v.filter(x => x && x.id != null) : []; };

  function pick(data, keepCharIds) {
    data = data || {};
    const keepSet = new Set((keepCharIds || []).map(String));
    const chars = listOf(data, "x_characters"), groups = listOf(data, "x_groups");
    const keptChars = chars.filter(c => keepSet.has(String(c.id)));
    const keptGroups = groups.filter(g => Array.isArray(g.memberIds) && g.memberIds.length && g.memberIds.every(id => keepSet.has(String(id))));
    const keep = keptChars.map(c => String(c.id)).concat(keptGroups.map(g => String(g.id)));
    const drop = chars.filter(c => !keepSet.has(String(c.id))).map(c => String(c.id))
      .concat(groups.filter(g => keptGroups.indexOf(g) < 0).map(g => String(g.id)));
    const K = wordRe(keep), D = wordRe(drop);
    const has = (re, s) => !!re && re.test(s);
    const mine = s => has(K, s) && !has(D, s);
    const out = {};
    if (!keep.length) return { data: out, ids: [], groups: [] };
    out.x_characters = JSON.stringify(keptChars);
    if (keptGroups.length) out.x_groups = JSON.stringify(keptGroups);
    Object.keys(data).forEach(k => {
      if (k === "x_characters" || k === "x_groups") return;
      const v = data[k];
      if (has(K, k) || has(D, k)) { if (mine(k)) out[k] = v; return; }
      const pv = parse(v);
      if (Array.isArray(pv)) {
        const items = pv.filter(it => { const s = typeof it === "string" ? it : JSON.stringify(it); return mine(s); });
        if (items.length) out[k] = JSON.stringify(items);
      } else if (pv && typeof pv === "object") {
        const o = {}; let n = 0;
        Object.keys(pv).forEach(sub => { if (mine(sub)) { o[sub] = pv[sub]; n++; } });
        if (n) out[k] = JSON.stringify(o);
      }
    });
    return { data: out, ids: keptChars.map(c => String(c.id)), groups: keptGroups.map(g => String(g.id)), names: keptChars.map(c => c.name || "") };
  }

  // 编号撞了就给后进来的换一个：整份里所有提到它的地方（键名、键值）一起换
  function remap(pack, localIds) {
    const taken = new Set((localIds || []).map(String));
    const ids = (pack.ids || []).concat(pack.groups || []);
    const map = {};
    ids.forEach(id => { if (taken.has(String(id))) { let n; do { n = id + "_m" + Math.random().toString(36).slice(2, 6); } while (taken.has(n)); map[id] = n; taken.add(n); } });
    const olds = Object.keys(map);
    if (!olds.length) return { pack, map };
    const re = new RegExp("(?<![A-Za-z0-9])(" + sortLong(olds).map(esc).join("|") + ")(?![A-Za-z0-9])", "g");
    const sw = s => String(s).replace(re, m => map[m] || m);
    const data = {};
    Object.keys(pack.data || {}).forEach(k => { data[sw(k)] = typeof pack.data[k] === "string" ? sw(pack.data[k]) : pack.data[k]; });
    const selfies = {};
    Object.keys(pack.selfies || {}).forEach(k => { selfies[sw(k)] = pack.selfies[k]; });
    return { pack: Object.assign({}, pack, { data, selfies, ids: (pack.ids || []).map(sw), groups: (pack.groups || []).map(sw) }), map };
  }

  // 加进去，不覆盖：返回要写的那几个键（整串）。原来就有的键：列表接在后面（同一个 id 不重复），表补上缺的那几格；
  //   别的样子（一个数、一句字）本机那份算数。
  function merge(local, pack) {
    local = local || {};
    const localIds = listOf(local, "x_characters").map(c => String(c.id)).concat(listOf(local, "x_groups").map(g => String(g.id)));
    const r = remap(pack, localIds);
    const writes = {};
    Object.keys(r.pack.data || {}).forEach(k => {
      const v = r.pack.data[k], lv = local[k];
      if (lv == null) { writes[k] = v; return; }
      const a = parse(lv), b = parse(v);
      if (Array.isArray(a) && Array.isArray(b)) {
        const seen = new Set(a.filter(x => x && x.id != null).map(x => String(x.id)));
        const add = b.filter(x => !(x && x.id != null && seen.has(String(x.id))));
        if (add.length) writes[k] = JSON.stringify(a.concat(add));
      } else if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
        const o = Object.assign({}, a); let n = 0;
        Object.keys(b).forEach(sub => { if (!(sub in o)) { o[sub] = b[sub]; n++; } });
        if (n) writes[k] = JSON.stringify(o);
      }
    });
    return { writes, map: r.map, pack: r.pack };
  }

  const api = { pick, merge, remap };
  if (typeof window !== "undefined") window.CharTransfer = api;
  if (typeof module !== "undefined") module.exports = api;
})();
