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

  // rolled → 一段可以直接拼进 system 的话。
  // head.on = 掷到了东西时的领句；head.off = 整组还回去时那一句。
  function text(rolled, head) {
    const h = head || {};
    if (!rolled || rolled.free || !rolled.rows.length) return S(h.off);
    return S(h.on) + "\n" + rolled.rows.map(function (r) { return "· " + S(r.zh) + "：" + S(r.opt); }).join("\n");
  }

  return { seed01, pick, roll, text, FREE, DEFAULT };
});
