// ============================================================
// 星测（v74.590，她 2026-10-03 画在「每日看」文件夹里那一格：
//   「星座配对指数 / 星宿关系 / 每日运势 / 幸运色」）
//
// 三样都是【算】出来的，不调模型、不花钱：
//   · 星座：公历生日 → 十二宫；两人配对看相隔几宫（同元素、相生、对宫、刑……）
//   · 星宿：宿曜二十七宿。农历生日 → 本命宿；两人关系看相隔几宿（命/业胎/荣亲/友衰/安坏/危成）
//   · 每日：星座 + 今天的日期当种子，同一天打开永远是同一份
// 只有「让 TA 看看」那一下才调一次模型（runProbe voice，跟解梦馆同一条路，人设/心情/反八股整份白得）。
//
// 她定的三条（2026-10-03）：配对【我和角色、角色和角色】都能配；
//   点评照塔罗那样「点了才算」；没填生日的就说不知道、点一下去档案填，不瞎编。
// ============================================================
(function () {
  "use strict";
  const g = typeof window !== "undefined" ? window : globalThis;

  // ── 算 ────────────────────────────────────────────────────
  const SIGNS = [
    ["白羊", 3, 21], ["金牛", 4, 20], ["双子", 5, 21], ["巨蟹", 6, 22], ["狮子", 7, 23], ["处女", 8, 23],
    ["天秤", 9, 23], ["天蝎", 10, 24], ["射手", 11, 23], ["摩羯", 12, 22], ["水瓶", 1, 20], ["双鱼", 2, 19]
  ];
  const ELEMENTS = ["火", "土", "风", "水"];
  // 公历月日 → 第几宫（0＝白羊）
  function signOf(mo, d) {
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return -1;
    for (let i = 0; i < 12; i++) {
      const s = SIGNS[i], n = SIGNS[(i + 1) % 12];
      const from = s[1] * 100 + s[2], to = n[1] * 100 + n[2], x = mo * 100 + d;
      if (from < to ? (x >= from && x < to) : (x >= from || x < to)) return i;
    }
    return -1;
  }
  // 配对看两宫相隔几格（绕一圈取近的那头）。说明文字只描述【这种相位】，不替任何人下结论。
  const ASPECTS = {
    0: [80, "同一个星座", "像照镜子：很懂对方，也很容易在同一个地方一起钻牛角尖。"],
    1: [66, "相邻两宫", "节奏差半拍，一个往前走另一个在收尾，需要磨合的是步调。"],
    2: [84, "元素相生", "火配风、土配水：一个给另一个添柴，聊得起来，也愿意顺着对方。"],
    3: [60, "四分相", "都有主意，而且主意常常不一样；吵得起来，也最容易把对方逼出新的样子。"],
    4: [90, "同一元素", "底色一样，不用多解释就懂；最舒服的那一种合拍。"],
    5: [64, "补十二分相", "看不太懂对方的路数，要多问一句才接得上，接上了反而新鲜。"],
    6: [74, "对宫", "正好站在对面：缺的正是对方有的，拉扯和吸引是同一件事。"]
  };
  function signMatch(a, b) {
    if (a < 0 || b < 0) return null;
    const k = Math.min(Math.abs(a - b), 12 - Math.abs(a - b));
    const x = ASPECTS[k];
    return { score: x[0], aspect: x[1], note: x[2], gap: k };
  }

  // 宿曜二十七宿（没有牛宿）。正月初一起室宿，往后每月初一的起宿固定，日子往后数。
  const SHUKU = ["角", "亢", "氐", "房", "心", "尾", "箕", "斗", "女", "虚", "危", "室", "壁", "奎", "娄", "胃", "昴", "毕", "觜", "参", "井", "鬼", "柳", "星", "张", "翼", "轸"];
  const SHUKU_MONTH_START = [null, "室", "奎", "胃", "毕", "参", "鬼", "张", "角", "氐", "心", "斗", "虚"];
  function shukuOf(lm, ld) {
    if (!(lm >= 1 && lm <= 12 && ld >= 1 && ld <= 30)) return -1;
    return (SHUKU.indexOf(SHUKU_MONTH_START[lm]) + ld - 1) % 27;
  }
  // 从 A 往后数到 B 是第几位（自己＝第 1 位），三九秘法的那一圈：
  const SHUKU_POS = ["命", "荣", "衰", "安", "危", "成", "坏", "友", "亲", "业", "荣", "衰", "安", "危", "成", "坏", "友", "亲",
    "胎", "荣", "衰", "安", "危", "成", "坏", "友", "亲"];
  const SHUKU_PAIR = { 命: "命", 业: "业胎", 胎: "业胎", 荣: "荣亲", 亲: "荣亲", 友: "友衰", 衰: "友衰", 安: "安坏", 坏: "安坏", 危: "危成", 成: "危成" };
  const SHUKU_NOTE = {
    命: "同一个本命宿：像另一个自己，一眼就认得，也会把对方的毛病看成自己的。",
    业胎: "前世今生的那一档：说不清为什么就是绕不开，一个牵着另一个走。",
    荣亲: "最顺的一档：互相成全，在一起两个人都过得更好。",
    友衰: "像朋友那样处得来，但待久了会互相耗着，要留点各自的空。",
    安坏: "最需要小心的一档：一个让另一个安心，另一个却可能把对方拆掉——吸引力也最强。",
    危成: "一开始不太顺，越处越成；彼此是对方需要的那块磨刀石。"
  };
  function shukuRelation(a, b) {
    if (a < 0 || b < 0) return null;
    const p = ((b - a) % 27 + 27) % 27;          // 0..26
    const mine = SHUKU_POS[p], theirs = SHUKU_POS[(27 - p) % 27];
    const pair = SHUKU_PAIR[mine];
    const d = Math.min(p, 27 - p);
    return { pair: pair, mine: mine, theirs: theirs, distance: p === 0 ? "" : d <= 4 ? "近距离" : d <= 9 ? "中距离" : "远距离", note: SHUKU_NOTE[pair] };
  }

  // 生日 → 星座、本命宿。⚠️认不出的那一半给 null，界面照实说「还算不了」。
  //   · 农历生日：宿直接有；星座要换成公历，有年份就精确换，没年份按今年换（个别跨宫边界的人可能差一宫，界面会注「约」）
  //   · 公历生日：星座直接有；宿要换成农历，**没年份换不了**（同一个公历日子每年落在不同的农历日）
  function birthInfo(birthday) {
    const raw = String(birthday || "").trim();
    if (!raw) return null;
    const out = { sign: -1, shuku: -1, signApprox: false, shukuNeedsYear: false };
    const lu = typeof parseLunarBirthday === "function" ? parseLunarBirthday(raw) : null;
    if (lu) {
      out.shuku = shukuOf(lu.m, lu.d);
      let sd = lu.y && typeof lunarToSolar === "function" ? lunarToSolar(lu.y, lu.m, lu.d, lu.isLeap) : null;
      if (!sd && typeof birthdaySolarDate === "function") { sd = birthdaySolarDate(raw, new Date().getFullYear()); out.signApprox = !!sd; }
      if (sd) out.sign = signOf(sd.getMonth() + 1, sd.getDate());
      return out;
    }
    const md = typeof parseMonthDay === "function" ? parseMonthDay(raw) : null;
    if (!md) return null;
    out.sign = signOf(md.mo, md.d);
    const ym = raw.match(/(\d{4})\s*[-/.年]/);
    const l = ym && typeof solarToLunar === "function" ? solarToLunar(new Date(+ym[1], md.mo - 1, md.d)) : null;
    if (l) out.shuku = shukuOf(l.m, l.d); else out.shukuNeedsYear = true;
    return out;
  }

  // 每日：星座 + 日期 当种子。同一天同一个星座永远同一份。
  function seedOf(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const LUCKY_COLORS = [
    ["雾霾蓝", "#7d93ac"], ["燕麦色", "#d8c8a8"], ["豆沙粉", "#c9939a"], ["橄榄绿", "#7f8a55"], ["奶油白", "#f3ead6"],
    ["焦糖棕", "#a5683a"], ["薄荷绿", "#9fd1bd"], ["酒红", "#8a2e3b"], ["鹅黄", "#f2d675"], ["藏青", "#2f3d63"],
    ["香芋紫", "#a99bc9"], ["珊瑚橙", "#ee8d6f"], ["月白", "#dfe6ea"], ["墨绿", "#2f5146"], ["樱花粉", "#f2c1cf"], ["炭灰", "#4a4a4f"]
  ];
  const DAY_LINES = {
    5: ["今天手气在你这边，想做的事别拖到明天。", "顺得出奇的一天，记得留一点给晚上。", "开口就有回应的一天。"],
    4: ["大体顺，小地方多看一眼就好。", "适合把一件拖了很久的事收个尾。", "有人在等你先说话。"],
    3: ["平平的一天，平平也挺好。", "按自己的节奏来，别被别人催着走。", "适合整理，不适合冒进。"],
    2: ["有点逆风，慢一点反而省事。", "今天说话前多想半秒。", "累了就早点收工，不算认输。"],
    1: ["诸事不宜大动，窝着也是一种选择。", "把期待放低一点，今天会好过很多。", "适合躲起来充电。"]
  };
  function dayKeyOf(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function daily(sign, dayKey) {
    if (sign < 0) return null;
    const r = rng(seedOf("astro|" + dayKey + "|" + sign));
    const star = () => 1 + Math.floor(r() * 5);
    const love = star(), work = star(), money = star();
    const all = Math.max(1, Math.min(5, Math.round((love + work + money) / 3 + (r() - 0.5))));
    const color = LUCKY_COLORS[Math.floor(r() * LUCKY_COLORS.length)];
    const lines = DAY_LINES[all];
    return { all: all, love: love, work: work, money: money, color: { name: color[0], hex: color[1] }, number: 1 + Math.floor(r() * 9), line: lines[Math.floor(r() * lines.length)] };
  }


  // ── 严谨版：星历 → 星盘 → 合盘 / 行运（v74.600，她 2026-10-03：「要是更严谨点得咋弄」「就在星测里面设置城市」）──
  // 星历（Paul Schlyter「How to compute planetary positions」那一套）：1900~2100 年内误差在一两度以内
  const RAD = Math.PI / 180;
  const rev = x => ((x % 360) + 360) % 360;
  const sind = x => Math.sin(x * RAD), cosd = x => Math.cos(x * RAD);
  const atan2d = (y, x) => Math.atan2(y, x) / RAD;
  function dayNum(dt) {   // dt: Date（UTC 时刻）
    const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, D = dt.getUTCDate();
    const ut = dt.getUTCHours() + dt.getUTCMinutes() / 60 + dt.getUTCSeconds() / 3600;
    return 367 * y - Math.floor(7 * (y + Math.floor((m + 9) / 12)) / 4) + Math.floor(275 * m / 9) + D - 730530 + ut / 24;
  }
  const ELEM = {
    sun: d => ({ N: 0, i: 0, w: 282.9404 + 4.70935e-5 * d, a: 1, e: 0.016709 - 1.151e-9 * d, M: 356.0470 + 0.9856002585 * d }),
    moon: d => ({ N: 125.1228 - 0.0529538083 * d, i: 5.1454, w: 318.0634 + 0.1643573223 * d, a: 60.2666, e: 0.054900, M: 115.3654 + 13.0649929509 * d }),
    mercury: d => ({ N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5.00e-8 * d, w: 29.1241 + 1.01444e-5 * d, a: 0.387098, e: 0.205635 + 5.59e-10 * d, M: 168.6562 + 4.0923344368 * d }),
    venus: d => ({ N: 76.6799 + 2.46590e-5 * d, i: 3.3946 + 2.75e-8 * d, w: 54.8910 + 1.38374e-5 * d, a: 0.723330, e: 0.006773 - 1.302e-9 * d, M: 48.0052 + 1.6021302244 * d }),
    mars: d => ({ N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d, w: 286.5016 + 2.92961e-5 * d, a: 1.523688, e: 0.093405 + 2.516e-9 * d, M: 18.6021 + 0.5240207766 * d }),
    jupiter: d => ({ N: 100.4542 + 2.76854e-5 * d, i: 1.3030 - 1.557e-7 * d, w: 273.8777 + 1.64505e-5 * d, a: 5.20256, e: 0.048498 + 4.469e-9 * d, M: 19.8950 + 0.0830853001 * d }),
    saturn: d => ({ N: 113.6634 + 2.38980e-5 * d, i: 2.4886 - 1.081e-7 * d, w: 339.3939 + 2.97661e-5 * d, a: 9.55475, e: 0.055546 - 9.499e-9 * d, M: 316.9670 + 0.0334442282 * d }),
    uranus: d => ({ N: 74.0005 + 1.3978e-5 * d, i: 0.7733 + 1.9e-8 * d, w: 96.6612 + 3.0565e-5 * d, a: 19.18171 - 1.55e-8 * d, e: 0.047318 + 7.45e-9 * d, M: 142.5905 + 0.011725806 * d }),
    neptune: d => ({ N: 131.7806 + 3.0173e-5 * d, i: 1.7700 - 2.55e-7 * d, w: 272.8461 - 6.027e-6 * d, a: 30.05826 + 3.313e-8 * d, e: 0.008606 + 2.15e-9 * d, M: 260.2471 + 0.005995147 * d })
  };
  function kepler(o) {
    const M = rev(o.M), e = o.e;
    let E = M + (e / RAD) * sind(M) * (1 + e * cosd(M));
    for (let k = 0; k < 8; k++) E = E - (E - (e / RAD) * sind(E) - M) / (1 - e * cosd(E));
    const xv = o.a * (cosd(E) - e), yv = o.a * Math.sqrt(1 - e * e) * sind(E);
    const v = atan2d(yv, xv), r = Math.sqrt(xv * xv + yv * yv);
    const N = o.N, w = o.w, i = o.i;
    return {
      x: r * (cosd(N) * cosd(v + w) - sind(N) * sind(v + w) * cosd(i)),
      y: r * (sind(N) * cosd(v + w) + cosd(N) * sind(v + w) * cosd(i)),
      z: r * (sind(v + w) * sind(i)), v: v, r: r
    };
  }
  function planetLongitudes(dt) {
    const d = dayNum(dt);
    const so = ELEM.sun(d), sk = kepler(so);
    const sunLon = rev(sk.v + so.w);
    const xs = sk.r * cosd(sunLon), ys = sk.r * sind(sunLon);
    const out = { sun: sunLon };
    // 月亮（本来就是地心的）+ 主要摄动
    const mo = ELEM.moon(d), mk = kepler(mo);
    const Ms = rev(so.M), Mm = rev(mo.M), Ls = rev(so.M + so.w), Lm = rev(mo.M + mo.w + mo.N);
    const D = Lm - Ls, F = Lm - mo.N;
    out.moon = rev(atan2d(mk.y, mk.x)
      - 1.274 * sind(Mm - 2 * D) + 0.658 * sind(2 * D) - 0.186 * sind(Ms) - 0.059 * sind(2 * Mm - 2 * D)
      - 0.057 * sind(Mm - 2 * D + Ms) + 0.053 * sind(Mm + 2 * D) + 0.046 * sind(2 * D - Ms) + 0.041 * sind(Mm - Ms)
      - 0.035 * sind(D) - 0.031 * sind(Mm + Ms) - 0.015 * sind(2 * F - 2 * D) + 0.011 * sind(Mm - 4 * D));
    const Mj = rev(ELEM.jupiter(d).M), Msa = rev(ELEM.saturn(d).M), Mu = rev(ELEM.uranus(d).M);
    ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"].forEach(k => {
      const h = kepler(ELEM[k](d));
      let lon = atan2d(h.y, h.x), lat = atan2d(h.z, Math.sqrt(h.x * h.x + h.y * h.y)), r = Math.sqrt(h.x * h.x + h.y * h.y + h.z * h.z);
      if (k === "jupiter") lon += -0.332 * sind(2 * Mj - 5 * Msa - 67.6) - 0.056 * sind(2 * Mj - 2 * Msa + 21) + 0.042 * sind(3 * Mj - 5 * Msa + 21)
        - 0.036 * sind(Mj - 2 * Msa) + 0.022 * cosd(Mj - Msa) + 0.023 * sind(2 * Mj - 3 * Msa + 52) - 0.016 * sind(Mj - 5 * Msa - 69);
      if (k === "saturn") lon += 0.812 * sind(2 * Mj - 5 * Msa - 67.6) - 0.229 * cosd(2 * Mj - 4 * Msa - 2) + 0.119 * sind(Mj - 2 * Msa - 3)
        + 0.046 * sind(2 * Mj - 6 * Msa - 69) + 0.014 * sind(Mj - 3 * Msa + 32);
      if (k === "uranus") lon += 0.040 * sind(Msa - 2 * Mu + 6) + 0.035 * sind(Msa - 3 * Mu + 33) - 0.015 * sind(Mj - Mu + 20);
      const xh = r * cosd(lon) * cosd(lat), yh = r * sind(lon) * cosd(lat);
      out[k] = rev(atan2d(yh + ys, xh + xs));
    });
    // 冥王星：数值拟合（J2000 春分点），再补上岁差
    const S = 50.03 + 0.033459652 * d, P = 238.95 + 0.003968789 * d;
    const pl = 238.9508 + 0.00400703 * d - 19.799 * sind(P) + 19.848 * cosd(P) + 0.897 * sind(2 * P) - 4.956 * cosd(2 * P)
      + 0.610 * sind(3 * P) + 1.211 * cosd(3 * P) - 0.341 * sind(4 * P) - 0.190 * cosd(4 * P) + 0.128 * sind(5 * P) - 0.034 * cosd(5 * P)
      - 0.038 * sind(6 * P) + 0.031 * cosd(6 * P) + 0.020 * sind(S - P) - 0.010 * cosd(S - P);
    const pb = -3.9082 - 5.453 * sind(P) - 14.975 * cosd(P) + 3.527 * sind(2 * P) + 1.673 * cosd(2 * P) - 1.051 * sind(3 * P) + 0.328 * cosd(3 * P)
      + 0.179 * sind(4 * P) - 0.292 * cosd(4 * P) + 0.019 * sind(5 * P) + 0.100 * cosd(5 * P) - 0.031 * sind(6 * P) - 0.026 * cosd(6 * P) + 0.011 * cosd(S - P);
    const pr = 40.72 + 6.68 * sind(P) + 6.90 * cosd(P) - 1.18 * sind(2 * P) - 0.03 * cosd(2 * P) + 0.15 * sind(3 * P) - 0.14 * cosd(3 * P);
    const pxh = pr * cosd(pl) * cosd(pb), pyh = pr * sind(pl) * cosd(pb);
    out.pluto = rev(atan2d(pyh + ys, pxh + xs) + 3.82394e-5 * d);
    return out;
  }
  // 上升：本地恒星时 → 上升点黄经。lat/lon 东经为正
  function ascendant(dt, lat, lon) {
    const d = dayNum(dt), so = ELEM.sun(d);
    const ut = dt.getUTCHours() + dt.getUTCMinutes() / 60 + dt.getUTCSeconds() / 3600;
    const ramc = rev(so.M + so.w + 180 + ut * 15.04107 + lon);
    const ecl = 23.4393 - 3.563e-7 * d;
    return rev(atan2d(cosd(ramc), -(sind(ramc) * cosd(ecl) + Math.tan(lat * RAD) * sind(ecl))));
  }


  const PLANETS = [["sun", "太阳"], ["moon", "月亮"], ["mercury", "水星"], ["venus", "金星"], ["mars", "火星"],
    ["jupiter", "木星"], ["saturn", "土星"], ["uranus", "天王星"], ["neptune", "海王星"], ["pluto", "冥王星"]];
  const PL_ZH = {}; PLANETS.forEach(x => { PL_ZH[x[0]] = x[1]; }); PL_ZH.asc = "上升";
  // 每颗星管哪一块（说明文字只说「管什么」，不替人下结论）
  const PL_THEME = { sun: "自我和精神头", moon: "情绪和安全感", mercury: "说话和想法", venus: "喜欢和享受", mars: "行动和脾气",
    jupiter: "运气和舒展", saturn: "责任和压力", uranus: "变化和意外", neptune: "想象和迷糊", pluto: "很深的执念和改变", asc: "给人的第一印象" };
  const ASPECTS_DEG = [
    { k: "conj", zh: "合", deg: 0, orb: 8, tone: 0, verb: "被放大了" },
    { k: "sext", zh: "六合", deg: 60, orb: 4, tone: 1, verb: "有个顺手的机会" },
    { k: "sq", zh: "刑", deg: 90, orb: 6, tone: -1, verb: "容易起摩擦" },
    { k: "tri", zh: "拱", deg: 120, orb: 6, tone: 1, verb: "很顺" },
    { k: "opp", zh: "冲", deg: 180, orb: 8, tone: -1, verb: "被两头拉扯" }
  ];
  // 合相本身不分好坏，看是哪两颗：温和的星合在一起偏甜，硬的星合在一起偏烈
  const SOFT = { venus: 1, moon: 1, jupiter: 1, sun: 0.5 }, HARD = { mars: 1, saturn: 1, pluto: 1, uranus: 0.5 };
  const lonDiff = (a, b) => { const x = Math.abs(rev(a) - rev(b)); return x > 180 ? 360 - x : x; };
  function aspectOf(a, b, orbScale) {
    const dd = lonDiff(a, b);
    for (const asp of ASPECTS_DEG) { const off = Math.abs(dd - asp.deg); if (off <= asp.orb * (orbScale || 1)) return { asp: asp, off: off }; }
    return null;
  }
  const signDeg = lon => ({ sign: Math.floor(rev(lon) / 30), deg: Math.floor(rev(lon) % 30) });

  // 城市：经纬度 + 标准时区（夏令时不算——夏令时那几年出生的，自己把时间往前拨一小时）
  const CITIES = [
    ["北京", 39.90, 116.41, 8], ["上海", 31.23, 121.47, 8], ["天津", 39.13, 117.20, 8], ["重庆", 29.56, 106.55, 8], ["广州", 23.13, 113.26, 8],
    ["深圳", 22.54, 114.06, 8], ["杭州", 30.27, 120.15, 8], ["南京", 32.06, 118.80, 8], ["苏州", 31.30, 120.59, 8], ["武汉", 30.59, 114.31, 8],
    ["成都", 30.57, 104.07, 8], ["西安", 34.34, 108.94, 8], ["长沙", 28.23, 112.94, 8], ["郑州", 34.75, 113.63, 8], ["济南", 36.65, 117.12, 8],
    ["青岛", 36.07, 120.38, 8], ["沈阳", 41.80, 123.43, 8], ["大连", 38.91, 121.61, 8], ["哈尔滨", 45.80, 126.53, 8], ["长春", 43.82, 125.32, 8],
    ["石家庄", 38.04, 114.51, 8], ["太原", 37.87, 112.55, 8], ["呼和浩特", 40.84, 111.75, 8], ["合肥", 31.82, 117.23, 8], ["福州", 26.07, 119.30, 8],
    ["厦门", 24.48, 118.09, 8], ["南昌", 28.68, 115.86, 8], ["南宁", 22.82, 108.37, 8], ["海口", 20.04, 110.20, 8], ["三亚", 18.25, 109.51, 8],
    ["贵阳", 26.65, 106.63, 8], ["昆明", 25.04, 102.71, 8], ["拉萨", 29.65, 91.13, 8], ["兰州", 36.06, 103.83, 8], ["西宁", 36.62, 101.78, 8],
    ["银川", 38.49, 106.23, 8], ["乌鲁木齐", 43.83, 87.62, 8], ["宁波", 29.87, 121.55, 8], ["无锡", 31.49, 120.31, 8], ["温州", 28.00, 120.67, 8],
    ["佛山", 23.02, 113.12, 8], ["东莞", 23.02, 113.75, 8], ["珠海", 22.27, 113.58, 8], ["洛阳", 34.62, 112.45, 8], ["扬州", 32.39, 119.41, 8],
    ["桂林", 25.27, 110.29, 8], ["香港", 22.32, 114.17, 8], ["澳门", 22.20, 113.54, 8], ["台北", 25.03, 121.57, 8], ["高雄", 22.63, 120.30, 8],
    ["东京", 35.68, 139.69, 9], ["大阪", 34.69, 135.50, 9], ["首尔", 37.57, 126.98, 9], ["釜山", 35.18, 129.08, 9], ["新加坡", 1.35, 103.82, 8],
    ["吉隆坡", 3.14, 101.69, 8], ["曼谷", 13.76, 100.50, 7], ["河内", 21.03, 105.85, 7], ["马尼拉", 14.60, 120.98, 8], ["雅加达", -6.21, 106.85, 7],
    ["新德里", 28.61, 77.21, 5.5], ["迪拜", 25.20, 55.27, 4], ["莫斯科", 55.76, 37.62, 3], ["伊斯坦布尔", 41.01, 28.98, 3], ["开罗", 30.04, 31.24, 2],
    ["伦敦", 51.51, -0.13, 0], ["巴黎", 48.86, 2.35, 1], ["柏林", 52.52, 13.40, 1], ["罗马", 41.90, 12.50, 1], ["马德里", 40.42, -3.70, 1],
    ["阿姆斯特丹", 52.37, 4.90, 1], ["维也纳", 48.21, 16.37, 1], ["纽约", 40.71, -74.01, -5], ["波士顿", 42.36, -71.06, -5], ["多伦多", 43.65, -79.38, -5],
    ["芝加哥", 41.88, -87.63, -6], ["洛杉矶", 34.05, -118.24, -8], ["旧金山", 37.77, -122.42, -8], ["西雅图", 47.61, -122.33, -8], ["温哥华", 49.28, -123.12, -8],
    ["悉尼", -33.87, 151.21, 10], ["墨尔本", -37.81, 144.96, 10], ["奥克兰", -36.85, 174.76, 12]
  ];
  // 内置列表里不在大陆的那几个（夏令时只有大陆 1986~1991 那几年有）
  const NON_CN = { 香港: "hk", 澳门: "mo", 台北: "tw", 高雄: "tw" };
  const cityCC = c => NON_CN[c[0]] || (c[3] === 8 && CITIES.indexOf(c) < 50 ? "cn" : "");
  // 中国夏令时（tzdata 的 PRC 规则）：1986 年 5 月 4 日起；1987~1991 年 4 月第一个 ≥11 号的星期天 2:00 拨快，
  //   1986~1991 年 9 月第一个 ≥11 号的星期天 2:00 拨回。那几年夏天出生的，当地钟表时间比东八区快一小时。
  function sundayOnOrAfter(y, mo, day) { const d = new Date(Date.UTC(y, mo - 1, day)); d.setUTCDate(day + (7 - d.getUTCDay()) % 7); return d.getUTCDate(); }
  function chinaDst(y, mo, d, hh) {
    if (y < 1986 || y > 1991) return false;
    const sM = y === 1986 ? 5 : 4, sD = y === 1986 ? 4 : sundayOnOrAfter(y, 4, 11), eD = sundayOnOrAfter(y, 9, 11);
    const x = mo * 10000 + d * 100 + hh, from = sM * 10000 + sD * 100 + 2, to = 9 * 10000 + eD * 100 + 2;
    return x >= from && x < to;
  }
  // 国家 → 标准时区。一个国家好几个时区的（美、加、俄、澳、巴西、墨西哥、印尼、哈萨克、蒙古）不在表里：按经度猜，界面上让她确认
  const CC_TZ = { cn: 8, hk: 8, mo: 8, tw: 8, jp: 9, kr: 9, kp: 9, sg: 8, my: 8, ph: 8, bn: 8, th: 7, vn: 7, la: 7, kh: 7, mm: 6.5, in: 5.5, lk: 5.5, np: 5.75,
    bd: 6, bt: 6, pk: 5, af: 4.5, ae: 4, om: 4, qa: 3, sa: 3, kw: 3, iq: 3, ir: 3.5, tr: 3, by: 3, eg: 2, il: 2, jo: 2, lb: 2, gr: 2, fi: 2, ee: 2, lv: 2, lt: 2,
    ua: 2, ro: 2, bg: 2, za: 2, gb: 0, ie: 0, pt: 0, is: 0, ma: 0, fr: 1, de: 1, it: 1, es: 1, nl: 1, be: 1, lu: 1, ch: 1, at: 1, se: 1, no: 1, dk: 1, pl: 1,
    cz: 1, sk: 1, hu: 1, si: 1, hr: 1, rs: 1, ng: 1, nz: 12, ar: -3, uy: -3, cl: -4, ve: -4, bo: -4, pe: -5, co: -5, ec: -5, cu: -5, ke: 3, et: 3, tz: 3 };
  function tzForPlace(cc, lon) {
    cc = String(cc || "").toLowerCase();
    if (CC_TZ[cc] != null) return { tz: CC_TZ[cc], guessed: false };
    // 美国、加拿大本土四个时区按经度大致分一刀（边界是弯的，所以照样标「猜的」）
    if (cc === "us" || cc === "ca") return { tz: lon > -87.5 ? -5 : lon > -101.5 ? -6 : lon > -114.5 ? -7 : lon > -141 ? -8 : -9, guessed: true };
    return { tz: Math.round(lon / 15), guessed: true };
  }
  // 在线地名搜索（OpenStreetMap 的 Nominatim）：只发她输入的那个地名。连不上就退回内置列表
  async function searchPlace(q) {
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&accept-language=zh-CN&q=" + encodeURIComponent(q);
    const r = await (typeof fetchT === "function" ? fetchT(url, { headers: { Accept: "application/json" } }, 12000) : fetch(url));
    if (!r.ok) throw new Error("地名搜索没回应（HTTP " + r.status + "）");
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map(x => {
      const lat = parseFloat(x.lat), lon = parseFloat(x.lon), cc = x.address && x.address.country_code || "";
      const tz = tzForPlace(cc, lon);
      return { name: String(x.name || (x.display_name || "").split(",")[0] || q).trim(), full: String(x.display_name || ""), lat: lat, lon: lon, cc: cc, tz: tz.tz, guessed: tz.guessed };
    }).filter(x => isFinite(x.lat) && isFinite(x.lon));
  }
  const BIRTH_KEY = "x_astro_birth";
  function loadBirth() { try { const v = loadJSON(BIRTH_KEY, {}); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
  function saveBirth(all) { saveJSON(BIRTH_KEY, all); return all; }

  // 公历出生日期（要有年份）。农历带年份的先换公历。没有年份就算不了星盘
  function birthDateOf(birthday) {
    const raw = String(birthday || "").trim();
    if (!raw) return null;
    const lu = typeof parseLunarBirthday === "function" ? parseLunarBirthday(raw) : null;
    if (lu) { if (!lu.y) return null; const d = lunarToSolar(lu.y, lu.m, lu.d, lu.isLeap); return d ? { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate() } : null; }
    const ym = raw.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
    return ym ? { y: +ym[1], mo: +ym[2], d: +ym[3] } : null;
  }
  // 星盘：有年份才算；有城市用城市时区，没城市按东八区；没时间按当地正午算，月亮会标「可能差一点」，上升不算
  function natalChart(birthday, info) {
    const bd = birthDateOf(birthday);
    if (!bd || bd.y < 1901 || bd.y > 2099) return null;
    info = info || {};
    const tm = /^(\d{1,2}):(\d{2})$/.exec(String(info.time || ""));
    const hh = tm ? +tm[1] : 12, mm = tm ? +tm[2] : 0;
    // 大陆出生、1986~1991 年夏天：钟表时间是夏令时，自动按东九区换算（她不用自己往前拨）
    // 哪国：存了 cc 就用；老存档没 cc 的按内置城市名认；自己填经纬度的，东八区且落在大陆那一片才算大陆；什么都没填按大陆
    const known = info.city ? CITIES.find(c => c[0] === info.city) : null;
    const cc = info.cc || (known ? cityCC(known) : !info.city ? "cn"
      : (+info.tz === 8 && info.lat >= 18 && info.lat <= 54 && info.lon >= 73 && info.lon <= 135 ? "cn" : ""));
    const cnPlace = cc === "cn";
    const dst = !!tm && info.dst !== false && cnPlace && chinaDst(bd.y, bd.mo, bd.d, hh);
    const tz = (isFinite(info.tz) ? +info.tz : 8) + (dst ? 1 : 0);
    const utc = new Date(Date.UTC(bd.y, bd.mo - 1, bd.d, hh, mm) - tz * 3600e3);
    const lon = planetLongitudes(utc);
    const hasPlace = isFinite(info.lat) && isFinite(info.lon);
    const chart = { lon: lon, hasTime: !!tm, hasPlace: hasPlace, dst: dst };
    if (tm && hasPlace) chart.lon = Object.assign({}, lon, { asc: ascendant(utc, +info.lat, +info.lon) });
    // 没时间时月亮一天走十二三度：离星座边界不到七度就可能换宫
    if (!tm) { const m = rev(lon.moon) % 30; chart.moonUnsure = m < 7 || m > 23; }
    return chart;
  }
  const KEYS_FOR = chart => PLANETS.map(x => x[0]).concat(chart && chart.lon.asc != null ? ["asc"] : []).filter(k => !(k === "moon" && chart.moonUnsure));
  const PAIR_WEIGHT = k => ({ sun: 1.4, moon: 1.4, venus: 1.5, mars: 1.3, asc: 1.2, mercury: 1, jupiter: 0.9, saturn: 1 })[k] || 0.5;
  // 合盘：两张盘之间所有行星的相位。分数＝好相位加、硬相位减，按星的分量和合得多紧加权
  function synastry(ca, cb) {
    if (!ca || !cb) return null;
    const list = [];
    KEYS_FOR(ca).forEach(a => KEYS_FOR(cb).forEach(b => {
      const hit = aspectOf(ca.lon[a], cb.lon[b]);
      if (!hit) return;
      let tone = hit.asp.tone;
      if (hit.asp.k === "conj") tone = ((SOFT[a] || 0) + (SOFT[b] || 0) - (HARD[a] || 0) - (HARD[b] || 0)) > 0 ? 1 : ((HARD[a] || 0) + (HARD[b] || 0) > 0 ? -0.5 : 0.5);
      const w = PAIR_WEIGHT(a) * PAIR_WEIGHT(b) * (1 - hit.off / (hit.asp.orb + 1));
      list.push({ a: a, b: b, asp: hit.asp, off: hit.off, tone: tone, w: w });
    }));
    list.sort((x, y) => y.w - x.w);
    const sum = list.reduce((t, x) => t + x.tone * x.w, 0);
    const heat = list.reduce((t, x) => t + x.w, 0);
    const score = Math.max(32, Math.min(98, Math.round(60 + sum * 4.2)));
    return { score: score, list: list, heat: heat };
  }
  // 行运：今天天上的星 对 本命盘。只取合得紧的（月亮放宽一点），按分量排
  function transits(chart, when) {
    if (!chart) return null;
    const now = planetLongitudes(when || new Date());
    const hits = [];
    PLANETS.map(x => x[0]).forEach(t => KEYS_FOR(chart).forEach(n => {
      const hit = aspectOf(now[t], chart.lon[n], t === "moon" ? 0.7 : 0.4);
      if (!hit) return;
      const slow = { jupiter: 1.2, saturn: 1.3, uranus: 1.1, neptune: 1, pluto: 1.1 }[t] || 1;
      hits.push({ t: t, n: n, asp: hit.asp, off: hit.off, w: PAIR_WEIGHT(n) * slow * (1 - hit.off / (hit.asp.orb + 1)) });
    }));
    hits.sort((x, y) => y.w - x.w);
    // 几颗星：每一块看管那一块的星今天挨了什么相位
    const area = (keys) => {
      const sc = hits.filter(x => keys.indexOf(x.t) >= 0 || keys.indexOf(x.n) >= 0).reduce((t, x) => t + (x.asp.tone || (SOFT[x.t] ? 0.6 : HARD[x.t] ? -0.6 : 0.2)) * x.w, 0);
      return Math.max(1, Math.min(5, Math.round(3 + sc * 1.2)));
    };
    const love = area(["venus", "moon"]), work = area(["sun", "mercury", "mars", "saturn"]), money = area(["jupiter", "venus"]);
    return { hits: hits.slice(0, 5), love: love, work: work, money: money, all: Math.max(1, Math.min(5, Math.round((love + work + money) / 3))) };
  }
  const transitLine = x => "行运" + PL_ZH[x.t] + x.asp.zh + "你的" + PL_ZH[x.n] + "：" + PL_THEME[x.n] + "这块" + x.asp.verb;
  const synLine = (x, A, B) => A + "的" + PL_ZH[x.a] + " " + x.asp.zh + " " + B + "的" + PL_ZH[x.b];

  // ── 天象（她 2026-10-05 点的第 3 条：满月新月、水逆、换星座这些日子，挂日历、悄悄告诉角色）──
  //   都是用上面同一份星历算的，不调模型。按当地正午取样，跟前一天比：跨过 0°／180°＝新月满月，
  //   水星黄经往回走＝逆行，进了新的三十度＝换星座。只报真发生了的那天。
  const noonOf = dk => { const a = String(dk).split("-").map(Number); return new Date(a[0], a[1] - 1, a[2], 12, 0, 0); };
  const sdiff = (b, a) => { let d = rev(b) - rev(a); if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
  const SKY_MOVERS = [["sun", "太阳"], ["venus", "金星"], ["mars", "火星"], ["jupiter", "木星"], ["saturn", "土星"]];
  const skyCache = {};
  function skyOn(dk) {
    if (skyCache[dk]) return skyCache[dk];
    // 这一天＝当地 0 点到次日 0 点：事情发生在这段里就算这一天（新月在晚上 11 点也是这一天，不是第二天）
    const t0 = noonOf(dk); t0.setHours(0, 0, 0, 0);
    const a = planetLongitudes(t0), b = planetLongitudes(new Date(t0.getTime() + 864e5)), z = planetLongitudes(new Date(t0.getTime() - 864e5));
    const ev = [];
    const ea = rev(a.moon - a.sun), eb = rev(b.moon - b.sun);
    if (eb < ea) ev.push({ k: "new", icon: "🌑", text: "新月" });
    else if (ea < 180 && eb >= 180) ev.push({ k: "full", icon: "🌕", text: "满月" });
    const retroA = sdiff(a.mercury, z.mercury) < 0, retroB = sdiff(b.mercury, a.mercury) < 0;
    if (!retroA && retroB) ev.push({ k: "rxStart", icon: "☿", text: "水星开始逆行" });
    if (retroA && !retroB) ev.push({ k: "rxEnd", icon: "☿", text: "水逆结束" });
    SKY_MOVERS.forEach(([k, zh]) => { const sa = Math.floor(rev(a[k]) / 30), sb = Math.floor(rev(b[k]) / 30); if (sa !== sb) ev.push({ k: "in_" + k, icon: "✦", text: zh + "进入" + SIGNS[sb][0] + "座" }); });
    const out = { events: ev, mercuryRx: retroB };
    const ks = Object.keys(skyCache); if (ks.length > 120) delete skyCache[ks[0]];
    skyCache[dk] = out; return out;
  }
  // 水逆还要多久结束（往后最多找 40 天）
  function rxEndFrom(dk) { const t = noonOf(dk); for (let i = 1; i <= 40; i++) { const d = dayKeyOf(new Date(t.getTime() + i * 864e5)); if (!skyOn(d).mercuryRx) return d; } return ""; }
  // 给角色那一行：只说天上发生了什么，信不信、提不提是TA的事
  function skyNote(date) {
    const dk = dayKeyOf(date || new Date()), s = skyOn(dk), bits = s.events.map(e => e.text);
    if (s.mercuryRx && !s.events.some(e => e.k === "rxStart")) { const end = rxEndFrom(dk); bits.push("水星逆行中" + (end ? "（" + end.slice(5).replace("-", "月") + "日结束）" : "")); }
    return bits.join("、");
  }
  // ── 你俩的好日子（第 6 条）：接下来哪几天行运对两个人的金星、月亮、太阳、上升都顺 ──
  //   只看温和的那几颗（金星、木星、月亮）落在两人星盘上的相位；两个人都顺才算，挑最好的三天。
  const GOOD_T = { venus: 1.2, jupiter: 1.1, moon: 0.7 }, GOOD_N = { venus: 1.3, moon: 1.1, sun: 1, asc: 0.9 };
  function goodFor(chart, now) {
    let sc = 0;
    Object.keys(GOOD_T).forEach(t => Object.keys(GOOD_N).forEach(n => {
      if (chart.lon[n] == null || (n === "moon" && chart.moonUnsure)) return;
      const hit = aspectOf(now[t], chart.lon[n], t === "moon" ? 0.6 : 0.5); if (!hit) return;
      const tone = hit.asp.k === "conj" ? 1 : hit.asp.tone;
      sc += tone * GOOD_T[t] * GOOD_N[n] * (1 - hit.off / (hit.asp.orb + 1));
    }));
    return sc;
  }
  function goodDays(ca, cb, from, days) {
    if (!ca || !cb) return [];
    const start = noonOf(dayKeyOf(from || new Date())), rows = [];
    for (let i = 0; i < (days || 30); i++) {
      const d = new Date(start.getTime() + i * 864e5), now = planetLongitudes(d);
      const x = goodFor(ca, now), y = goodFor(cb, now);
      if (x > 0.6 && y > 0.6) rows.push({ day: dayKeyOf(d), score: Math.round((x + y) * 10) / 10 });
    }
    return rows.sort((p, q) => q.score - p.score).slice(0, 3).sort((p, q) => (p.day < q.day ? -1 : 1));
  }
  // 我和某个角色的好日子：星测里存的出生信息 + 档案生日，两边都排得出星盘才有
  // ⚠️日历一个月四十来格、每格都会问一遍：同一天、同样的出生信息只算一次
  const goodCache = {};
  function pairGoodDays(meBirthday, charId, charBirthday, from, days) {
    const b = loadBirth();
    const key = [meBirthday, charId, charBirthday, JSON.stringify(b.me || {}), JSON.stringify(b[charId] || {}), dayKeyOf(from || new Date()), days].join("|");
    if (goodCache[key]) return goodCache[key];
    const ks = Object.keys(goodCache); if (ks.length > 60) delete goodCache[ks[0]];
    return (goodCache[key] = goodDays(natalChart(meBirthday, b.me), natalChart(charBirthday, b[charId]), from, days));
  }
  // ── 太阳回归（第 5 条，生日那周的年运卡）：今年太阳回到出生那一刻位置的那一天，那一刻的天 ↔ 本命盘 ──
  function solarReturn(chart, year) {
    if (!chart) return null;
    const target = chart.lon.sun;
    let t = new Date(Date.UTC(year, 0, 1));
    for (let i = 0; i < 366; i++) { const d = new Date(t.getTime() + i * 864e5); if (Math.abs(sdiff(planetLongitudes(d).sun, target)) < 0.6) { t = d; break; } }
    for (let k = 0; k < 20; k++) { const off = sdiff(target, planetLongitudes(t).sun); if (Math.abs(off) < 0.01) break; t = new Date(t.getTime() + off / 0.9856 * 864e5); }
    const lon = planetLongitudes(t), ret = { lon, hasTime: true, moonUnsure: false };
    const syn = synastry(ret, chart);
    return { when: t, day: dayKeyOf(t), moonSign: Math.floor(rev(lon.moon) / 30), list: syn ? syn.list.slice(0, 5) : [], score: syn ? syn.score : null };
  }
  const yearLine = x => "这一年的" + PL_ZH[x.a] + x.asp.zh + "你的" + PL_ZH[x.b] + "：" + PL_THEME[x.b] + "这块" + x.asp.verb;
  // ── 问星星一件事（第 4 条）：按问的是哪一块，挑今天行运里管那一块的那一相；没星盘就按星座日运。同一天同一问，答案不变 ──
  const ASK_AREAS = [[/喜欢|爱|表白|恋|在一起|分手|复合|暧昧|约会|他|她|对象|crush/i, ["venus", "moon"], "感情"], [/工作|面试|考试|学习|上班|老板|项目|论文|offer|升职|作业/i, ["sun", "mercury", "mars", "saturn"], "事情"],
    [/钱|买|工资|投资|花|省|贵|理财|消费/i, ["jupiter", "venus"], "钱"]];
  function askStars(question, chart, sign, dk) {
    const q = String(question || "").trim(); if (!q) return null;
    const area = ASK_AREAS.find(a => a[0].test(q)) || [null, null, "这件事"];
    let seed = 0; for (const ch of (q + dk)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const r = rng(seed);
    let tone = 0, line = "";
    const tr = chart ? transits(chart, noonOf(dk)) : null;
    if (tr && tr.hits.length) {
      const pick = (area[1] ? tr.hits.find(x => area[1].indexOf(x.t) >= 0 || area[1].indexOf(x.n) >= 0) : null) || tr.hits[0];
      tone = pick.asp.tone || (SOFT[pick.t] ? 0.5 : HARD[pick.t] ? -0.5 : 0); line = transitLine(pick);
    } else if (sign >= 0) {
      const d = daily(sign, dk), v = area[2] === "感情" ? d.love : area[2] === "钱" ? d.money : area[2] === "事情" ? d.work : d.all;
      tone = (v - 3) / 2; line = "只按星座算：今天" + area[2] + " " + v + " 星";
    } else return null;
    const YES = ["星星点头了", "可以，往前走", "顺着去吧"], WAIT = ["缓一缓再说", "今天先别急", "等它自己再亮一点"], MID = ["看你自己", "星星没表态", "一半一半"];
    const pool = tone > 0.2 ? YES : tone < -0.2 ? WAIT : MID;
    return { q, area: area[2], verdict: pool[Math.floor(r() * pool.length)], line, day: dk };
  }
  // ── 今日签（第 3 条）：TA 替她抽一张签。手动（星测里点）和自动（TA 每天早上自己发）用同一份提示词 ──
  const SIGN_SCHEMA = "{\"title\":\"签名，四到八个字\",\"text\":\"写在签上的话，一两句\"}";
  function signInstruction(meName, facts) {
    return "你替" + meName + "抽一张今天的签。下面是按她的星座和今天的日子算出来的（不是你编的）：\n" + facts + "\n"
      + "签上写什么、怎么写、当不当真，全由你这个人决定——可以照着运势写，也可以完全不信、写你自己想对她说的。title 是签名，text 是签上的话。";
  }
  function todayFacts(profile, birth, dk) {
    const info = birthInfo((profile || {}).birthday); if (!info || info.sign < 0) return "";
    const d0 = daily(info.sign, dk), chart = natalChart(profile.birthday, (birth || {}).me), tr = chart ? transits(chart, noonOf(dk)) : null;
    const d = !tr ? d0 : Object.assign({}, d0, { all: tr.all, love: tr.love, work: tr.work, money: tr.money, line: tr.hits.length ? transitLine(tr.hits[0]) + "。" : d0.line });
    return signName(info.sign) + "；综合 " + d.all + " 星，爱情 " + d.love + "、事业 " + d.work + "、财运 " + d.money + " 星；幸运色" + d.color.name + "、幸运数字 " + d.number + "；" + d.line
      + (skyNote(noonOf(dk)) ? "今天的天象：" + skyNote(noonOf(dk)) + "。" : "");
  }
  // 聊天里那张小签（转发回去的、TA 自己发来的都是它）——外框走 components.js 的 shareCardOf
  function AstroSignCard({ m }) {
    const S = sky(), a = (m && m.astro) || {}, d = new Date(a.ts || m.ts || Date.now());
    return h("div", { "data-wk": "astroshare", style: { width: 196, borderRadius: 4, overflow: "hidden", background: S.bg, backgroundImage: STARS, backgroundSize: "320px 380px", border: "1px solid " + S.tint + "66", boxShadow: "0 4px 14px rgba(20,22,50,.25)" } },
      h("div", { style: { padding: "12px 14px 14px", textAlign: "center" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: 3, color: S.fog } }, "今日签 · " + (d.getMonth() + 1) + "." + d.getDate()),
        h("div", { style: { width: 1, height: 14, background: S.tint, margin: "8px auto 6px", opacity: 0.6 } }),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: S.tint, lineHeight: 1.3 } }, a.title || "签"),
        a.text ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: S.ink, lineHeight: 1.7, marginTop: 8, textAlign: "left" } }, a.text) : null,
        a.by ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 8, textAlign: "right" } }, "—— " + a.by + " 抽的") : null));
  }
  // ── 月亮日记（第 5 条）：今天月亮在哪个星座 + 一个情绪小词；她顺手记的心情就是健康 app 心情那一格（同一份）──
  const MOON_WORD = ["冲劲", "安稳", "好奇", "想家", "想被看见", "挑剔", "想讲和", "很深", "想跑远", "收着", "抽离", "迷糊"];
  const moonSignOn = dk => Math.floor(rev(planetLongitudes(noonOf(dk)).moon) / 30);

  const ASK_KEY = "x_astro_asks", SIGN_KEY = "x_astro_signs";
  const loadAsks = () => { try { const v = loadJSON(ASK_KEY, []); return Array.isArray(v) ? v : []; } catch (e) { return []; } };

  // ── 存 ────────────────────────────────────────────────────
  // x_astro_notes：TA的点评。{ "<种类>|<日期或配对>|<谁说的>": { text, ts } }，只留最近 120 条。
  const NOTE_KEY = "x_astro_notes";
  function loadNotes() { try { const v = loadJSON(NOTE_KEY, {}); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
  function saveNote(key, text) {
    const all = loadNotes();
    all[key] = { text: String(text || ""), ts: Date.now() };
    const keys = Object.keys(all).sort((a, b) => (all[b].ts || 0) - (all[a].ts || 0));
    keys.slice(120).forEach(k => delete all[k]);
    saveJSON(NOTE_KEY, all);
    return all;
  }

  // ── 提示词（只给【她看到的那份算出来的结果】，怎么说由他自己）──
  const voiceTail = () => (typeof probeVoiceTail === "function" ? probeVoiceTail() : "");
  function signName(i) { return i >= 0 ? SIGNS[i][0] + "座" : "不知道什么星座"; }

  // ── 画 ────────────────────────────────────────────────────
  const { useState, useMemo } = React;
  const SKY_BASE = { bg: "#151a33", bg2: "#20264a", ink: "#eef0fb", sub: "rgba(238,240,251,.66)", fog: "rgba(238,240,251,.42)", line: "rgba(238,240,251,.14)", accent: "#e7b7c8", tint: "#c9b66f" };
  const sky = () => (typeof pagePalette === "function" ? pagePalette("astro", SKY_BASE) : SKY_BASE);
  // 天上那层碎星：一颗种子摊成一张贴图，铺在外壳上（mobile-ui-layout §3.5：底纹铺外壳、顶栏透明、不跟着滚）
  const STARS = (function () {
    const r = rng(20261003);
    let s = "";
    for (let i = 0; i < 40; i++) s += "<circle cx='" + (r() * 320).toFixed(1) + "' cy='" + (r() * 380).toFixed(1) + "' r='" + (r() < 0.12 ? 1.3 : 0.6) + "' fill='white' opacity='" + (0.25 + r() * 0.55).toFixed(2) + "'/>";
    return "url(\"data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='320' height='380'>" + s + "</svg>") + "\")";
  })();

  function Stars({ n, color }) {
    return h("span", { style: { letterSpacing: 2, color: color, fontSize: 13 } }, "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n));
  }

  // tab 长成一段星座连线（tabs-not-plain-pills）：三颗星连着一根线，选中那颗大、亮、带光晕，
  // 走到它为止那段线是实的，后面是虚的。
  function StarTabs({ tabs, cur, onPick, S }) {
    const idx = tabs.findIndex(x => x[0] === cur);
    // 线从第一颗星的圆心连到最后一颗：n 格均分，圆心在每格正中
    const n = tabs.length, edge = 50 / n, span = 100 - 2 * edge;
    return h("div", { "data-wk": "astrotabs", style: { position: "relative", display: "flex", padding: "6px 0 4px" } },
      h("div", { style: { position: "absolute", left: edge + "%", width: span + "%", top: 22, height: 0, borderTop: "1px dashed " + S.line } }),
      h("div", { style: { position: "absolute", left: edge + "%", width: (n > 1 ? idx / (n - 1) : 0) * span + "%", top: 22, height: 0, borderTop: "1.5px solid " + S.tint } }),
      tabs.map((tb, i) => {
        const on = tb[0] === cur;
        return h("button", { key: tb[0], onClick: () => onPick(tb[0]), "aria-pressed": on, className: "active:opacity-70",
          style: { flex: 1, minHeight: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: "transparent", border: "none", position: "relative" } },
          h("span", { style: { width: on ? 14 : 8, height: on ? 14 : 8, marginTop: on ? 9 : 12, borderRadius: 99, background: on ? S.tint : (i < idx ? S.tint : S.bg2),
            border: "1px solid " + (on || i < idx ? S.tint : S.line), boxShadow: on ? "0 0 0 4px " + S.tint + "33, 0 0 14px " + S.tint : "none", transition: "all .2s" } }),
          h("span", { style: { fontFamily: F_BODY, fontSize: on ? 13.5 : 12.5, color: on ? S.ink : S.sub, fontWeight: on ? 600 : 400 } }, tb[1]));
      }));
  }

  // 不再一块一个框（她 2026-10-03：「不喜欢这种边框，你看塔罗做的 UI 就很好看」）：
  //   照塔罗那片天来——字直接写在天上，段与段之间一颗小星芒领着一道渐隐的发丝线。
  const sparkle = (cx, cy, R) => {
    const w = R * 0.16;
    return "M" + cx + " " + (cy - R) + "Q" + (cx + w) + " " + (cy - w) + " " + (cx + R) + " " + cy
      + "Q" + (cx + w) + " " + (cy + w) + " " + cx + " " + (cy + R)
      + "Q" + (cx - w) + " " + (cy + w) + " " + (cx - R) + " " + cy
      + "Q" + (cx - w) + " " + (cy - w) + " " + cx + " " + (cy - R) + "z";
  };
  function Spark({ size, color, op }) {
    return h("svg", { width: size || 10, height: size || 10, viewBox: "0 0 12 12", style: { flexShrink: 0, display: "inline-block", verticalAlign: "middle" } },
      h("path", { d: sparkle(6, 6, 5.4), fill: color, opacity: op == null ? 0.85 : op }));
  }
  function Panel({ S, children, style, title }) {
    return h("div", { "data-wk": "astrocard", style: Object.assign({ padding: "4px 2px 14px" }, style || {}) },
      title ? h("div", { className: "flex items-center", style: { gap: 7, margin: "10px 0 10px" } },
        h(Spark, { size: 9, color: S.tint }),
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, letterSpacing: ".18em" } }, title),
        h("span", { style: { flex: 1, height: 1, background: "linear-gradient(to right," + S.line + ",transparent)" } })) : null,
      children);
  }
  // 今日那一栏的头：十二宫一圈，你那一宫亮着。字和刻度都画在天上，没有底板。
  function ZodiacWheel({ S, sign }) {
    const W = 300, C = 150, R = 118;
    return h("svg", { viewBox: "0 0 " + W + " " + W, style: { width: "min(78%, 290px)", display: "block", margin: "2px auto 0" } },
      h("defs", null, h("radialGradient", { id: "astroHalo" },
        h("stop", { offset: "0%", stopColor: S.tint, stopOpacity: 0.55 }), h("stop", { offset: "100%", stopColor: S.tint, stopOpacity: 0 }))),
      h("circle", { cx: C, cy: C, r: R + 16, fill: "none", stroke: S.line, strokeWidth: 0.8 }),
      h("circle", { cx: C, cy: C, r: R - 16, fill: "none", stroke: S.line, strokeWidth: 0.6, strokeDasharray: "1.5 4" }),
      SIGNS.map((sg, i) => {
        const a = (i * 30 - 90 - 15) * Math.PI / 180, b = (i * 30 - 90) * Math.PI / 180;
        const on = i === sign;
        const x = C + Math.cos(b) * R, y = C + Math.sin(b) * R;
        return h("g", { key: i },
          h("line", { x1: C + Math.cos(a) * (R + 16), y1: C + Math.sin(a) * (R + 16), x2: C + Math.cos(a) * (R - 16), y2: C + Math.sin(a) * (R - 16), stroke: S.line, strokeWidth: 0.6 }),
          on ? h("circle", { cx: x, cy: y, r: 26, fill: "url(#astroHalo)" }) : null,
          h("text", { x: x, y: y + 4, textAnchor: "middle", fontSize: on ? 14 : 11, fill: on ? S.ink : S.fog, fontFamily: F_BODY, fontWeight: on ? 600 : 400 }, sg[0]));
      }),
      sign >= 0 ? h("path", { d: sparkle(C, C, 30), fill: S.tint, opacity: 0.9 }) : null,
      sign >= 0 ? h("path", { d: sparkle(C, C, 46), fill: S.tint, opacity: 0.12 }) : null);
  }

  // 一张真的星盘（第 1 条）：外圈十二宫，里圈每颗星按出生那一刻的黄经落位；贴得太近的往里错开一层
  const PL_GLYPH = { sun: "日", moon: "月", mercury: "水", venus: "金", mars: "火", jupiter: "木", saturn: "土", uranus: "天", neptune: "海", pluto: "冥", asc: "升" };
  function ChartWheel({ S, chart }) {
    const W = 300, C = 150, R = 128;
    const ang = lon => (rev(lon) - 90) * Math.PI / 180;
    const keys = PLANETS.map(x => x[0]).concat(chart.lon.asc != null ? ["asc"] : []);
    const placed = [];
    keys.slice().sort((a, b) => rev(chart.lon[a]) - rev(chart.lon[b])).forEach(k => {
      let ring = 0; while (ring < 4 && placed.some(p => p.ring === ring && lonDiff(p.lon, chart.lon[k]) < 11)) ring++;
      placed.push({ k, lon: chart.lon[k], ring });
    });
    return h("svg", { "data-wk": "astrowheel", viewBox: "0 0 " + W + " " + W, style: { width: "min(86%, 300px)", display: "block", margin: "0 auto" } },
      h("circle", { cx: C, cy: C, r: R, fill: "none", stroke: S.line, strokeWidth: 0.8 }),
      h("circle", { cx: C, cy: C, r: R - 24, fill: "none", stroke: S.line, strokeWidth: 0.6 }),
      h("circle", { cx: C, cy: C, r: 34, fill: "none", stroke: S.line, strokeWidth: 0.5, strokeDasharray: "1.5 4" }),
      SIGNS.map((sg, i) => { const a = ang(i * 30), m = ang(i * 30 + 15);
        return h("g", { key: i },
          h("line", { x1: C + Math.cos(a) * (R - 24), y1: C + Math.sin(a) * (R - 24), x2: C + Math.cos(a) * R, y2: C + Math.sin(a) * R, stroke: S.line, strokeWidth: 0.6 }),
          h("text", { x: C + Math.cos(m) * (R - 12), y: C + Math.sin(m) * (R - 12) + 3.5, textAnchor: "middle", fontSize: 9.5, fill: S.fog, fontFamily: F_BODY }, sg[0])); }),
      placed.map(p => { const a = ang(p.lon), rr = R - 38 - p.ring * 15;
        return h("g", { key: p.k },
          h("line", { x1: C + Math.cos(a) * (R - 24), y1: C + Math.sin(a) * (R - 24), x2: C + Math.cos(a) * (rr + 8), y2: C + Math.sin(a) * (rr + 8), stroke: p.k === "asc" ? S.accent : S.tint, strokeWidth: 0.6, opacity: 0.6 }),
          h("circle", { cx: C + Math.cos(a) * rr, cy: C + Math.sin(a) * rr, r: 8.5, fill: S.bg2, stroke: p.k === "asc" ? S.accent : S.tint, strokeWidth: 0.8 }),
          h("text", { x: C + Math.cos(a) * rr, y: C + Math.sin(a) * rr + 3.6, textAnchor: "middle", fontSize: 9.5, fill: S.ink, fontFamily: F_BODY }, PL_GLYPH[p.k])); }),
      h("path", { d: sparkle(C, C, 14), fill: S.tint, opacity: 0.8 }));
  }

  // 出生信息：整页（no-half-sheet），时间＋城市；城市不在列表里的自己填经纬度和时区
  function BirthPage({ S, person, value, onBack, onSave }) {
    const [time, setTime] = useState(value.time || "");
    const [q, setQ] = useState("");
    const [city, setCity] = useState(value.city ? { name: value.city, lat: value.lat, lon: value.lon, tz: value.tz, cc: value.cc } : null);
    const [tzEdit, setTzEdit] = useState(value.tz != null ? String(value.tz) : "");
    const [dstAuto, setDstAuto] = useState(value.dst !== false);
    const [found, setFound] = useState(null);
    const [searching, setSearching] = useState(false);
    const [searchErr, setSearchErr] = useState("");
    const pick = c => { setCity(c); setTzEdit(String(c.tz)); };
    const runSearch = async () => {
      const qq = q.trim(); if (!qq || searching) return;
      setSearching(true); setSearchErr("");
      try { const rows = await searchPlace(qq); setFound(rows); if (!rows.length) setSearchErr("没搜到——换个写法，或者从下面的列表里挑"); }
      catch (e) { setFound(null); setSearchErr("连不上地名搜索，先从下面的列表里挑：" + String((e && e.message) || e).slice(0, 60)); }
      finally { setSearching(false); }
    };
    const [own, setOwn] = useState(!!(value.city && !CITIES.some(c => c[0] === value.city)));
    const [lat, setLat] = useState(own && value.lat != null ? String(value.lat) : "");
    const [lon, setLon] = useState(own && value.lon != null ? String(value.lon) : "");
    const [tz, setTz] = useState(own && value.tz != null ? String(value.tz) : "8");
    const hit = CITIES.filter(c => !q.trim() || c[0].indexOf(q.trim()) >= 0);
    const list = hit.length ? hit : CITIES;    // 搜的是县镇、列表里没有时，常用城市别跟着空掉
    const inSt = { width: "100%", outline: "none", padding: "10px 0", fontFamily: F_BODY, fontSize: 15, background: "transparent", color: S.ink, border: "none", borderBottom: "1px solid " + S.line, colorScheme: "dark" };
    const label = tx => h("div", { className: "flex items-center", style: { gap: 7, margin: "18px 0 4px" } }, h(Spark, { size: 9, color: S.tint }), h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, letterSpacing: ".18em" } }, tx));
    const save = () => {
      const out = {};
      if (/^\d{1,2}:\d{2}$/.test(time)) out.time = time;
      if (own) { const a = parseFloat(lat), b = parseFloat(lon), z = parseFloat(tz); if (isFinite(a) && isFinite(b)) Object.assign(out, { city: "自定", lat: a, lon: b, tz: isFinite(z) ? z : 8 }); }
      else if (city) Object.assign(out, { city: city.name, lat: city.lat, lon: city.lon, tz: isFinite(parseFloat(tzEdit)) ? parseFloat(tzEdit) : city.tz, cc: city.cc || "" });
      if (!dstAuto) out.dst = false;
      onSave(Object.keys(out).length ? out : null);
    };
    return h("div", { className: "h-full flex flex-col", style: { background: S.bg, backgroundImage: STARS, backgroundSize: "320px 380px" } },
      h(Head, { zh: "出生信息", sub: person.name, onBack: onBack, ink: S.ink, bg: "transparent", noLine: true,
        right: h("button", { onClick: save, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 14, color: S.tint, background: "transparent", border: "none", minHeight: 40 } }, "存") }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "0 20px 28px" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: S.sub, lineHeight: 1.7, marginTop: 6 } }, "只存在星测里，不改档案。日期还是用档案里那个生日（要带年份）。"),
        label("几点出生"),
        h("input", { type: "time", value: time, onChange: e => setTime(e.target.value), style: inSt }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, marginTop: 4 } }, "不知道就空着：按正午算，没有上升，月亮可能差一点。"),
        label("在哪儿出生"),
        own ? h("div", null,
          h("input", { value: lat, onChange: e => setLat(e.target.value), placeholder: "纬度（北纬为正，比如 39.9）", inputMode: "decimal", style: inSt }),
          h("input", { value: lon, onChange: e => setLon(e.target.value), placeholder: "经度（东经为正，比如 116.4）", inputMode: "decimal", style: inSt }),
          h("input", { value: tz, onChange: e => setTz(e.target.value), placeholder: "时区（东八区写 8）", inputMode: "decimal", style: inSt }))
          : h("div", null,
            h("div", { className: "flex items-center", style: { gap: 10 } },
              h("input", { value: q, onChange: e => setQ(e.target.value), onKeyDown: e => { if (e.key === "Enter") runSearch(); }, placeholder: city ? "已选：" + city.name + "（输入县、镇、村都行）" : "输入出生的地方：县、镇、村都行", style: Object.assign({}, inSt, { flex: 1 }) }),
              h("button", { onClick: runSearch, disabled: searching || !q.trim(), className: "active:opacity-70 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: 13.5, color: S.tint, background: "transparent", border: "none", minHeight: 40, padding: "0 4px" } }, searching ? "搜…" : "搜")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 4 } }, "点「搜」会把这个地名发给 OpenStreetMap 查经纬度，只发地名。不想联网就直接在下面列表里挑。"),
            searchErr ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: S.accent, marginTop: 6 } }, searchErr) : null,
            found && found.length ? h("div", { style: { marginTop: 6 } }, found.map((c, i) => { const on = city && city.lat === c.lat && city.lon === c.lon; return h("button", { key: i, onClick: () => pick(c), className: "active:opacity-70",
              style: { display: "flex", alignItems: "flex-start", gap: 8, width: "100%", textAlign: "left", padding: "8px 0", background: "transparent", border: "none", borderBottom: "1px solid " + S.line } },
              h("span", { style: { marginTop: 3 } }, h(Spark, { size: 8, color: on ? S.tint : S.line })),
              h("span", { style: { flex: 1, minWidth: 0 } },
                h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 13.5, color: on ? S.ink : S.sub, fontWeight: on ? 600 : 400 } }, c.name),
                h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10.5, color: S.fog, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.full))); })) : null,
            city ? h("div", { className: "flex items-center", style: { gap: 8, marginTop: 10, fontFamily: F_BODY, fontSize: 12, color: S.sub } },
              h("span", null, city.name + " · " + (city.lat < 0 ? "南纬 " : "北纬 ") + Math.abs(+city.lat).toFixed(2) + " · " + (city.lon < 0 ? "西经 " : "东经 ") + Math.abs(+city.lon).toFixed(2) + " · 时区"),
              h("input", { value: tzEdit, onChange: e => setTzEdit(e.target.value), inputMode: "decimal", style: { width: 46, outline: "none", background: "transparent", color: S.ink, border: "none", borderBottom: "1px solid " + (city.guessed ? S.accent : S.line), fontFamily: F_BODY, fontSize: 13, textAlign: "center" } }),
              null) : null,
            city && city.guessed ? h("div", { style: { fontFamily: F_BODY, color: S.accent, fontSize: 11, marginTop: 4 } }, "这个国家有好几个时区，是按经度猜的，对一下（标准时间，不含夏令时）") : null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, margin: "14px 0 2px" } }, "常用城市（不联网）"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: "2px 14px", marginTop: 4 } },
              list.map(c => { const on = city && city.name === c[0]; return h("button", { key: c[0], onClick: () => pick({ name: c[0], lat: c[1], lon: c[2], tz: c[3], cc: cityCC(c) }), className: "active:opacity-70",
                style: { display: "flex", alignItems: "center", gap: 4, minHeight: 34, background: "transparent", border: "none", fontFamily: F_BODY, fontSize: 13.5, color: on ? S.ink : S.sub, fontWeight: on ? 600 : 400 } },
                on ? h(Spark, { size: 8, color: S.tint }) : null, c[0]); }))),
        h("button", { onClick: () => setOwn(!own), className: "active:opacity-70", style: { marginTop: 12, fontFamily: F_BODY, fontSize: 12, color: S.tint, background: "transparent", border: "none", borderBottom: "1px dotted " + S.tint, padding: "6px 0 1px" } },
          own ? "从城市列表里选" : "列表里没有 · 自己填经纬度"),
        h("div", { className: "flex items-center justify-between", style: { marginTop: 16, gap: 12 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: S.sub, lineHeight: 1.6 } }, "自动算中国夏令时", h("div", { style: { fontSize: 10.5, color: S.fog } }, "大陆 1986~1991 年夏天出生的，按钟表上的时间填就行，这边自动换算。国外的夏令时没算。")),
          h("button", { onClick: () => setDstAuto(!dstAuto), "aria-pressed": dstAuto, className: "active:opacity-70 shrink-0", style: { fontFamily: F_BODY, fontSize: 12, color: dstAuto ? S.tint : S.fog, background: "transparent", border: "none", borderBottom: "1px dotted " + (dstAuto ? S.tint : S.line), minHeight: 36 } }, dstAuto ? "开着" : "关了")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, marginTop: 10, lineHeight: 1.7 } }, "古代、架空的角色挑一个最接近的地方就行。"),
        value && (value.time || value.city) ? h("button", { onClick: () => onSave(null), className: "active:opacity-70", style: { marginTop: 22, fontFamily: F_BODY, fontSize: 12.5, color: S.fog, background: "transparent", border: "none" } }, "清掉这份出生信息") : null));
  }

  function AstroApp(props) {
    const S = sky();
    const t = useTheme();
    const chars = (props.characters || []).filter(c => c && !c.isGroup);
    const profile = props.profile || {};
    const meName = profile.name || "我";
    const [tab, setTab] = useState("today");
    const [notes, setNotes] = useState(loadNotes);
    const [busy, setBusy] = useState("");
    const today = dayKeyOf();
    // 「人」：我 + 角色们，统一成 { id, name, birthday, char }
    const people = useMemo(() => [{ id: "me", name: meName, birthday: profile.birthday, char: null }]
      .concat(chars.map(c => ({ id: c.id, name: c.remark || c.name, birthday: c.birthday, char: c }))), [chars.length, profile.birthday, meName]);
    const byId = id => people.find(p => p.id === id) || people[0];
    const [pa, setPa] = useState("me");
    const [pb, setPb] = useState(chars[0] ? chars[0].id : "me");
    const [commenter, setCommenter] = useState(chars[0] ? chars[0].id : "");
    // 出生时间、城市：只存在星测自己这儿（x_astro_birth），不改档案（她 2026-10-03：「不能就在星测里面设置城市啥的吗」）
    const [birth, setBirth] = useState(loadBirth);
    const [editing, setEditing] = useState("");
    const [chartWho, setChartWho] = useState(chars[0] ? chars[0].id : "me");   // 星盘页看谁
    const groups = (props.groups || []).filter(gp => gp && (gp.memberIds || []).length >= 2);
    const [gid, setGid] = useState(groups[0] ? groups[0].id : "");
    const [askText, setAskText] = useState("");
    const [asks, setAsks] = useState(loadAsks);
    const [signs, setSigns] = useState(() => loadJSON(SIGN_KEY, {}) || {});
    const [moonTick, setMoonTick] = useState(0);
    // 今日签：手动抽一张（跟自动那一路同一份提示词）
    const drawSign = async c => {
      const key = "sign|" + today + "|" + c.id;
      if (busy) return;
      const p = props.apiFor ? props.apiFor(c.id) : null, ctx = props.ctxFor ? props.ctxFor(c) : null;
      if (!p || !ctx || typeof runProbe !== "function") { props.toast && props.toast("先到设置配置 API"); return; }
      const facts = todayFacts(profile, birth, today); if (!facts) { props.toast && props.toast("先填上你的生日"); return; }
      setBusy(key);
      try {
        const prev = signs[key];
        const d = await runProbe(p, ctx, { voice: true, tag: "astro", instruction: signInstruction(meName, facts) + (prev ? "\n〔重抽〕上一张写的是「" + prev.title + "：" + prev.text + "」，这张换一个。" : "") + voiceTail(), schemaHint: SIGN_SCHEMA, maxTokens: 65000 });
        if (!d || !String(d.title || d.text || "").trim()) throw new Error("TA 这回没抽出来，再点一次");
        const next = Object.assign({}, signs, { [key]: { title: String(d.title || "").trim().slice(0, 12), text: String(d.text || "").trim().slice(0, 120), by: c.remark || c.name, ts: Date.now() } });
        const ks = Object.keys(next).sort((a, b) => (next[b].ts || 0) - (next[a].ts || 0)); ks.slice(60).forEach(k => delete next[k]);
        setSigns(next); saveJSON(SIGN_KEY, next);
      } catch (e) { props.toast && props.toast("没抽成：" + String((e && e.message) || e).slice(0, 120)); }
      finally { setBusy(""); }
    };
    const chartOf = p => p ? natalChart(p.birthday, birth[p.id]) : null;
    const birthLink = p => {
      const b = birth[p.id];
      const label = b && (b.time || b.city) ? [b.time, b.city].filter(Boolean).join(" · ") : "填出生时间和城市";
      return h("button", { onClick: () => setEditing(p.id), className: "active:opacity-70",
        style: { fontFamily: F_BODY, fontSize: 11, color: b ? S.sub : S.tint, background: "transparent", border: "none", borderBottom: "1px dotted " + (b ? S.line : S.tint), padding: "6px 0 1px", minHeight: 30 } }, label);
    };

    const missing = (p) => h("button", { onClick: () => p.char ? props.onEditChar && props.onEditChar(p.char) : props.onEditProfile && props.onEditProfile(),
      className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12, color: S.tint, background: "transparent", border: "none", borderBottom: "1px dashed " + S.tint, padding: "6px 0 2px", marginTop: 4, minHeight: 32 } },
      (p.id === "me" ? "还不知道你的生日" : "还不知道 " + p.name + " 的生日") + " · 去填");

    const ask = async (key, char, instruction) => {
      if (!char || busy) return;
      const p = props.apiFor ? props.apiFor(char.id) : null;
      const ctx = props.ctxFor ? props.ctxFor(char) : null;
      if (!p || !ctx || typeof runProbe !== "function") { props.toast && props.toast("先到设置配置 API"); return; }
      setBusy(key);
      try {
        // 「再看看」＝重 Roll：把上一回的话给 TA，别换个说法再说一遍（她 2026-10-03 问配对能不能重 roll）
        const prev = notes[key] && notes[key].text;
        const reroll = prev ? "\n〔重看〕你上一回看完说的是：『" + String(prev).slice(0, 300) + "』。这回重新看一遍，别把同一番话换个说法再说，换个你在意的点，或者干脆改主意。" : "";
        const d = await runProbe(p, ctx, { voice: true, instruction: instruction + reroll + voiceTail(), schemaHint: "{\"text\":\"你想对她说的话\"}", maxTokens: 65000, tag: "astro" });
        const txt = String((d && d.text) || "").trim();
        if (!txt) throw new Error("TA 这回没说出话来，再点一次");
        setNotes(saveNote(key, txt));
      } catch (e) { props.toast && props.toast("没看成：" + String((e && e.message) || e).slice(0, 120)); }
      finally { setBusy(""); }
    };

    const noteBox = (key, char) => {
      const n = notes[key];
      return n ? h("div", { "data-wk": "astronote", style: { marginTop: 12, paddingTop: 12, borderTop: "1px dashed " + S.line } },
        h("div", { className: "flex items-center gap-2", style: { marginBottom: 6 } },
          char && typeof Avatar !== "undefined" ? h(Avatar, { character: char, size: 22, radius: 7 }) : null,
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: S.sub } }, (char ? (char.remark || char.name) : "TA") + " 看了看")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: S.ink, lineHeight: 1.7, whiteSpace: "pre-wrap", userSelect: "text", WebkitUserSelect: "text" } }, n.text)) : null;
    };
    const askBtn = (key, char, instruction, label) => char ? h("button", { onClick: () => ask(key, char, instruction), disabled: !!busy, className: "active:opacity-80 disabled:opacity-50",
      style: { marginTop: 10, width: "100%", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", border: "none",
        borderTop: "1px solid " + S.line, color: S.tint, fontFamily: F_BODY, fontSize: 13.5, letterSpacing: ".06em" } },
      h(Spark, { size: 9, color: S.tint }),
      busy === key ? (char.remark || char.name) + " 在看…" : (notes[key] ? "让 " + (char.remark || char.name) + " 再看看" : (label || "让 " + (char.remark || char.name) + " 看看")),
      h(Spark, { size: 9, color: S.tint })) : null;

    const pickRow = (list, val, set, label) => h("div", { style: { marginBottom: 10 } },
      label ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, marginBottom: 6 } }, label) : null,
      h("div", { style: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 } },
        // 一个人就是一颗星：头像外一圈光，选中的那颗亮、名字上墨；没选的暗着（tabs-not-plain-pills：不是一排药丸）
        list.map(p => { const on = val === p.id; return h("button", { key: p.id, onClick: () => set(p.id), "aria-pressed": on, className: "active:opacity-70 shrink-0",
          style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 56, padding: "4px 2px", background: "transparent", border: "none", color: on ? S.ink : S.fog, fontFamily: F_BODY, fontSize: 11.5 } },
          h("span", { style: { display: "inline-flex", borderRadius: 999, padding: 2, boxShadow: on ? "0 0 0 1.5px " + S.tint + ", 0 0 16px " + S.tint + "88" : "none", opacity: on ? 1 : 0.62, transition: "all .2s" } },
            typeof Avatar !== "undefined" ? h(Avatar, { character: p.char || { name: p.name, avatarImage: profile.avatarImage, color: profile.color || "#8a8fb5" }, size: 38, radius: 999 }) : null),
          h("span", { style: { maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name)); })));

    // ---- 今日 ----
    const meInfo = birthInfo(profile.birthday);
    const day0 = meInfo && meInfo.sign >= 0 ? daily(meInfo.sign, today) : null;
    // 有星盘就按行运算几颗星和那一句；幸运色、幸运数字照旧按日子（那两样本来就没有天文上的说法）
    const meChart = chartOf(people[0]);
    const tr = day0 && meChart ? transits(meChart, new Date()) : null;
    const day = !day0 ? null : !tr ? day0 : Object.assign({}, day0, { all: tr.all, love: tr.love, work: tr.work, money: tr.money,
      line: tr.hits.length ? transitLine(tr.hits[0]) + "。" : "今天天上没有哪颗星贴近你的星盘，平平稳稳的一天。" });
    const chartRows = (chart) => h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "4px 14px", fontFamily: F_BODY, fontSize: 12.5 } },
      PLANETS.map(x => x[0]).concat(chart.lon.asc != null ? ["asc"] : []).map(k => {
        const sd = signDeg(chart.lon[k]);
        return h("div", { key: k, className: "flex justify-between", style: { padding: "5px 0", borderBottom: "1px solid " + S.line } },
          h("span", { style: { color: S.sub } }, PL_ZH[k]),
          h("span", { style: { color: S.ink } }, SIGNS[sd.sign][0] + " " + sd.deg + "°" + (k === "moon" && chart.moonUnsure ? "？" : "")));
      }));
    const chartNote = chart => chart.dst ? "那天大陆在实行夏令时，已自动按东九区换算。" : !chart.hasPlace ? "没填出生城市，按东八区算；没有上升。" : !chart.hasTime ? "没填出生时间，按当天正午算：没有上升，月亮可能差一点。" : "";
    const todayView = h("div", { className: "flex flex-col" },
      h(ZodiacWheel, { S: S, sign: meInfo ? meInfo.sign : -1 }),
      h(Panel, { S: S, title: "今日" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog } }, today.replace(/-/g, " · ") + " · " + meName),
        skyNote(new Date()) ? h("div", { "data-wk": "astrosky", style: { fontFamily: F_BODY, fontSize: 12, color: S.tint, marginTop: 4 } }, "今天的天象：" + skyNote(new Date())) : null,
        !day ? h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: S.ink, marginTop: 4 } }, "还算不出你今天的运势"), missing(people[0])) : h("div", null,
          h("div", { className: "flex items-baseline justify-between", style: { marginTop: 4 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: S.ink } }, signName(meInfo.sign) + (meInfo.signApprox ? "（约）" : "")),
            h(Stars, { n: day.all, color: S.tint })),
          h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: S.ink, lineHeight: 1.7, marginTop: 8 } }, day.line),
          tr && tr.hits.length > 1 ? h("div", { style: { marginTop: 8 } }, tr.hits.slice(1, 4).map((x, i) => h("div", { key: i, className: "flex items-center", style: { gap: 7, fontFamily: F_BODY, fontSize: 12, color: S.sub, lineHeight: 1.8 } },
            h(Spark, { size: 7, color: x.asp.tone < 0 ? S.accent : S.tint, op: 0.7 }), transitLine(x)))) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 6 } }, tr ? "按今天天上的行星和你的星盘算" : "只按星座和日期算 · 填上带年份的生日和出生信息会按行运算"),
          h("div", { style: { display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", marginTop: 12, fontFamily: F_BODY, fontSize: 12.5, color: S.sub, alignItems: "center" } },
            "爱情", h(Stars, { n: day.love, color: S.accent }), "事业", h(Stars, { n: day.work, color: S.accent }), "财运", h(Stars, { n: day.money, color: S.accent })),
          h("div", { className: "flex gap-3", style: { marginTop: 14 } },
            h("div", { "data-wk": "astrolucky", style: { flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "6px 0" } },
              h("span", { style: { width: 28, height: 28, borderRadius: 99, background: day.color.hex, boxShadow: "0 0 0 3px " + S.bg + "," + "0 0 12px " + day.color.hex } }),
              h("div", null, h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog } }, "幸运色"), h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: S.ink } }, day.color.name))),
            h("div", { style: { width: 92, padding: "6px 0 6px 14px", borderLeft: "1px solid " + S.line } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog } }, "幸运数字"), h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: S.ink } }, day.number))))),
      h(Panel, { S: S, title: "你的星盘" },
        meChart ? h("div", null, chartRows(meChart), chartNote(meChart) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 6 } }, chartNote(meChart)) : null)
          : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: S.sub, lineHeight: 1.7 } }, birthDateOf(profile.birthday) ? "" : "生日要带上年份（比如 1999-05-08）才排得出星盘。"),
        h("div", null, birthLink(people[0]))),
      day && chars.length ? h(Panel, { S: S, title: "让谁看看" },
        pickRow(people.filter(p => p.char), commenter, setCommenter, ""),
        (() => {
          const c = (byId(commenter) || {}).char;
          if (!c) return null;
          const ci = birthInfo(c.birthday);
          const key = "day|" + today + "|" + c.id;
          const ins = meName + "把她今天的星座运势拿给你看（这是按星座和日期算出来的，不是你编的）：\n"
            + "她是" + signName(meInfo.sign) + "；综合 " + day.all + " 星，爱情 " + day.love + "、事业 " + day.work + "、财运 " + day.money + " 星；幸运色" + day.color.name + "，幸运数字 " + day.number + "；那一句是「" + day.line + "」。\n"
            + (tr && tr.hits.length ? "今天的行运：" + tr.hits.slice(0, 4).map(transitLine).join("；") + "。\n" : "")
            // 配对那一句不放这儿（她 2026-10-03：「今日说说怎么还能看见配对的信息」）——配对有自己那一页，今日就只说今日
            + (ci && ci.sign >= 0 ? "你是" + signName(ci.sign) + "。" : "") + "\n"
            + "看完说说你的想法。信不信星座、当不当真、顺着哪一点说，全由你这个人决定。";
          return h("div", null, noteBox(key, c), askBtn(key, c, ins));
        })()) : null,
      // 今日签：挑个人替你抽，抽完能转发回你们的聊天
      day && chars.length ? h(Panel, { S: S, title: "今日签" }, (() => {
        const c = (byId(commenter) || {}).char; if (!c) return pickRow(people.filter(p => p.char), commenter, setCommenter, "让谁替你抽");
        const key = "sign|" + today + "|" + c.id, got = signs[key];
        return h("div", null, pickRow(people.filter(p => p.char), commenter, setCommenter, "让谁替你抽"),
          got ? h("div", { style: { display: "flex", justifyContent: "center", margin: "6px 0 4px" } }, h(AstroSignCard, { m: { astro: got } })) : null,
          h("div", { className: "flex", style: { gap: 8, marginTop: 8 } },
            h("button", { onClick: () => drawSign(c), disabled: !!busy, className: "active:opacity-80 disabled:opacity-50", style: { flex: 1, minHeight: 44, background: "transparent", border: "1px solid " + S.tint, borderRadius: 3, color: S.tint, fontFamily: F_BODY, fontSize: 13.5 } },
              busy === key ? (c.remark || c.name) + " 在抽…" : got ? "再抽一张" : "让 " + (c.remark || c.name) + " 抽一张"),
            got && props.onShareSign ? h("button", { onClick: () => props.onShareSign(c, got), className: "active:opacity-80", style: { flex: 1, minHeight: 44, background: S.tint, border: "none", borderRadius: 3, color: S.bg, fontFamily: F_BODY, fontSize: 13.5 } }, "转发回聊天") : null));
      })()) : null,
      // 月亮日记
      h(Panel, { S: S, title: "月亮日记" }, (() => {
        const ms = moonSignOn(today), H = g.Health, hd = H && H.load ? H.load() : null, mine = hd && hd.mood ? hd.mood[today] : null, MZ = (H && H.MOOD_ZH) || ["很糟", "低落", "一般", "不错", "很好"];
        const setMood = (v, note) => { if (!H) return; const d0 = H.load(); d0.mood = Object.assign({}, d0.mood, { [today]: Object.assign({}, (d0.mood || {})[today] || {}, v != null ? { v } : {}, note != null ? { note: String(note).slice(0, 60) } : {}) }); H.save(d0); setMoonTick(x => x + 1); try { g.dispatchEvent(new CustomEvent("qq-health-updated")); } catch (e) {} };
        const days = []; for (let i = 13; i >= 0; i--) { const dk = dayKeyOf(new Date(Date.now() - i * 864e5)); days.push({ dk, ms: moonSignOn(dk), mood: hd && hd.mood && hd.mood[dk] }); }
        return h("div", { "data-wk": "astromoon" },
          h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: S.ink, lineHeight: 1.7 } }, "今天月亮在" + SIGNS[ms][0] + "座 · 「" + MOON_WORD[ms] + "」"),
          h("div", { className: "flex", style: { gap: 6, marginTop: 10 } }, MZ.map((z, v) => { const on = mine && mine.v === v;
            return h("button", { key: v, onClick: () => setMood(v), "aria-pressed": on, className: "active:opacity-70", style: { flex: 1, minHeight: 40, background: on ? S.tint : "transparent", color: on ? S.bg : S.sub, border: "1px solid " + (on ? S.tint : S.line), borderRadius: 3, fontFamily: F_BODY, fontSize: 12 } }, z); })),
          h("input", { defaultValue: (mine && mine.note) || "", key: today + "|" + moonTick, placeholder: "今天心里是什么样子（跟健康 app 的心情是同一格）", onBlur: e => setMood(null, e.target.value), "aria-label": "今天的心情",
            style: { width: "100%", minWidth: 0, minHeight: 40, marginTop: 8, padding: "8px 10px", background: "transparent", border: "1px solid " + S.line, borderRadius: 3, color: S.ink, fontFamily: F_BODY, fontSize: 13 } }),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginTop: 12 } }, days.map(x => h("div", { key: x.dk, title: x.dk, style: { textAlign: "center", padding: "6px 0", borderRadius: 3, background: x.dk === today ? S.bg2 : "transparent" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: S.fog } }, x.dk.slice(8)),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.sub, marginTop: 2 } }, SIGNS[x.ms][0]),
            h("div", { style: { width: 7, height: 7, borderRadius: 99, margin: "4px auto 0", background: x.mood && x.mood.v != null ? [S.accent, S.accent, S.fog, S.tint, S.tint][x.mood.v] : "transparent", border: x.mood && x.mood.v != null ? "none" : "1px solid " + S.line, opacity: x.mood && x.mood.v != null ? 0.4 + x.mood.v * 0.15 : 1 } })))),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 6 } }, "两周里月亮走过的星座和你的心情，翻回来看看对不对得上"));
      })()));

    // ---- 配对 ----
    const A = byId(pa), B = byId(pb);
    const ai = birthInfo(A.birthday), bi = birthInfo(B.birthday);
    const sm = ai && bi ? signMatch(ai.sign, bi.sign) : null;
    const sr = ai && bi ? shukuRelation(ai.shuku, bi.shuku) : null;
    const syn = synastry(chartOf(A), chartOf(B));
    const pairChar = A.char || B.char;          // 谁来点评：左边是角色就左边，否则右边那位
    const pairOther = pairChar === A.char ? B : A;
    const pairKey = "pair|" + [A.id, B.id].join("~") + "|" + (pairChar ? pairChar.id : "");
    const whoLine = (p, info) => h("div", { style: { flex: 1, textAlign: "center" } },
      typeof Avatar !== "undefined" ? h("div", { style: { display: "flex", justifyContent: "center" } }, h(Avatar, { character: p.char || { name: p.name, avatarImage: profile.avatarImage, color: profile.color || "#8a8fb5" }, size: 44, radius: 999 })) : null,
      h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: S.ink, marginTop: 6 } }, p.name),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: S.sub, marginTop: 2 } },
        info && info.sign >= 0 ? signName(info.sign) + (info.signApprox ? "（约）" : "") : "星座未知",
        " · ", info && info.shuku >= 0 ? SHUKU[info.shuku] + "宿" : "宿未知"),
      info ? h("div", null, birthLink(p)) : null,
      !info ? missing(p) : (info.shukuNeedsYear ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 4 } }, "生日带上年份才算得出宿") : null));
    const pairView = h("div", { className: "flex flex-col" },
      h(Panel, { S: S, title: "挑两个人" },
        pickRow(people, pa, setPa, "左边"),
        pickRow(people, pb, setPb, "右边"),
        pa === pb ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: S.fog } }, "两边选了同一个人——换一个再看") : null),
      pa === pb ? null : h(Panel, { S: S, title: "两颗星之间" },
        h("div", { className: "flex items-start" }, whoLine(A, ai),
          h("div", { style: { alignSelf: "center", textAlign: "center", padding: "0 4px" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 26, color: S.tint } }, syn ? syn.score : sm ? sm.score : "?"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: S.fog } }, syn ? "合盘" : "星座")),
          whoLine(B, bi)),
        // 合盘：两张星盘之间合得最紧的那几组（她要的「更严谨」那一层）
        h("div", { "data-wk": "astrosyn", style: { marginTop: 14, paddingTop: 12, borderTop: "1px dashed " + S.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog } }, "合盘（两张星盘之间的相位）"),
          syn ? h("div", { style: { marginTop: 4 } },
            syn.list.length ? syn.list.slice(0, 6).map((x, i) => h("div", { key: i, className: "flex items-center", style: { gap: 8, fontFamily: F_BODY, fontSize: 13, color: S.ink, lineHeight: 1.9 } },
              h(Spark, { size: 8, color: x.tone < 0 ? S.accent : S.tint, op: 0.85 }),
              h("span", null, synLine(x, A.name, B.name)),
              h("span", { style: { color: S.fog, fontSize: 11 } }, x.tone > 0 ? "顺" : x.tone < 0 ? "磨" : ""))) : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub } }, "两张盘之间没什么贴得近的相位——不怎么互相牵动。"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 6 } }, "金色是顺的，粉色是磨的；" + ([chartOf(A), chartOf(B)].some(c => !c.hasTime) ? "有人没填出生时间，月亮和上升没全算进去。" : "两个人的出生时间都在。")))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, marginTop: 4, lineHeight: 1.7 } }, "两个人都要有带年份的生日才合得了盘；再填上出生时间和城市会更准。")),
        h("div", { "data-wk": "astrosign", style: { marginTop: 12, paddingTop: 12, borderTop: "1px dashed " + S.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog } }, "星座配对"),
          sm ? h("div", null,
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: S.ink, marginTop: 2 } }, sm.aspect + " · " + sm.score),
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, lineHeight: 1.7, marginTop: 4 } }, sm.note))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, marginTop: 4 } }, "两个人的星座都知道了才能配")),
        h("div", { "data-wk": "astroshuku", style: { marginTop: 12, paddingTop: 12, borderTop: "1px dashed " + S.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog } }, "星宿关系（宿曜）"),
          sr ? h("div", null,
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: S.ink, marginTop: 2 } }, (sr.pair === "命" ? "命命" : sr.pair) + (sr.distance ? " · " + sr.distance : "")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: S.sub, marginTop: 2 } }, sr.pair === "命" ? "同一个宿" : A.name + " 是 " + B.name + " 的「" + sr.theirs + "」，" + B.name + " 是 " + A.name + " 的「" + sr.mine + "」"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, lineHeight: 1.7, marginTop: 4 } }, sr.note))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, marginTop: 4 } }, "两个人的本命宿都算得出来才能看")),
        // 你俩的好日子（第 6 条）：接下来一个月里，行运对两个人都顺的那三天。日历上也会标出来，TA 也知道
        h("div", { "data-wk": "astrogood", style: { marginTop: 12, paddingTop: 12, borderTop: "1px dashed " + S.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog } }, "星星点头的日子（接下来一个月）"),
          (() => { const gd = goodDays(chartOf(A), chartOf(B), new Date(), 30);
            if (!chartOf(A) || !chartOf(B)) return h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, marginTop: 4 } }, "两个人都排得出星盘才算得出来（生日要带年份）");
            if (!gd.length) return h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, marginTop: 4 } }, "这一个月天上没给你俩特别的好日子——那就哪天都行");
            return h("div", { className: "flex", style: { gap: 8, marginTop: 6 } }, gd.map(x => h("div", { key: x.day, style: { flex: 1, textAlign: "center", padding: "8px 0", border: "1px solid " + S.line, borderRadius: 3 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: S.tint } }, x.day.slice(5).replace("-", ".")),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: S.fog, marginTop: 2 } }, "周" + "日一二三四五六"[noonOf(x.day).getDay()])))); })(),
          (A.id === "me" || B.id === "me") && pairChar ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 6 } }, "这几天也会标在 " + (pairChar.remark || pairChar.name) + " 的日历上，TA 也知道。") : null),
        pairChar && (sm || sr || syn) ? (() => {
          const ins = "这是按生日算出来的「你」和「" + pairOther.name + "」的配对（不是你编的）：\n"
            + (sm ? "星座：你是" + signName((pairChar === A.char ? ai : bi).sign) + "，" + pairOther.name + "是" + signName((pairChar === A.char ? bi : ai).sign) + "，「" + sm.aspect + "」，配对指数 " + sm.score + "。\n" : "")
            + (sr ? "宿曜：" + (sr.pair === "命" ? "你俩同一个宿（命命）" : "你俩是「" + sr.pair + "」" + (sr.distance ? "（" + sr.distance + "）" : "")) + "。\n" : "")
            + (syn && syn.list.length ? "合盘（" + syn.score + "）里最紧的几组：" + syn.list.slice(0, 5).map(x => synLine(x, pairChar === A.char ? "你" : A.name, pairChar === B.char ? "你" : B.name)).join("；") + "。\n" : "")
            + (pairOther.id === "me" ? meName + "把这个拿给你看。" : meName + "把你和" + pairOther.name + "的这份配对拿给你看。") + "\n"
            + "说说你怎么看。当真不当真、顺着哪一点说、要不要反驳，全由你这个人和你们的关系决定。";
          return h("div", null, noteBox(pairKey, pairChar), askBtn(pairKey, pairChar, ins));
        })() : null));

    // ---- 星盘（第 1、5 条）：一张真的盘 + 这一年（太阳回归）+ 让 TA 看看 ----
    const CP = byId(chartWho), cChart = chartOf(CP);
    const yr = (() => { if (!cChart) return null; const now = new Date(); const sr0 = solarReturn(cChart, now.getFullYear());
      return sr0 && sr0.when > new Date(now.getTime() + 15 * 864e5) ? solarReturn(cChart, now.getFullYear() - 1) : sr0; })();
    const nearBday = yr && Math.abs(new Date() - yr.when) < 7 * 864e5;
    const chartReader = CP.char || (byId(commenter) || {}).char;
    const chartFacts = cChart ? KEYS_FOR(cChart).map(k => { const sd = signDeg(cChart.lon[k]); return PL_ZH[k] + "在" + SIGNS[sd.sign][0] + "座"; }).join("、") : "";
    const chartView = h("div", { className: "flex flex-col" },
      h(Panel, { S: S, title: "看谁的盘" }, pickRow(people, chartWho, setChartWho, "")),
      h(Panel, { S: S, title: CP.name + " 的星盘" },
        cChart ? h("div", null, h(ChartWheel, { S: S, chart: cChart }), h("div", { style: { marginTop: 8 } }, chartRows(cChart)),
          h("div", { style: { marginTop: 8 } }, KEYS_FOR(cChart).slice(0, 7).map(k => h("div", { key: k, style: { fontFamily: F_BODY, fontSize: 12, color: S.sub, lineHeight: 1.8 } },
            h("span", { style: { color: S.tint } }, PL_ZH[k]), " 管" + PL_THEME[k]))),
          chartNote(cChart) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 6 } }, chartNote(cChart)) : null)
          : h("div", null, h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, lineHeight: 1.7 } }, "生日要带上年份才排得出星盘。"), birthDateOf(CP.birthday) ? null : missing(CP)),
        h("div", null, birthLink(CP)),
        cChart && !CP.char && chars.length ? h("div", { style: { marginTop: 10 } }, pickRow(people.filter(p => p.char), commenter, setCommenter, "让谁看你的盘")) : null,
        cChart && chartReader ? (() => {
          const key = "natal|" + CP.id + "|" + chartReader.id;
          const ins = (CP.char ? "这是按你的生日算出来的你自己的星盘（不是你编的）：" : meName + "把她自己的星盘拿给你看（按她的生日算的）：") + chartFacts + "。\n"
            + (CP.char ? "看看你自己的盘，说说你的想法：对得上就对得上，对不上、不信、觉得好笑，都照你自己来。" : "说说你怎么看她的盘。信不信、顺着哪一点说，全由你这个人决定。");
          return h("div", null, noteBox(key, chartReader), askBtn(key, chartReader, ins, CP.char ? "让 " + (CP.char.remark || CP.char.name) + " 看看自己的盘" : null));
        })() : null),
      yr ? h(Panel, { S: S, title: (nearBday ? "生日这周 · " : "") + CP.name + " 的这一年" },
        h("div", { "data-wk": "astroyear", style: { fontFamily: F_BODY, fontSize: 11, color: S.fog } }, "从 " + yr.day.replace(/-/g, ".") + " 太阳回到出生那一刻的位置算起（太阳回归）"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: S.ink, lineHeight: 1.8, marginTop: 6 } }, "这一年的月亮落在" + SIGNS[yr.moonSign][0] + "座——心里那块地方，这一年是" + SIGNS[yr.moonSign][0] + "座的样子。"),
        yr.list.slice(0, 4).map((x, i) => h("div", { key: i, className: "flex items-center", style: { gap: 7, fontFamily: F_BODY, fontSize: 12.5, color: S.sub, lineHeight: 1.9 } },
          h(Spark, { size: 7, color: x.tone < 0 ? S.accent : S.tint, op: 0.8 }), yearLine(x))),
        chartReader ? (() => {
          const key = "year|" + CP.id + "|" + yr.day + "|" + chartReader.id;
          const ins = (CP.char ? "这是按你的生日算的你这一年的运（太阳回归，从 " + yr.day + " 起）：" : meName + "把她这一年的运拿给你看（太阳回归，从 " + yr.day + " 起）：")
            + "这一年的月亮在" + SIGNS[yr.moonSign][0] + "座；" + yr.list.slice(0, 4).map(yearLine).join("；") + "。\n" + (nearBday ? "这几天正好是" + (CP.char ? "你" : "她") + "的生日前后。" : "") + "说说你的想法，怎么说全由你自己。";
          return h("div", null, noteBox(key, chartReader), askBtn(key, chartReader, ins));
        })() : null) : null);

    // ---- 群榜（第 2 条）：一个群里两两配对，最合的、最冲的。全靠算 ----
    const G = groups.find(x => x.id === gid) || null;
    const gPeople = G ? [people[0]].concat((G.memberIds || []).map(id => people.find(p => p.id === id)).filter(Boolean)) : [];
    const gPairs = [];
    for (let i = 0; i < gPeople.length; i++) for (let j = i + 1; j < gPeople.length; j++) {
      const a = gPeople[i], b = gPeople[j], ia = birthInfo(a.birthday), ib = birthInfo(b.birthday);
      const syn2 = synastry(chartOf(a), chartOf(b)), sm2 = ia && ib ? signMatch(ia.sign, ib.sign) : null;
      const sc = syn2 ? syn2.score : sm2 ? sm2.score : null;
      if (sc != null) gPairs.push({ a, b, score: sc, by: syn2 ? "合盘" : "星座", why: syn2 && syn2.list[0] ? synLine(syn2.list[0], a.name, b.name) : sm2 ? sm2.aspect : "" });
    }
    gPairs.sort((x, y) => y.score - x.score);
    const unknown = gPeople.filter(p => !birthInfo(p.birthday));
    const rankRow = (x, i, tone) => h("div", { key: x.a.id + x.b.id, "data-wk": "astrorank", className: "flex items-center", style: { gap: 10, padding: "9px 0", borderBottom: "1px solid " + S.line } },
      h("div", { style: { width: 22, fontFamily: F_DISPLAY, fontSize: 15, color: tone } }, i + 1),
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: S.ink } }, x.a.name + " × " + x.b.name),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.by + (x.why ? " · " + x.why : ""))),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: tone } }, x.score));
    const groupView = h("div", { className: "flex flex-col" },
      !groups.length ? h(Panel, { S: S, title: "群榜" }, h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub } }, "还没有群——建个群再来排。"))
        : h(Panel, { S: S, title: "哪个群" }, h("div", { style: { display: "flex", gap: 8, overflowX: "auto" } }, groups.map(gp => { const on = gp.id === gid;
          return h("button", { key: gp.id, onClick: () => setGid(gp.id), "aria-pressed": on, className: "active:opacity-70 shrink-0",
            style: { minHeight: 40, padding: "0 12px", background: "transparent", border: "none", borderBottom: "2px solid " + (on ? S.tint : "transparent"), color: on ? S.ink : S.fog, fontFamily: F_BODY, fontSize: 13 } }, gp.name || "群"); }))),
      G ? h(Panel, { S: S, title: "最合的" }, gPairs.length ? gPairs.slice(0, 3).map((x, i) => rankRow(x, i, S.tint)) : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub } }, "生日都不知道，排不了")) : null,
      G && gPairs.length > 3 ? h(Panel, { S: S, title: "最冲的" }, gPairs.slice(-Math.min(2, gPairs.length - 3)).reverse().map((x, i) => rankRow(x, i, S.accent)),
        // 星座吵架（第 7 条）：她在群里起个头，最冲的那一对照着星盘吵——群里照常接话，会调一次群聊
        (() => { const low = gPairs[gPairs.length - 1]; if (!props.onShareToGroup || low.a.id === "me" || low.b.id === "me") return null;
          return h("button", { onClick: () => props.onShareToGroup(G.id, "〔星测〕群榜上最冲的是 " + low.a.name + " 和 " + low.b.name + "（" + low.score + " 分" + (low.why ? "：" + low.why : "") + "）——你俩照着星盘吵一架给我看看？"),
            className: "active:opacity-80", style: { width: "100%", minHeight: 44, marginTop: 10, background: "transparent", border: "1px dashed " + S.accent, borderRadius: 3, color: S.accent, fontFamily: F_BODY, fontSize: 13.5 } },
            "让 " + low.a.name + " 和 " + low.b.name + " 在群里吵一架"); })()) : null,
      G && unknown.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, padding: "0 4px 8px" } }, "不知道生日、没排进来的：" + unknown.map(p => p.name).join("、")) : null,
      G && gPairs.length && props.onShareToGroup ? h("button", { onClick: () => {
          const top = gPairs[0], low = gPairs.length > 1 ? gPairs[gPairs.length - 1] : null;
          props.onShareToGroup(G.id, "〔星测 · 群配对榜〕最合：" + gPairs.slice(0, 3).map(x => x.a.name + "×" + x.b.name + " " + x.score).join("、") + (low && low !== top ? "；最冲：" + low.a.name + "×" + low.b.name + " " + low.score : "") + "。按生日算的，图个乐～");
        }, className: "active:opacity-80", style: { width: "100%", minHeight: 44, background: "transparent", border: "1px solid " + S.tint, borderRadius: 3, color: S.tint, fontFamily: F_BODY, fontSize: 13.5, marginTop: 4 } }, "发到「" + (G.name || "群") + "」里，让大家看看") : null);

    // ---- 问星（第 4 条）：写一件事，按今天的行运抽一句；同一天同一问，答案不变 ----
    const lastAsk = asks[0] && asks[0].day === today ? asks[0] : null;
    const doAsk = () => {
      const res = askStars(askText, meChart, meInfo ? meInfo.sign : -1, today);
      if (!res) { props.toast && props.toast(askText.trim() ? "先填上你的生日才问得了星星" : "先写下想问的事"); return; }
      const next = [res].concat(asks.filter(x => !(x.q === res.q && x.day === res.day))).slice(0, 12);
      setAsks(next); try { saveJSON(ASK_KEY, next); } catch (e) {}
      setAskText("");
    };
    const askView = h("div", { className: "flex flex-col" },
      h(Panel, { S: S, title: "问星星一件事" },
        h("textarea", { value: askText, onChange: e => setAskText(e.target.value), rows: 3, placeholder: "比如：这周适合跟他表白吗？", "aria-label": "想问的事",
          style: { width: "100%", minWidth: 0, padding: 12, borderRadius: 3, border: "1px solid " + S.line, background: "transparent", color: S.ink, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6 } }),
        h("button", { onClick: doAsk, className: "active:opacity-80", style: { width: "100%", minHeight: 44, marginTop: 8, background: S.tint, color: S.bg, border: "none", borderRadius: 3, fontFamily: F_BODY, fontSize: 14, letterSpacing: ".1em" } }, "抽一句"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 6 } }, meChart ? "按今天天上的行星和你的星盘挑；同一天同一个问题，答案不会变" : "没有带年份的生日，只按星座的日运来")),
      lastAsk ? h(Panel, { S: S, title: "星星说" },
        h("div", { "data-wk": "astroask", style: { fontFamily: F_BODY, fontSize: 12, color: S.fog } }, "「" + lastAsk.q + "」 · 问的是" + lastAsk.area),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, color: S.tint, marginTop: 6 } }, lastAsk.verdict),
        h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, lineHeight: 1.7, marginTop: 4 } }, lastAsk.line),
        chars.length ? h("div", { style: { marginTop: 10 } }, pickRow(people.filter(p => p.char), commenter, setCommenter, "让谁看看")) : null,
        (() => { const c = (byId(commenter) || {}).char; if (!c) return null;
          const key = "ask|" + today + "|" + lastAsk.q.slice(0, 40) + "|" + c.id;
          const ins = meName + "拿一件事问了星星：「" + lastAsk.q + "」。按今天的行运抽出来的是「" + lastAsk.verdict + "」（" + lastAsk.line + "）。这是算出来的，不是你编的。\n她把这个拿给你看。说说你怎么想——问的是什么事、你信不信、要不要接她这个话，全由你这个人决定。";
          return h("div", null, noteBox(key, c), askBtn(key, c, ins)); })()) : null,
      asks.filter(x => x !== lastAsk).length ? h(Panel, { S: S, title: "问过的" }, asks.filter(x => x !== lastAsk).slice(0, 8).map((x, i) => h("div", { key: i, style: { padding: "7px 0", borderBottom: "1px solid " + S.line } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: S.ink } }, x.q),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, marginTop: 2 } }, x.day.replace(/-/g, ".") + " · " + x.verdict)))) : null);

    if (editing) return h(BirthPage, { S: S, person: byId(editing), value: birth[editing] || {}, onBack: () => setEditing(""),
      onSave: v => { const all = Object.assign({}, loadBirth()); if (v) all[editing] = v; else delete all[editing]; setBirth(saveBirth(all)); setEditing(""); } });
    const tabs = [["today", "今日"], ["pair", "配对"], ["chart", "星盘"], ["group", "群榜"], ["ask", "问星"]];
    return h("div", { "data-wk": "app", className: "h-full flex flex-col", style: { background: S.bg, backgroundImage: STARS, backgroundSize: "320px 380px" } },
      h(Head, { zh: "星测", onBack: props.onBack, ink: S.ink, bg: "transparent", noLine: true }),
      h("div", { className: "shrink-0" }, h(StarTabs, { tabs: tabs, cur: tab, onPick: setTab, S: S })),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 16px 24px" } },
        tab === "today" ? todayView : tab === "pair" ? pairView : tab === "chart" ? chartView : tab === "group" ? groupView : askView,
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, textAlign: "center", marginTop: 18, lineHeight: 1.6 } },
          "按生日算的，图个乐。让 TA 看看才会调用一次模型。")));
  }

  g.Astro = { signOf, signMatch, shukuOf, shukuRelation, birthInfo, daily, dayKeyOf, SIGNS, SHUKU, SHUKU_POS,
    planetLongitudes, ascendant, natalChart, synastry, transits, birthDateOf, CITIES, chinaDst, tzForPlace, searchPlace,
    skyOn, skyNote, goodDays, pairGoodDays, solarReturn, askStars, loadBirth };
  // ── 查手机里的「星测」（她 2026-10-05：「数据就拿刷新当天的看，看他玩抽到的话他点开看到的也会更新成看他玩当天的」）──
  //   不调模型：TA 那天打开星测会看到的东西，全是按生日算的。哪天算？——TA 上一次「真打开」的那天：
  //   查手机整份刷新那天，或者看 TA 玩时 TA 点开星测的那天。没记过就按今天。
  const SEEN_KEY = "x_phoneAstroDay";
  function markSeen(charId, day) { if (!charId) return; const all = loadJSON(SEEN_KEY, {}) || {}; all[charId] = day || dayKeyOf(); saveJSON(SEEN_KEY, all); }
  const seenDay = charId => (loadJSON(SEEN_KEY, {}) || {})[charId] || dayKeyOf();
  function AstroPhoneView({ char, profile, onBack }) {
    const S = sky(), day = seenDay(char.id), birth = loadBirth();
    const ci = birthInfo(char.birthday), mi = birthInfo((profile || {}).birthday);
    const cChart = natalChart(char.birthday, birth[char.id]), mChart = natalChart((profile || {}).birthday, birth.me);
    const d0 = ci && ci.sign >= 0 ? daily(ci.sign, day) : null;
    const tr = d0 && cChart ? transits(cChart, noonOf(day)) : null;
    const dd = !d0 ? null : !tr ? d0 : Object.assign({}, d0, { all: tr.all, love: tr.love, work: tr.work, money: tr.money, line: tr.hits.length ? transitLine(tr.hits[0]) + "。" : d0.line });
    const syn = synastry(cChart, mChart), sm = ci && mi ? signMatch(ci.sign, mi.sign) : null;
    const uName = (profile && profile.name) || "她", cName = char.remark || char.name;
    return h("div", { "data-wk": "phoneastro", className: "h-full min-h-0 flex flex-col", style: { background: S.bg, backgroundImage: STARS, backgroundSize: "320px 380px", color: S.ink } },
      h(Head, { zh: "星测", sub: cName + " 上次打开 · " + day.slice(5).replace("-", "月") + "日", onBack, ink: S.ink, bg: "transparent", noLine: true }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 16px 24px" } },
        h(ZodiacWheel, { S, sign: ci ? ci.sign : -1 }),
        h(Panel, { S, title: "那天的运势" }, !dd ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub } }, "不知道 " + cName + " 的生日，这一页是空的")
          : h("div", null,
            h("div", { className: "flex items-baseline justify-between" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20 } }, signName(ci.sign)), h(Stars, { n: dd.all, color: S.tint })),
            h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.7, marginTop: 6 } }, dd.line),
            h("div", { style: { display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", marginTop: 10, fontFamily: F_BODY, fontSize: 12, color: S.sub, alignItems: "center" } },
              "爱情", h(Stars, { n: dd.love, color: S.accent }), "事业", h(Stars, { n: dd.work, color: S.accent }), "财运", h(Stars, { n: dd.money, color: S.accent })),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: S.fog, marginTop: 8 } }, "幸运色 " + dd.color.name + " · 幸运数字 " + dd.number))),
        h(Panel, { S, title: "他配过的对" }, (syn || sm)
          ? h("div", null, h("div", { className: "flex items-baseline justify-between" },
              h("div", { style: { fontFamily: F_BODY, fontSize: 14 } }, cName + " × " + uName),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, color: S.tint } }, syn ? syn.score : sm.score)),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: S.sub, marginTop: 4, lineHeight: 1.7 } },
              syn && syn.list[0] ? synLine(syn.list[0], cName, uName) : sm ? sm.aspect + " · " + sm.note : ""))
          : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub } }, "两个人的生日都知道了才配得出来"))));
  }
  g.AstroPhoneView = AstroPhoneView;
  g.AstroSignCard = AstroSignCard;
  // ── 星星点头的日子，聊天顶栏那颗头像亮一圈（第 6 条，她：「也可以但是搞好看点」）──
  //   一圈金色细光慢慢转，三颗小星沿着轨道走；平常日子什么都没有。系统开了「减少动态」就只留一圈静光。
  //   判据只问 pairGoodDays 那一处（星测配对页、日历、角色那一行都是它），今天在不在那三天里。
  function isGoodDay(char) {
    try { const prof = loadJSON("x_profile", {}) || {}; const dk = dayKeyOf();
      return !!(char && char.id && pairGoodDays(prof.birthday, char.id, char.birthday, new Date(), 30).some(x => x.day === dk)); } catch (e) { return false; }
  }
  function AstroHalo({ size, children }) {
    const S = SKY_BASE, R = size / 2 + 5, W = size + 14;
    return h("span", { "data-wk": "astrohalo", title: "星星点头的日子", style: { position: "relative", display: "inline-flex", flexShrink: 0 } },
      h("style", null, "@keyframes qqHaloSpin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.qq-halo-spin{animation:none!important}}"),
      h("span", { "aria-hidden": "true", style: { position: "absolute", left: -7, top: -7, width: W, height: W, borderRadius: 999, boxShadow: "0 0 10px 1px " + S.tint + "55", pointerEvents: "none" } }),
      h("svg", { "aria-hidden": "true", className: "qq-halo-spin", viewBox: "0 0 " + W + " " + W, width: W, height: W,
        style: { position: "absolute", left: -7, top: -7, pointerEvents: "none", animation: "qqHaloSpin 14s linear infinite" } },
        h("defs", null, h("linearGradient", { id: "qqHaloG", x1: "0", y1: "0", x2: "1", y2: "1" },
          h("stop", { offset: "0%", stopColor: "#f6e3a1" }), h("stop", { offset: "55%", stopColor: S.tint }), h("stop", { offset: "100%", stopColor: S.accent }))),
        h("circle", { cx: W / 2, cy: W / 2, r: R, fill: "none", stroke: "url(#qqHaloG)", strokeWidth: 1.4, strokeDasharray: "2 3.2", opacity: 0.95 }),
        [0, 120, 240].map(deg => { const a = (deg - 90) * Math.PI / 180, x = W / 2 + Math.cos(a) * R, y = W / 2 + Math.sin(a) * R;
          return h("path", { key: deg, d: sparkle(x, y, deg ? 3.2 : 4.4), fill: deg ? "#f6e3a1" : "#fff7d6" }); })),
      children);
  }
  g.AstroHalo = AstroHalo; g.Astro.isGoodDay = isGoodDay;
  g.Astro.signInstruction = signInstruction; g.Astro.todayFacts = todayFacts; g.Astro.SIGN_SCHEMA = SIGN_SCHEMA;
  g.Astro.markSeen = markSeen; g.Astro.seenDay = seenDay;
  g.AstroApp = AstroApp;
  g.GAstro = function (p) {
    return h(Svg, p, h("circle", { cx: 12, cy: 12, r: 8.5 }), h("path", { d: "M12 5.5l1.3 3.9 4.1.1-3.3 2.4 1.2 3.9L12 13.5l-3.3 2.3 1.2-3.9-3.3-2.4 4.1-.1z" }));
  };
})();
