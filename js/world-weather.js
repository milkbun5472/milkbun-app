// 架空世界的天气（Lisa 2026-09-04 要的第二样：「如果要架空的地图怎么安排天气呢」）
//
// 一枪都不花。天气不是问模型要来的，是【按世界 id + 地方名 + 那一天】算出来的：
// 同一个地方同一天，你今天看和明天回头看，一模一样；换一块地方、换一天，才会变。
// 存档里不多存一个字节——`x_worlds` 里本来就有的 terrain 就是这份气候档案的全部输入。
//
// ⚠️为什么不问模型：她按次计费，而天气是【每次打开都要看】的东西。
//    问一次得存一份，存了就要管过期、管同步、管刷新；算出来的不用管任何一样。
//
// 输出的形状和真实天气那条线【完全一样】（{code,t,lo,hi} / hourly / daily），
// 所以天气详情页那一整页不用分叉：wmoKind / wmoZh / GWx 原样用得上。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WorldWeather = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // 六种地形各自的脾气：常温、日夜温差、下雨的概率、起雾的概率。
  // terrain 这一栏是造世界那一枪写下的（app.js 的 genWorld：山地|平原|森林|水泽|荒漠|城郭）。
  const CLIMATE = {
    "山地": { base: 8, amp: 10, wet: .34, fog: .18, wind: "山口的风" },
    "平原": { base: 15, amp: 11, wet: .30, fog: .10, wind: "过野的风" },
    "森林": { base: 14, amp: 7, wet: .42, fog: .22, wind: "林间的风" },
    "水泽": { base: 17, amp: 6, wet: .55, fog: .30, wind: "水面的风" },
    "荒漠": { base: 26, amp: 17, wet: .05, fog: .02, wind: "卷沙的风" },
    "城郭": { base: 16, amp: 10, wet: .28, fog: .12, wind: "檐下的风" }
  };
  function climateOf(terrain) { return CLIMATE[terrain] || CLIMATE["平原"]; }

  function hash(str) {
    let x = 2166136261 >>> 0;
    const s = String(str == null ? "" : str);
    for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
    return x >>> 0;
  }
  // mulberry32：同一个种子永远同一串数
  function rngOf(seed) {
    let a = hash(seed) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function dayKey(d) {
    const x = d instanceof Date ? d : new Date(d || Date.now());
    return x.getFullYear() + "-" + (x.getMonth() + 1) + "-" + x.getDate();
  }
  // 季节跟着她自己的日历走：一月最冷、七月最热。
  // 架空世界也过冬——不跟着走的话，这份天气就跟她此刻在过的日子完全脱节。
  function seasonAdj(d) {
    const x = d instanceof Date ? d : new Date(d || Date.now());
    const doy = Math.floor((x - new Date(x.getFullYear(), 0, 0)) / 86400000);
    return -Math.cos(doy / 365 * Math.PI * 2) * 8;
  }
  // 日轮曲线：凌晨 4 点最低、下午 4 点最高
  function curve(hr) { return (1 - Math.cos((hr - 4) / 24 * Math.PI * 2)) / 2; }
  // 一天的天气：{code,hi,lo,t}
  function dayOf(seed, terrain, date) {
    const c = climateOf(terrain);
    const r = rngOf(seed + "|" + dayKey(date));
    const mid = c.base + seasonAdj(date) + (r() - .5) * 7;
    const hi = Math.round(mid + c.amp / 2);
    const lo = Math.round(mid - c.amp / 2);
    let code = 0;
    const roll = r();
    if (roll < c.wet) {
      // 够冷就下雪，够热又够湿才打雷
      if (mid <= 1) code = [71, 73, 75][Math.floor(r() * 3)];
      else if (mid >= 24 && r() < .28) code = 95;
      else code = [51, 61, 63, 80][Math.floor(r() * 4)];
    } else if (roll < c.wet + c.fog) code = 45;
    else {
      const cl = r();
      code = cl < .42 ? 0 : (cl < .76 ? 2 : 3);
    }
    // 「现在几度」要和逐小时那条曲线用同一条，否则卡片上写 10° 而横条上写 14°
    return { code: code, hi: hi, lo: lo, t: Math.round(lo + (hi - lo) * curve((date instanceof Date ? date : new Date()).getHours())) };
  }
  function forecast(seed, terrain, date, days) {
    const n = Math.max(1, Math.min(14, days || 7));
    const start = date instanceof Date ? date : new Date(date || Date.now());
    const out = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const x = dayOf(seed, terrain, d);
      out.push({ d: d, code: x.code, hi: x.hi, lo: x.lo });
    }
    return out;
  }
  // 逐小时：温度走一条日轮曲线（凌晨 4 点最低、下午 3 点最高），
  // 天象绝大多数时候跟着当天那个码，夜里回落成阴/晴。
  function hours(seed, terrain, date, count) {
    const now = date instanceof Date ? date : new Date(date || Date.now());
    const n = Math.max(1, Math.min(48, count || 24));
    const out = [];
    for (let i = 0; i < n; i++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + i);
      const day = dayOf(seed, terrain, at);
      const hr = at.getHours();
      const t = Math.round(day.lo + (day.hi - day.lo) * curve(hr));
      const r = rngOf(seed + "|" + dayKey(at) + "|h" + hr);
      let code = day.code;
      // 下雨那天也不是整天在下：夜里和清晨先歇一阵
      if (day.code >= 51 && r() < .35) code = 3;
      if (day.code === 45 && hr > 10 && hr < 19) code = 2;
      const p = code >= 95 ? 80 : (code >= 71 && code <= 86 ? 70 : (code >= 51 ? 55 : (day.code >= 51 ? 25 : 0)));
      out.push({ h: hr, t: t, p: p, code: code });
    }
    return out;
  }
  // 把 x_worlds 摊成一串可以看天气的地方。
  // ⚠️字段名照【写 x_worlds 那段代码】抄（app.js 的 genWorld：{id,name,regions:[{name,terrain}]}），
  //   不是照这儿以为的样子编（.claude/rules/stub-from-the-writer.md）。
  function placesOf(worlds) {
    const out = [];
    (Array.isArray(worlds) ? worlds : []).forEach(function (w) {
      if (!w || !w.id) return;
      (Array.isArray(w.regions) ? w.regions : []).forEach(function (rg) {
        if (!rg || !rg.name) return;
        out.push({
          key: "w:" + w.id + ":" + rg.name,
          seed: w.id + "|" + rg.name,
          world: String(w.name || "无名之地"),
          region: String(rg.name),
          terrain: String(rg.terrain || "平原"),
          label: String(rg.name),
          sub: String(w.name || "无名之地")
        });
      });
    });
    return out;
  }
  function windOf(terrain) { return climateOf(terrain).wind; }
  return { CLIMATE: CLIMATE, climateOf: climateOf, dayOf: dayOf, forecast: forecast, hours: hours, placesOf: placesOf, windOf: windOf, _hash: hash };
});
