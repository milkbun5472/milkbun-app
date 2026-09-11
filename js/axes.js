// ============================================================
// 掷轴 —— 「掷约束，不掷答案」那个形状的公共实现
// （施工规则/bans-make-it-dumber.md 的后半条；one-public-mechanism.md）
//
// 它第一次出现在电台的「临时台」上（她 2026-09-10 拦下那张写死的表：
// 「如果只是我们写的很杂，那还是有想不到的层面，可能模型本身能写出很出色的随机台」），
// 第二次出现在同人文的「角色来写」上（他不是作家，那他的毛病长什么样）。
// 第二次出现时就该抽公共的，**而且把第一处也搬过来**——只开公共的、旧的留在原地，
// 是最坏的那一种（从此同一层规则活在两处）。
//
// 形状本身：
//   · 不问「今天是什么」（无约束 → 塌回先验中心），
//     也不写死「今天是气象台」（有约束 → 但天花板是我们的）；
//   · 掷几条**互相独立**的轴，让它去想「同时满足这几条的东西是什么」。
//   · **每条轴上留一格「你自己想一个」**，而且偶尔整组还回去。
//     代码不是关门，是关一部分门：地板是代码的，天花板是模型的。
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.Axes = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const S = v => String(v == null ? "" : v);

  // 稳定 0..1。⚠️收尾那三步（murmur3 的 fmix32）不许省：
  // 光跑 FNV 的话，只有最后一个字不一样的两串算出来的数是挨着的，
  // 于是「按序号掷」出来的不是分布，是一条缓慢爬行的线（2026-09-10 在电台上撞出来过）。
  function seed01() {
    const str = Array.prototype.slice.call(arguments).map(S).join("|");
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 2246822507);
    h ^= h >>> 13; h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const pick = (list, ...parts) => (Array.isArray(list) && list.length)
    ? list[Math.floor(seed01.apply(null, parts) * list.length) % list.length] : null;

  const FREE = "（这一轴你自己想一个，别用上面那种）";
  // 默认那几档概率。调用方可以按自己那一处的分寸改，但**不许把 free 调成 0**——
  // 那就等于代码把门关死了，天花板又变回我们的。
  const DEFAULT = { allFree: 0.08, skip: 0.15, free: 0.20 };

  // axes: [{ key, zh, opts: [...] }]
  // 返回 { free: 整组都还回去了吗, rows: [{key, zh, opt}] }
  function roll(axes, parts, opts) {
    const list = Array.isArray(axes) ? axes : [];
    const p = Object.assign({}, DEFAULT, opts || {});
    const seed = (Array.isArray(parts) ? parts : [parts]).map(S);
    if (p.allFree > 0 && seed01.apply(null, seed.concat(["allfree"])) < p.allFree) return { free: true, rows: [] };
    const rows = [];
    list.forEach(function (ax) {
      if (!ax || !ax.key) return;
      const r = seed01.apply(null, seed.concat([ax.key]));
      if (r < p.skip) return;                                         // 这一轴今天不掷
      if (r < p.skip + p.free) { rows.push({ key: ax.key, zh: ax.zh, opt: FREE }); return; }
      rows.push({ key: ax.key, zh: ax.zh, opt: pick(ax.opts, seed.join("|"), ax.key, "pick") });
    });
    return { free: rows.length === 0, rows: rows };
  }

  // ── 一批里每人／每篇分一组【互不相同】的落点 ────────────────────────
  // ⚠️第二次出现就抽公共的（one-public-mechanism）：
  //   第一处是同人文请太太（笔名／口气／路数落点），第二处是出一批文（每篇的落点）。
  //   共同的那三件事是——① 一人一组掷；② **一批之内不放回**（撞了就往后顺一格，
  //   顺到没得顺才认，不然分到同一格的那两个又会长成一个样）；
  //   ③「你自己想一个」那一格不占位（它本来就不是从表里挑的）。
  //
  // groups: [{ axes:[...], opts:{} }]——每组有自己的概率（比如笔名那一组 skip 归零）。
  // 返回：out[i] = [{rows, free}, ...]，一组一个，调用方自己拼话。
  function batch(groups, n, parts, sharedOpts) {
    const gs = (Array.isArray(groups) ? groups : [groups]).filter(Boolean);
    const cnt = Math.max(1, Number(n) || 1);
    const seed = (Array.isArray(parts) ? parts : [parts]).map(S);
    const all = gs.reduce(function (acc, g) { return acc.concat(g.axes || []); }, []);
    const used = {};
    const shift = function (key, opt) {
      const ax = all.filter(function (a) { return a && a.key === key; })[0];
      const list = (ax && ax.opts) || [];
      const seen = used[key] || (used[key] = {});
      let o = opt;
      if (seen[o]) {
        const at = list.indexOf(o);
        for (let k = 1; k <= list.length; k++) {
          const c = list[(at + k + list.length) % list.length];
          if (!seen[c]) { o = c; break; }
        }
      }
      seen[o] = 1;
      return o;
    };
    const out = [];
    for (let i = 0; i < cnt; i++) {
      out.push(gs.map(function (g, gi) {
        const r = roll(g.axes || [], seed.concat([i, gi ? "g" + gi : ""]), Object.assign({}, sharedOpts || {}, g.opts || {}));
        const rows = (r.rows || []).map(function (row) {
          return row.opt === FREE ? row : { key: row.key, zh: row.zh, opt: shift(row.key, row.opt) };
        });
        return { free: !!r.free || !rows.length, rows: rows };
      }));
    }
    return out;
  }
  // 一组 rows → 「甲＝乙；丙＝丁」那一行（一批里一人一行，用这个拼）
  function line(rows) {
    return (rows || []).map(function (r) { return S(r.zh) + "＝" + S(r.opt); }).join("；");
  }

  // rolled → 一段可以直接拼进 system 的话。
  // head.on = 掷到了东西时的领句；head.off = 整组还回去时那一句。
  function text(rolled, head) {
    const h = head || {};
    if (!rolled || rolled.free || !rolled.rows.length) return S(h.off);
    return S(h.on) + "\n" + rolled.rows.map(function (r) { return "· " + S(r.zh) + "：" + S(r.opt); }).join("\n");
  }

  return { seed01, pick, roll, batch, line, text, FREE, DEFAULT };
});
