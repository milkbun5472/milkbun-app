// 健康的开机那半（2026-10-18 瘦身第九批，从 js/health.js 拆出来）：聊天里TA记你吃了什么、到点提醒（HealthCtx、healthAddByChar）、星测和查手机读的数据（Health）、主屏图标，这些开机就要。
//   健康整页在 js/health.js，点进去才加载（js/lazy-mods.js）。测试会 require 这份，所以递过去的那一包挂在 window，没有 window 时挂 globalThis。
// ============================================================
// 健康（v74.640，她 2026-10-03：「按你说的先做健康app吧，页面简洁点方便操作但是不要没有设计感光秃秃」）
//
// 饮食（热量）、喝水、运动和步数、睡眠、体重、经期（跟日历月事本【同一份】x_period）、心情、这一周。
// 接手机健康数据要走快捷指令 → 云端收件箱，另起一版；现在步数和睡眠是她自己填的。
//
// 角色监督是【她自己开的开关】：开不开、谁来管、饭点会不会主动来问，都在「谁看着」那一页。
//   · 上下文只给她点名的那几位，而且只在用得上的时候给一行事实（饭点前后、她刚记过一餐）——
//     不是每轮都塞，也不附带「该怎么管」的规矩：怎么管、管不管，是那个人自己的事。
//   · 主动来问一天最多两次（午饭、晚饭），她那一顿已经记了就不问。
//
// 外卖 app 里点的是角色那边的假单子，不进这里（她 2026-10-03：「外卖是假的app角色的外卖啦」）。
// ============================================================
(function () {
  "use strict";
  const g = typeof window !== "undefined" ? window : globalThis;
  const KEY = "x_health", NUDGE_KEY = "x_healthNudge";

  // ── 日子 ────────────────────────────────────────────────────
  // 日期键走 ScheduleClock 那一处（补零的那种），不另写一份格式
  const dayOf = d => g.ScheduleClock.deviceDayKey(d || new Date());
  const shift = (k, n) => g.ScheduleClock.shiftDayKey(k, n);

  // ── 存档 ────────────────────────────────────────────────────
  const BLANK = () => ({
    meals: [],          // [{ id, day, meal, name, kcal, p, c, f, qty, src, ts }]
    water: {},          // { day: 杯数 }
    weight: [],         // [{ day, kg }]，一天一条，新记的盖旧的
    mood: {},           // { day: { v: 0-4, note } }
    symptoms: {},       // { day: ["痛经", …] }
    sport: [],          // [{ id, day, kind, min, kcal, ts }]
    steps: {},          // { day: 步数 }
    sleep: {},          // { 醒来那天: { bed: "23:40", wake: "07:20", q: 0-2 } }
    goal: { kcal: 1800, water: 8, kg: null, sleepH: null, bedBy: null, steps: null, sportWeek: null },
    pacts: [],          // 跟某个角色立的约：[{ id, charId, kind, target, start, days, reported }]
    weekly: { charId: "", last: "" },   // 每周一谁来写这一周的小结；last＝写过的那一周（周一那天）
    habits: [],         // 自己加的小习惯：[{ id, name, at: "21:30" | "" }]
    habitLog: {},       // { day: [习惯 id] }
    watch: { on: false, ids: [], nudge: false, env: false },
    env: null,          // 手机最近一次报上来的：{ ts, lat, lon, place, weather, temp, battery }
    home: null,         // { lat, lon }：她自己设的「家」
    gateway: { url: "", key: "", at: 0, err: "" }   // 她自己的网关（有才填），秋秋\u673a只去那儿拉、不往别处发
  });
  function load() {
    const d = typeof loadJSON === "function" ? loadJSON(KEY, null) : null;
    const b = BLANK();
    if (!d || typeof d !== "object") return b;
    return Object.assign(b, d, {
      goal: Object.assign(b.goal, d.goal || {}),
      weekly: Object.assign(b.weekly, d.weekly || {}),
      pacts: Array.isArray(d.pacts) ? d.pacts : [], habits: Array.isArray(d.habits) ? d.habits : [], habitLog: d.habitLog && typeof d.habitLog === "object" ? d.habitLog : {},
      watch: Object.assign(b.watch, d.watch || {}),
      gateway: Object.assign(b.gateway, d.gateway || {})
    });
  }
  const save = d => { if (typeof saveJSON === "function") saveJSON(KEY, d); return d; };

  const MEALS = [["breakfast", "早餐"], ["lunch", "午餐"], ["dinner", "晚餐"], ["snack", "加餐"]];
  const mealName = k => (MEALS.find(m => m[0] === k) || [k, k])[1];

  // 常见的那些，一份的量（热量千卡；蛋白/碳水/脂肪克）。查不到就让模型估、或者自己填。
  const FOODS = [
    ["米饭", "一碗", 230, 4, 51, 0.5], ["杂粮饭", "一碗", 210, 5, 44, 1.5], ["白粥", "一碗", 110, 2, 24, 0.3],
    ["馒头", "一个", 220, 7, 45, 1], ["包子（肉）", "一个", 230, 8, 30, 8], ["饺子（猪肉）", "十个", 450, 18, 50, 19],
    ["面条（汤面）", "一碗", 400, 14, 70, 6], ["牛肉面", "一碗", 550, 25, 75, 15], ["炒面", "一盘", 650, 15, 80, 28],
    ["煎饼果子", "一套", 500, 14, 60, 22], ["油条", "一根", 270, 4, 30, 15], ["豆浆", "一杯", 90, 7, 6, 4],
    ["全麦面包", "两片", 160, 7, 28, 2], ["吐司（白）", "两片", 170, 5, 32, 2], ["燕麦片", "一碗", 150, 5, 27, 3],
    ["鸡蛋（水煮）", "一个", 75, 6, 0.5, 5], ["煎蛋", "一个", 110, 6, 0.5, 9], ["牛奶", "一杯", 150, 8, 12, 8],
    ["酸奶", "一杯", 140, 6, 20, 4], ["鸡胸肉", "一块", 165, 31, 0, 4], ["牛排", "一块", 400, 40, 0, 26],
    ["三文鱼", "一块", 280, 30, 0, 17], ["番茄炒蛋", "一份", 220, 12, 9, 15], ["青椒肉丝", "一份", 300, 16, 10, 22],
    ["宫保鸡丁", "一份", 450, 28, 20, 28], ["红烧肉", "一份", 600, 18, 12, 52], ["麻婆豆腐", "一份", 320, 16, 10, 24],
    ["清炒时蔬", "一份", 120, 3, 10, 8], ["凉拌黄瓜", "一份", 60, 1, 6, 4], ["沙拉（油醋）", "一碗", 180, 4, 12, 13],
    ["麻辣烫", "一碗", 600, 25, 60, 28], ["火锅", "一顿", 1000, 50, 60, 60], ["黄焖鸡米饭", "一份", 850, 40, 90, 34],
    ["汉堡", "一个", 520, 25, 45, 26], ["薯条", "中份", 340, 4, 44, 16], ["炸鸡", "两块", 500, 30, 18, 33],
    ["披萨", "两块", 560, 24, 66, 22], ["寿司", "八个", 400, 16, 70, 6], ["便利店饭团", "一个", 190, 5, 38, 2],
    ["苹果", "一个", 95, 0.5, 25, 0.3], ["香蕉", "一根", 105, 1.3, 27, 0.4], ["橙子", "一个", 70, 1.2, 17, 0.2],
    ["葡萄", "一小串", 100, 1, 26, 0.3], ["坚果", "一小把", 170, 6, 6, 15], ["薯片", "一小包", 270, 3, 26, 17],
    ["巧克力", "一小块", 150, 2, 16, 9], ["蛋糕", "一块", 350, 5, 45, 17], ["冰淇淋", "一球", 140, 2, 16, 7],
    ["奶茶（全糖）", "一杯", 450, 4, 75, 14], ["奶茶（三分糖）", "一杯", 300, 4, 45, 12], ["美式咖啡", "一杯", 10, 0.5, 1.5, 0],
    ["拿铁", "一杯", 190, 10, 15, 10], ["可乐", "一罐", 140, 0, 35, 0], ["啤酒", "一罐", 150, 1.5, 13, 0]
  ].map(r => ({ name: r[0], unit: r[1], kcal: r[2], p: r[3], c: r[4], f: r[5] }));

  // 运动：代谢当量（MET）。消耗 ≈ MET × 体重 × 小时；体重用她最近记的那个，没记过按 55 公斤
  const SPORTS = [["走路", 3.5], ["快走", 4.5], ["跑步", 8], ["骑车", 6], ["游泳", 7], ["跳绳", 10], ["爬楼梯", 8],
    ["力量训练", 5], ["瑜伽", 2.5], ["普拉提", 3], ["跳舞", 5], ["羽毛球", 5.5], ["拉伸", 2.3]];
  const burnOf = (met, min, kg) => Math.round(met * (kg || 55) * min / 60);
  const lastKg = d => { const w = (d.weight || []).slice().sort((a, b) => (a.day < b.day ? -1 : 1)); return w.length ? Number(w[w.length - 1].kg) : 55; };
  // 睡了多久（分钟）：跨午夜按第二天算
  const hm = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); return m ? +m[1] * 60 + +m[2] : null; };
  // 填了几点睡几点醒就按那两个算；只有快捷指令带来的总时长（min）时用它
  const sleepMin = r => { const a = r && hm(r.bed), b = r && hm(r.wake);
    if (a != null && b != null) return ((b - a + 1440) % 1440) || 0;
    return r && Number(r.min) > 0 ? Math.round(Number(r.min)) : 0; };
  const hrs = min => Math.floor(min / 60) + " 小时" + (min % 60 ? " " + (min % 60) + " 分" : "");

  // ── 算 ────────────────────────────────────────────────────
  const mealsOn = (d, day) => (d.meals || []).filter(m => m.day === day);
  const sum = (rows, k) => Math.round(rows.reduce((a, m) => a + (Number(m[k]) || 0) * (Number(m.qty) || 1), 0));
  function dayTotals(d, day) {
    const rows = mealsOn(d, day);
    return { kcal: sum(rows, "kcal"), p: sum(rows, "p"), c: sum(rows, "c"), f: sum(rows, "f"), n: rows.length,
      water: Number((d.water || {})[day]) || 0, mood: (d.mood || {})[day] || null, sym: (d.symptoms || {})[day] || [],
      sportMin: (d.sport || []).filter(s => s.day === day).reduce((a, s) => a + (Number(s.min) || 0), 0),
      burn: (d.sport || []).filter(s => s.day === day).reduce((a, s) => a + (Number(s.kcal) || 0), 0),
      steps: Number((d.steps || {})[day]) || 0, sleep: sleepMin((d.sleep || {})[day]) };
  }
  function weekOf(d, endDay) {
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(shift(endDay, -i));
    return days.map(day => Object.assign({ day }, dayTotals(d, day)));
  }
  function weightTrend(d) {
    const w = (d.weight || []).slice().sort((a, b) => (a.day < b.day ? -1 : 1));
    return w.slice(-30);
  }

  // ── 目标、立约、每周小结（她 2026-10-05：「都可以，做吧」）────────────
  // 几点前睡：凌晨的那几个点按「前一天夜里」比（0:30 比 23:50 晚），所以中午以前的一律加一天
  const lateMin = s => { const v = hm(s); return v == null ? null : (v < 720 ? v + 1440 : v); };
  // 睡眠记在【醒来那天】：说「X 号晚上」的那一觉，记在 X+1 那一格
  const nightOf = (d, day) => (d.sleep || {})[shift(day, 1)] || null;
  // 立约能约的几样。each：名字、拿哪个目标当默认、这一天做到没（true/false；没记＝null 不算）
  const PACT_KINDS = [
    { k: "water", zh: "每天喝够水", goal: d => d.goal.water, unit: v => v + " 杯", ok: (d, day, v) => dayTotals(d, day).water >= v },
    { k: "kcal", zh: "每天不吃超", goal: d => d.goal.kcal, unit: v => v + " 千卡以内", ok: (d, day, v) => { const t = dayTotals(d, day); return t.n ? t.kcal <= v + t.burn : null; } },
    { k: "sleepH", zh: "每晚睡够", goal: d => d.goal.sleepH, unit: v => v + " 小时", night: true, ok: (d, day, v) => { const n = nightOf(d, day), m = sleepMin(n); return m ? m >= v * 60 : null; } },
    { k: "bedBy", zh: "每晚按时睡", goal: d => d.goal.bedBy, unit: v => v + " 前睡", night: true, ok: (d, day, v) => { const n = nightOf(d, day), b = n && lateMin(n.bed); return b == null ? null : b <= lateMin(v); } },
    { k: "steps", zh: "每天走够", goal: d => d.goal.steps, unit: v => v + " 步", ok: (d, day, v) => { const n = dayTotals(d, day).steps; return n ? n >= v : null; } },
    { k: "sport", zh: "每天动一动", goal: () => 20, unit: v => v + " 分钟", ok: (d, day, v) => dayTotals(d, day).sportMin >= v }
  ];
  const pactKind = k => PACT_KINDS.find(x => x.k === k) || null;
  // 这一约每一天：ok（做到）/ miss（没做到）/ none（没记）/ wait（还没到、或者那一晚还没醒来）
  function pactDays(d, p, today) {
    const K = pactKind(p.kind); if (!K) return [];
    const out = [];
    for (let i = 0; i < p.days; i++) {
      // 白天那几样：过了那天才算定局（今天已经够了就先亮）；夜里那两样：那一觉醒来才知道
      const day = shift(p.start, i), ready = K.night ? shift(day, 1) <= today : day < today;
      if (!ready) { out.push({ day, st: !K.night && day === today && K.ok(d, day, p.target) === true ? "ok" : "wait" }); continue; }
      const r = K.ok(d, day, p.target);
      out.push({ day, st: r === true ? "ok" : r === false ? "miss" : "none" });
    }
    return out;
  }
  const pactEnd = p => { const K = pactKind(p.kind); return shift(p.start, p.days + (K && K.night ? 1 : 0)); };   // 这一天起就能结账了
  const pactLive = (p, today) => today < pactEnd(p);
  const pactText = (d, p, today) => {
    const K = pactKind(p.kind), ds = pactDays(d, p, today);
    const zh = { ok: "做到了", miss: "没做到", none: "没记", wait: "还没到" };
    return "从 " + p.start.slice(5) + " 起 " + p.days + " 天，" + K.zh + "（" + K.unit(p.target) + "）："
      + ds.map((x, i) => "第" + (i + 1) + "天" + zh[x.st]).join("、") + "。做到 " + ds.filter(x => x.st === "ok").length + " 天。";
  };
  // 体重照这样走，大约哪天到目标：最近四周的体重拉一条直线，方向对了才说
  function weightEta(d) {
    const goal = Number(d.goal.kg); if (!goal) return null;
    const w = weightTrend(d).filter(x => x.day >= shift(dayOf(), -28));
    if (w.length < 3) return null;
    const t0 = g.ScheduleClock.parseDayKey(w[0].day).getTime(), xs = w.map(x => (g.ScheduleClock.parseDayKey(x.day).getTime() - t0) / 864e5), ys = w.map(x => Number(x.kg));
    const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    const den = xs.reduce((a, x) => a + (x - mx) * (x - mx), 0); if (!den) return null;
    const k = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / den;   // 公斤／天
    const last = ys[n - 1], gap = goal - last;
    if (Math.abs(gap) < 0.1) return { reached: true };
    if (!k || Math.sign(k) !== Math.sign(gap)) return { away: true, perWeek: Math.round(k * 70) / 10 };
    const days = Math.round(gap / k); if (days > 730) return null;
    const at = g.ScheduleClock.parseDayKey(dayOf()); at.setDate(at.getDate() + days);
    return { days, date: (at.getMonth() + 1) + " 月 " + at.getDate() + " 日", perWeek: Math.round(k * 70) / 10 };
  }
  // 这一周的数，一段话。「让 TA 看看这周」和每周一那封小结共用这一份
  function weekFacts(d, endDay) {
    const wk = weekOf(d, endDay), G = d.goal;
    const logged = wk.filter(x => x.n), avgK = logged.length ? Math.round(logged.reduce((a, x) => a + x.kcal, 0) / logged.length) : 0;
    const avgW = Math.round(wk.reduce((a, x) => a + x.water, 0) / 7 * 10) / 10;
    const wIn = (d.weight || []).filter(w => w.day >= wk[0].day && w.day <= endDay).sort((a, b) => (a.day < b.day ? -1 : 1));
    const dW = wIn.length >= 2 ? Math.round((wIn[wIn.length - 1].kg - wIn[0].kg) * 10) / 10 : null;
    const sportW = wk.reduce((a, x) => a + x.sportMin, 0), stepD = wk.filter(x => x.steps);
    const pacts = (d.pacts || []).filter(p => p.start <= endDay && pactEnd(p) > wk[0].day);
    return "这一周（" + wk[0].day + " 到 " + endDay + "）：记了饮食的有 " + logged.length + " 天，那几天平均约 " + avgK + " 千卡（她定的 " + (G.kcal || 1800) + "）；"
      + "平均每天喝水 " + avgW + " 杯（定的 " + (G.water || 8) + "）；" + (dW != null ? "体重变了 " + (dW > 0 ? "+" : "") + dW + " 公斤；" : "")
      + "这周运动 " + sportW + " 分钟" + (G.sportWeek ? "（定的一周 " + G.sportWeek + "）" : "") + "；"
      + (stepD.length ? "走路平均 " + Math.round(stepD.reduce((a, x) => a + x.steps, 0) / stepD.length) + " 步" + (G.steps ? "（定的 " + G.steps + "）" : "") + "；" : "")
      + (wk.some(x => x.sleep) ? "睡眠：" + wk.map(x => x.sleep ? hrs(x.sleep) : "没记").join("、") + (G.sleepH ? "（定的 " + G.sleepH + " 小时）" : "") + "；" : "")
      + "心情：" + wk.map(x => x.mood ? MOODS[x.mood.v] : "没记").join("、") + "。"
      + (pacts.length ? "这周有约在身：" + pacts.map(p => pactText(d, p, dayOf())).join("") : "");
  }
  // 这一周几样数，一行一样——每周小结那张卡上用
  function weekRows(d, endDay) {
    const wk = weekOf(d, endDay), G = d.goal, logged = wk.filter(x => x.n), sl = wk.filter(x => x.sleep);
    return [
      ["吃", logged.length ? "平均 " + Math.round(logged.reduce((a, x) => a + x.kcal, 0) / logged.length) + " 千卡" + (G.kcal ? " / " + G.kcal : "") : "没记"],
      ["喝水", "平均 " + Math.round(wk.reduce((a, x) => a + x.water, 0) / 7 * 10) / 10 + " 杯" + (G.water ? " / " + G.water : "")],
      ["睡", sl.length ? "平均 " + hrs(Math.round(sl.reduce((a, x) => a + x.sleep, 0) / sl.length)) + (G.sleepH ? " / " + G.sleepH + " 小时" : "") : "没记"],
      ["动", wk.reduce((a, x) => a + x.sportMin, 0) + " 分钟" + (G.sportWeek ? " / " + G.sportWeek : "")]
    ];
  }
  // 小习惯到点了还没勾：给 app 那头发个提醒（每样一天只提醒一次）
  const HABIT_PING = "x_healthHabitPing";
  function habitDue(now) {
    const d = load(), t = now || Date.now(), day = dayOf(new Date(t)), m = minuteNow(t);
    const done = d.habitLog[day] || [], log = (typeof loadJSON === "function" ? loadJSON(HABIT_PING, {}) : {}) || {}, pinged = log[day] || [];
    return (d.habits || []).filter(x => x.at && hm(x.at) != null && m >= hm(x.at) && m - hm(x.at) < 180 && !done.includes(x.id) && !pinged.includes(x.id));
  }
  function markHabitPinged(id, now) {
    const day = dayOf(new Date(now || Date.now())), log = (typeof loadJSON === "function" ? loadJSON(HABIT_PING, {}) : {}) || {};
    if (typeof saveJSON === "function") saveJSON(HABIT_PING, { [day]: (log[day] || []).concat([id]) });
  }

  // ── 角色那一头：一行事实，按需给 ─────────────────────────────
  // 饭点窗口用她这边的钟（吃饭的是她）：早 6:30–9:30、午 11–13:30、晚 17–20
  const WINDOWS = [["breakfast", 390, 570], ["lunch", 660, 810], ["dinner", 1020, 1200]];
  const minuteNow = now => { const t = new Date(now || Date.now()); return t.getHours() * 60 + t.getMinutes(); };
  const windowAt = now => { const m = minuteNow(now); return (WINDOWS.find(w => m >= w[1] && m <= w[2]) || [null])[0]; };
  // ── 位置 / 天气 / 电量 ──
  // 只给粗的说法：在家、在家附近、离家多远——经纬度原数不进提示词
  const distKm = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lon - a.lon);
    const s = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
  function whereText(d) {
    const e = d.env; if (!e) return "";
    if (e.lat != null && e.lon != null && d.home && d.home.lat != null) {
      const k = distKm(d.home, e);
      return k < 0.3 ? "在家" : k < 2 ? "在家附近" : "不在家（离家约 " + (k < 10 ? k.toFixed(1) : Math.round(k)) + " 公里）";
    }
    return e.place ? "在" + e.place : "";
  }
  // 最近一件事：到家/出门三小时内、起床两小时内、睡觉十小时内才算数
  const EV_FRESH = { 到家: 3, 出门: 3, 起床: 2, 睡觉: 10 };
  const CHARGE = { 充电: 1, 拔电: 1 };
  function chargeState(d, now) {
    const e = (d.events || []).filter(x => CHARGE[x.kind]).slice(-1)[0];
    return e && (now || Date.now()) - e.at < 12 * 3600000 ? Object.assign({ on: e.kind === "充电" }, e) : null;
  }
  function lastEvent(d, now) {
    const e = (d.events || []).filter(x => !CHARGE[x.kind]).slice(-1)[0]; if (!e) return null;
    const ago = (now || Date.now()) - e.at;
    return ago >= 0 && ago <= (EV_FRESH[e.kind] || 2) * 3600000 ? Object.assign({ ago }, e) : null;
  }
  const agoText = ms => { const m = Math.max(1, Math.round(ms / 60000)); return m < 60 ? m + " 分钟" : Math.round(m / 60) + " 小时"; };
  const EV_SAY = { 到家: "到家了", 出门: "出门了", 起床: "起床了", 睡觉: "说去睡了" };
  const isAway = d => { const e = lastEvent(d); if (e && (e.kind === "到家" || e.kind === "出门") && (!d.env || e.at >= (d.env.ts || 0))) return e.kind === "出门"; return /^不在家/.test(whereText(d)); };
  const isRain = e => /雨|雪|雷|rain|snow|storm|shower|drizzle/i.test(String(e && e.weather || ""));
  const ENV_FRESH = 3 * 3600000;
  const rainyToday = (d, t) => !!(d.env && d.env.forecast && d.env.forecastDay === dayOf(new Date(t || Date.now())) && isRain({ weather: d.env.forecast }));   // 三小时前报的就不算「此刻」了
  function envLine(d, now) {
    const t = now || Date.now(), e = d.env, ev = lastEvent(d, t);
    let out = "";
    if (e && t - (e.ts || 0) <= ENV_FRESH) {
      // 比这份位置更新的一件「到家/出门」盖掉按坐标算的那句
      const where = ev && (ev.kind === "到家" || ev.kind === "出门") && ev.at >= (e.ts || 0) ? "" : whereText(d);
      const bits = [where, e.weather ? "那边" + e.weather + (e.temp != null ? " " + Math.round(e.temp) + "°" : "") : "",
        e.battery != null ? "手机电量 " + Math.round(e.battery) + "%" : ""].filter(Boolean);
      if (e.forecast && e.forecastDay === dayOf(new Date(t))) bits.push("今天预报" + e.forecast);
      if (bits.length) out += "（" + agoText(t - (e.ts || t)) + "前手机报的）她" + bits.join("，") + "。";
    }
    if (ev) out += "她 " + agoText(ev.ago) + "前" + (EV_SAY[ev.kind] || "：" + ev.kind) + "。";
    const ch = chargeState(d, t);
    if (ch && ch.on) out += "她的手机 " + agoText(t - ch.at) + "前插上了充电器。";
    return out;
  }

  // 这几个数怎么读、拿来干嘛：常驻那一行和饭点来问那一行共用这一句（她 2026-10-08 截图：开了健康关心，
  //   他一口气五条「健康记录上一整天光秃秃的零」「仙女靠吸暖气过活」「晚上到底吃什么」——把没记读成了没吃，
  //   把「让你知道」读成了「派你来查岗」）。
  const HEALTH_READ = "这些数是她顺手记的，【没记不等于没吃没喝】，多半只是没顺手点。她开这个是让你多知道一点她今天过得怎样，不是派你来查岗："
    + "你还是你平时那个人，平时怎么惦记她，这会儿就怎么惦记——想问就照你自己会问的样子问一句，问过了等她回，不用连着追问、也不用拿数字说事。";
  // noteFor：只给她点了名的人；只在饭点前后、或她两小时内刚记过一餐时出一行，其余时候空字符串＝零 token
  // 跟这个人立着的约：不看「谁看着」开没开——约是她跟他两个人定的，他本来就该知道
  function pactLine(d, charId, t) {
    const today = dayOf(new Date(t)), ps = (d.pacts || []).filter(p => p.charId === charId && pactLive(p, today));
    return ps.length ? "你们俩约好了的：" + ps.map(p => pactText(d, p, today)).join("") + "做到没做到、要不要提，照你自己的性子和你们现在的关系来。" : "";
  }
  function noteFor(charId, now) {
    const pl = pactLine(load(), charId, now || Date.now());
    const rest = noteForWatch(charId, now);
    return pl + rest;
  }
  // 身体这几天怎么样（她 2026-10-10：群友想让角色知道「我不舒服」——不编病历，只读她自己真记过的）：
  //   近 n 天里记了的不舒服、心情不好、睡得很少。没有就空字符串＝零 token。
  function bodyLine(d, t, n) {
    const today = dayOf(new Date(t || Date.now())), bits = [];
    for (let i = 0; i < (n || 2); i++) {
      const day = shift(today, -i), when = i === 0 ? "今天" : i === 1 ? "昨天" : i + " 天前";
      const sym = ((d.symptoms || {})[day] || []).filter(Boolean), md = (d.mood || {})[day], sl = sleepMin((d.sleep || {})[day]);
      const one = [];
      if (sym.length) one.push("记了" + sym.join("、"));
      if (md && md.v != null && md.v <= 1) one.push("心情" + MOODS[md.v] + (md.note ? "（" + String(md.note).slice(0, 30) + "）" : ""));
      if (sl && sl < 300) one.push("只睡了 " + hrs(sl));
      if (one.length) bits.push(when + one.join("，"));
    }
    return bits.length ? "她健康里自己记的：" + bits.join("；") + "。这是她让你知道的，惦记就照你平时的样子问一句，别拿着记录说教。" : "";
  }
  // 查手机翻到的那一页：近 7 天她自己记的（吃喝、睡眠、运动、心情、不舒服、体重），一天一行，没记的那天不写
  function peekText(now) {
    const d = load(), t = now || Date.now(), today = dayOf(new Date(t)), out = [];
    for (let i = 0; i < 7; i++) {
      const day = shift(today, -i), x = dayTotals(d, day), b = [];
      if (x.n) b.push("记了 " + x.n + " 样吃的约 " + x.kcal + " 千卡（" + mealsOn(d, day).slice(-3).map(m => m.name).join("、") + "）");
      if (x.water) b.push("喝水 " + x.water + " 杯");
      if (x.sleep) b.push("睡了 " + hrs(x.sleep));
      if (x.sportMin) b.push("运动 " + x.sportMin + " 分钟");
      if (x.steps) b.push(x.steps + " 步");
      if (x.mood && x.mood.v != null) b.push("心情" + MOODS[x.mood.v] + (x.mood.note ? "（" + String(x.mood.note).slice(0, 30) + "）" : ""));
      if (x.sym.length) b.push("不舒服：" + x.sym.join("、"));
      const w = (d.weight || []).find(r => r.day === day);
      if (w) b.push("体重 " + w.kg + " kg");
      if (b.length) out.push("· " + (i === 0 ? "今天" : i === 1 ? "昨天" : day.slice(5)) + "：" + b.join("，"));
    }
    return out.join("\n");
  }
  function noteForWatch(charId, now) {
    const d = load();
    if (!d.watch.on || !(d.watch.ids || []).includes(charId)) return "";
    const t = now || Date.now(), day = dayOf(new Date(t));
    const rows = mealsOn(d, day);
    const fresh = rows.some(m => t - (m.ts || 0) < 2 * 3600000);
    // 位置天气电量另开一个开关；手机刚报上来的那三小时里一直给（它说的就是「此刻」）
    const env = d.watch.env ? envLine(d, t) : "";
    const body = bodyLine(d, t, 2);
    if (!windowAt(t) && !fresh) return (env ? env + "这是她自己开的，让你知道她此刻在哪、那边天气、手机还剩多少电——提不提、怎么提，照你自己的性子来。" : "") + body;
    const tot = dayTotals(d, day);
    const got = MEALS.slice(0, 3).map(m => mealName(m[0]) + (rows.some(r => r.meal === m[0]) ? "记了" : "没记")).join("、");
    const ate = rows.slice(-4).map(m => m.name).join("、");
    return "今天到现在记了约 " + tot.kcal + " 千卡（她给自己定的是 " + d.goal.kcal + "），" + got
      + (ate ? "；最近记的是" + ate : "") + "；水喝了 " + tot.water + "/" + d.goal.water + " 杯"
      + (tot.sportMin ? "；今天动了 " + tot.sportMin + " 分钟" : "") + (tot.sleep ? "；昨晚睡了 " + hrs(tot.sleep) : "") + "。"
      + env + HEALTH_READ + body;
  }
  // 主动来问：开了「饭点会来问」、在午饭/晚饭窗口里、那一顿还没记、今天这一顿还没问过、一天最多两次
  // 饭点那两次和手机报上来的那两种（电量低、下雨还在外面）各算各的：饭点一天最多两次，后两种各一天一次
  function nudgeDue(now) {
    const d = load();
    const t = now || Date.now(), day = dayOf(new Date(t));
    const log = (typeof loadJSON === "function" ? loadJSON(NUDGE_KEY, {}) : {}) || {};
    const today = log[day] || [];
    // 约满了：跟他约的那个人来结账（一约一次）
    const due = (d.pacts || []).find(p => !p.reported && !pactLive(p, day));
    if (due) { const K = pactKind(due.kind), ds = pactDays(d, due, day);
      return { meal: "pact-" + due.id, label: "你们的约到期了", ids: [due.charId], day,
        line: "你们俩约好的那件事到期了。" + pactText(d, due, day), tail: "你【主动】找 Ta 说说这一约——照你的性子和你们现在的关系来。",
        // 他说完话，聊天里跟一张小卡：那几天的圆点（她 2026-10-05）
        card: { what: "healthnote", note: "pact", title: K.zh + " " + K.unit(due.target), start: due.start, days: due.days, dots: ds.map(x => x.st) } }; }
    // 每周一封小结：周一上午九点以后，那个人来说说上一周。周一没开 App 的话，这周晚些时候补上（一周一次）
    const hr = new Date(t).getHours(), wd = new Date(t).getDay(), monday = shift(day, -((wd + 6) % 7));
    if (d.weekly.charId && d.weekly.last !== monday && (wd !== 1 || hr >= 9))
      return { meal: "weekly-" + monday, label: "每周的小结", ids: [d.weekly.charId], day,
        line: "她在健康 app 里请你每周看看她上一周过得怎样。" + weekFacts(d, shift(monday, -1)), tail: "你【主动】找 Ta，跟 Ta 说说你看完这一周的感想。",
        card: { what: "healthnote", note: "weekly", title: shift(monday, -7).slice(5) + " — " + shift(monday, -1).slice(5), rows: weekRows(d, shift(monday, -1)) } };
    if (!d.watch.on || !d.watch.nudge || !(d.watch.ids || []).length) return null;
    const ids = d.watch.ids.slice();
    const ev = d.watch.env ? lastEvent(d, t) : null;
    if (ev && ev.ago < 40 * 60000 && !today.includes("ev-" + ev.kind)) {
      const hr = new Date(t).getHours();
      const say = { 起床: hr >= 5 && hr < 13 ? "她刚起床" : "", 到家: "她刚到家", 出门: hr >= 6 && hr < 23 ? (rainyToday(d, t) ? "她刚出门，今天预报要下雨" : "她刚出门") : "" }[ev.kind];
      if (say) return { meal: "ev-" + ev.kind, label: say, ids, day, line: envLine(d, t) + "她开了让你知道她在哪、在干嘛。" };
    }
    if (d.watch.env && d.env && t - (d.env.ts || 0) < ENV_FRESH) {
      const hr = new Date(t).getHours(), env = envLine(d, t);
      const ch = chargeState(d, t);
      // 报完电量之后插上了充电器，就不来提醒充电
      const charging = ch && ch.on && ch.at >= (d.env.ts || 0) - 10 * 60000;
      if (d.env.battery != null && d.env.battery < 20 && !charging && !today.includes("battery") && hr >= 8 && hr < 24)
        return { meal: "battery", label: "她手机快没电了", ids, day, line: env + "她开了让你知道她在哪、那边天气和手机电量。" };
      if (rainyToday(d, t) && !isRain(d.env) && !today.includes("umbrella") && !today.includes("ev-出门") && hr >= 7 && hr < 10)
        return { meal: "umbrella", label: "今天预报要下雨", ids, day, line: envLine(d, t) + "她开了让你知道她在哪、那边天气。" };
      if (isRain(d.env) && isAway(d) && !today.includes("rain") && hr >= 7 && hr < 23)
        return { meal: "rain", label: "她在外面，那边下雨", ids, day, line: env + "她开了让你知道她在哪、那边天气和手机电量。" };
    }
    const meal = windowAt(t);
    if (meal !== "lunch" && meal !== "dinner") return null;
    if (mealsOn(d, day).some(m => m.meal === meal)) return null;
    if (today.filter(k => k === "lunch" || k === "dinner").length >= 2 || today.includes(meal)) return null;
    const tot = dayTotals(d, day);
    return { meal, label: mealName(meal) + "的点", ids, day,
      line: HEALTH_READ + "她今天记到现在约 " + tot.kcal + " 千卡、水 " + tot.water + "/" + d.goal.water + " 杯，" + mealName(meal) + "还没记。"
        + (d.watch.env ? envLine(d, t) : "") };
  }
  function markNudged(day, meal) {
    // 约和每周小结记在存档本身上（不只记今天那一格）：明天再看也知道结过账、写过了
    if (/^pact-/.test(meal)) { const d = load(), id = meal.slice(5), p0 = (d.pacts || []).find(p => p.id === id);
      save(Object.assign({}, d, { pacts: (d.pacts || []).map(p => p.id === id ? Object.assign({}, p, { reported: true }) : p) }));
      // 一天不落地做满了：收进你们俩的「时刻」（她 2026-10-05）——跟她自己「收进时刻」的那些放在同一处
      try { if (p0 && !p0.pinned && pactDays(d, p0, day).every(x => x.st === "ok") && typeof loadJSON === "function") {
        const K = pactKind(p0.kind), all = loadJSON("x_shikePins", {}) || {};
        all[p0.charId] = [{ id: "pin_pact_" + p0.id, ts: Date.now(), title: "说好的 " + p0.days + " 天，一天不落", text: "从 " + p0.start.slice(5) + " 起 " + p0.days + " 天，" + K.zh + "（" + K.unit(p0.target) + "），每一天都做到了。", role: "user" }].concat(all[p0.charId] || []).slice(0, 300);
        saveJSON("x_shikePins", all);
        const d2 = load(); save(Object.assign({}, d2, { pacts: (d2.pacts || []).map(p => p.id === id ? Object.assign({}, p, { pinned: true }) : p) }));
      } } catch (e) {}
    }
    if (/^weekly-/.test(meal)) { const d = load(); save(Object.assign({}, d, { weekly: Object.assign({}, d.weekly, { last: meal.slice(7) }) })); }
    const log = (typeof loadJSON === "function" ? loadJSON(NUDGE_KEY, {}) : {}) || {};
    const keep = {}; keep[day] = (log[day] || []).concat([meal]);
    if (typeof saveJSON === "function") saveJSON(NUDGE_KEY, keep);   // 只留今天那一格，旧的自然丢掉
  }

  // ── 手机健康 → 快捷指令 → 剪贴板 → 这里 ─────────────────────────
  // 不经过任何服务器（她 2026-10-03：「让每个人可以自己设置，不用靠我来搭服务」）：
  //   每个人在自己 iPhone 的「快捷指令」里读健康数据，拼成下面这几行字拷到剪贴板，回来点「导入」。
  //   网页读不到健康 App，也不能从快捷指令直接往 App 里塞（主屏上的网页和 Safari 是两份存档），剪贴板是两边都够得着的那一处。
  const SHORTCUT_MARK = "秋秋健康";
  const SHORTCUT_TEMPLATE = [SHORTCUT_MARK, "日期：", "步数：", "睡眠：", "活动能量：", "运动分钟：", "体重：", "喝水：",
    "纬度：", "经度：", "天气：", "气温：", "预报：", "电量：", ""].join("\n");
  // 先跑通用的精简版：只有步数、位置、电量三样（教程第 2 步就是先搭这三样）
  const SHORTCUT_TEMPLATE_MINI = [SHORTCUT_MARK, "步数：", "纬度：", "经度：", "电量：", ""].join("\n");
  const SC_KEYS = [["steps", /^(步数|步|steps?)$/i], ["sleep", /^(睡眠|睡眠小时|睡眠时长|睡觉|sleep)$/i], ["kcal", /^(活动能量|动态能量|运动消耗|消耗|active ?energy)$/i],
    ["min", /^(运动分钟|锻炼分钟|锻炼|运动|exercise)$/i], ["kg", /^(体重|weight)$/i], ["water", /^(喝水|水|饮水|water)$/i], ["date", /^(日期|date)$/i],
    ["lat", /^(纬度|lat|latitude)$/i], ["lon", /^(经度|lon|lng|longitude)$/i], ["place", /^(地点|位置|地址|place|location)$/i],
    ["weather", /^(天气|weather)$/i], ["forecast", /^(预报|天气预报|今天天气|forecast)$/i], ["temp", /^(气温|温度|temp|temperature)$/i], ["battery", /^(电量|电池|battery)$/i],
    ["event", /^(事件|发生了|event)$/i], ["at", /^(收到时间|received)$/i]];
  const num = s => { const m = String(s || "").replace(/[,，\s]/g, "").match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
  function scDay(v, today) {
    const s = String(v || "").trim();
    let m = /(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/.exec(s);
    if (m) return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
    m = /(\d{1,2})\s*月\s*(\d{1,2})/.exec(s);
    if (m) return today.slice(0, 4) + "-" + ("0" + m[1]).slice(-2) + "-" + ("0" + m[2]).slice(-2);
    if (/昨天|yesterday/i.test(s)) return shift(today, -1);
    return today;
  }
  // 认不出（没有「秋秋健康」那一行、或者一个数都没有）→ null。数字后面带单位、带千分位都行。
  // 手机那头的「此刻发生了什么」（到家、出门、起床、睡觉）：每种一个自动化，各投一句「事件：到家」
  // 插上/拔掉充电器单独算一条线（chargeState），不顶掉「到家/出门」那件事；拔掉得排在前面，不然「拔掉充电器」会被认成充电
  const EVENTS = [["拔电", /拔|断开|unplug/i], ["充电", /插上|开始充电|充电|charg/i], ["到家", /到家|回家|回来了|arrive|home/i], ["出门", /出门|离家|出去|leave/i], ["起床", /起床|醒了|醒来|闹钟|wake/i], ["睡觉", /睡觉|睡了|就寝|晚安|sleep|bed/i]];
  const eventKind = v => (EVENTS.find(e => e[1].test(v)) || [String(v).slice(0, 12)])[0];
  function parseShortcut(text, today) {
    const lines = String(text || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (!lines.some(l => l.replace(/\s/g, "") === SHORTCUT_MARK)) return null;
    const r = { day: today };
    lines.forEach(l => {
      const m = /^([^:：]+)[:：](.*)$/.exec(l); if (!m) return;
      const k = (SC_KEYS.find(x => x[1].test(m[1].trim())) || [])[0], v = m[2].trim();
      if (!k || !v) return;
      if (k === "date") { r.day = scDay(v, today); return; }
      if (k === "place" || k === "weather" || k === "forecast") { r[k] = v.slice(0, 40); return; }
      if (k === "event") { r.event = eventKind(v); return; }
      if (k === "at") { const x = num(v); if (x > 1e12) r.at = x; return; }
      if (k === "battery") { const b = num(v); if (b != null) r.battery = b <= 1 && !/%/.test(v) && /\./.test(v) ? b * 100 : b; return; }
      if (k === "temp" || k === "lat" || k === "lon") { const x = num(v); if (x != null) r[k] = x; return; }
      const n = num(v); if (n == null || n < 0) return;
      if (k === "sleep") {
        // 快捷指令给的时长可能是小时、分钟或秒：按大小认，单位写了就照单位
        r.sleepMin = /秒|sec/i.test(v) || n > 1440 ? Math.round(n / 60) : /分|min/i.test(v) || n > 24 ? Math.round(n) : Math.round(n * 60);
      } else if (k === "water") r.waterMl = /升|\bl\b/i.test(v) && !/毫升|ml/i.test(v) ? n * 1000 : n;
      else r[k] = n;
    });
    return ["steps", "sleepMin", "kcal", "min", "kg", "waterMl", "lat", "place", "weather", "forecast", "battery", "event"].some(k => r[k] != null) ? r : null;
  }
  // 合进存档：同一天再导一次就覆盖手机那一份，她自己记的不动
  function applyShortcut(d, r) {
    const day = r.day, n = Object.assign({}, d);
    if (r.steps != null) n.steps = Object.assign({}, d.steps, { [day]: Math.round(r.steps) });
    if (r.sleepMin) n.sleep = Object.assign({}, d.sleep, { [day]: Object.assign({}, (d.sleep || {})[day] || {}, { min: r.sleepMin, src: "shortcut" }) });
    if (r.kcal || r.min) n.sport = (d.sport || []).filter(s => s.id !== "hk-" + day)
      .concat([{ id: "hk-" + day, day, kind: "手机记的活动", min: Math.round(r.min || 0), kcal: Math.round(r.kcal || 0), src: "shortcut", ts: Date.now() }]);
    if (r.kg > 20 && r.kg < 300) n.weight = (d.weight || []).filter(w => w.day !== day).concat([{ day, kg: Math.round(r.kg * 10) / 10 }]);
    if (r.waterMl) n.water = Object.assign({}, d.water, { [day]: Math.max(Number((d.water || {})[day]) || 0, Math.round(r.waterMl / 250)) });
    if (r.lat != null || r.place || r.weather || r.forecast || r.battery != null) {
      const ok = r.lat != null && r.lon != null && Math.abs(r.lat) <= 90 && Math.abs(r.lon) <= 180;
      const prev = d.env || {};
      n.env = { ts: r.at || Date.now(), lat: ok ? r.lat : null, lon: ok ? r.lon : null, place: r.place || "", weather: r.weather || "",
        // 预报一天报一次就够：这次没带就沿用今天早些时候那份
        forecast: r.forecast || (prev.forecastDay === r.day ? prev.forecast || "" : ""), forecastDay: r.forecast ? r.day : (prev.forecastDay === r.day ? r.day : ""),
        temp: r.temp != null ? r.temp : null, battery: r.battery != null ? Math.max(0, Math.min(100, r.battery)) : null };
    }
    if (r.event) {
      const at = r.at || Date.now();
      n.events = (d.events || []).filter(e => e.at !== at).concat([{ at, kind: r.event }]).sort((a, b) => a.at - b.at).slice(-30);
    }
    n.hkAt = Date.now();
    return n;
  }

  // ── 她自己的网关（有才用）────────────────────────────────────
  // 有人自己架了网关：快捷指令每天定时把那段字（或同样字段的 JSON）发给网关，网关存着最新一份；
  //   秋秋打开、切回前台时去 GET 一次。只往她填的那个地址发，别的地方一个字都不发。十分钟内不重复拉。
  const JSON_KEYS = { steps: "步数", sleep: "睡眠", activeEnergy: "活动能量", kcal: "活动能量", exercise: "运动分钟", weight: "体重", water: "喝水",
    lat: "纬度", latitude: "纬度", lon: "经度", lng: "经度", longitude: "经度", weather: "天气", temp: "气温", temperature: "气温", battery: "电量", date: "日期", place: "地点", event: "事件", at: "收到时间" };
  function gatewayText(raw) {
    const s = String(raw || "").trim();
    if (s.includes(SHORTCUT_MARK)) return s;
    try {
      let j = JSON.parse(s); if (j && j.data && typeof j.data === "object") j = j.data;
      if (!j || typeof j !== "object") return "";
      if (typeof j.text === "string") return j.text.includes(SHORTCUT_MARK) ? j.text : SHORTCUT_MARK + "\n" + j.text;
      return [SHORTCUT_MARK].concat(Object.keys(j).map(k => (JSON_KEYS[k] || k) + "：" + j[k])).join("\n");
    } catch (e) { return ""; }
  }
  // 没有网关的人照这个搭一个：Cloudflare Workers 免费档，自带 https，不用买服务器、不用装软件。
  //   POST（快捷指令发来）→ 存进 KV 那一格；GET（秋秋来拿）→ 吐出最新那一份。两头都要带同一把密钥。
  //   ⚠️这段代码是写给她们复制进 Cloudflare 的，改它要连着下面的教程和测试一起看。
  const GATEWAY_WORKER = [
    "// 秋秋\u673a · 健康网关（Cloudflare Workers）第 2 版：健康数据存最新一份，到家/出门/起床/睡觉这些事件存最近 20 件",
    "// 需要：一个名为 HEALTH 的 KV 绑定，一个名为 SECRET 的密钥变量",
    "export default {",
    "  async fetch(req, env) {",
    "    const cors = { \"Access-Control-Allow-Origin\": \"*\", \"Access-Control-Allow-Headers\": \"Authorization, Content-Type\", \"Access-Control-Allow-Methods\": \"GET, POST, OPTIONS\" };",
    "    if (req.method === \"OPTIONS\") return new Response(null, { headers: cors });",
    "    if (!env.SECRET || (req.headers.get(\"Authorization\") || \"\") !== \"Bearer \" + env.SECRET)",
    "      return new Response(\"密钥不对\", { status: 401, headers: cors });",
    "    if (req.method === \"POST\") {",
    "      const text = await req.text();",
    "      if (!text.includes(\"秋秋健康\")) return new Response(\"第一行要是「秋秋健康」\", { status: 400, headers: cors });",
    "      const stamped = text.slice(0, 4000).trim() + \"\\n收到时间：\" + Date.now();",
    "      if (/事件[:：]\\s*\\S/.test(text)) {",
    "        const ev = JSON.parse((await env.HEALTH.get(\"events\")) || \"[]\").concat([stamped]).slice(-20);",
    "        await env.HEALTH.put(\"events\", JSON.stringify(ev));",
    "      } else await env.HEALTH.put(\"latest\", stamped);",
    "      return new Response(\"收到\", { headers: cors });",
    "    }",
    "    const latest = (await env.HEALTH.get(\"latest\")) || \"\";",
    "    const ev = JSON.parse((await env.HEALTH.get(\"events\")) || \"[]\");",
    "    return new Response([latest].concat(ev).filter(Boolean).join(\"\\n\\n\"), { headers: Object.assign({ \"Content-Type\": \"text/plain; charset=utf-8\", \"Cache-Control\": \"no-store\" }, cors) });",
    "  }",
    "};",
    ""].join("\n");
  const hash = s => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return String(x); };
  let pulling = false;
  async function pullGateway(force) {
    const d = load(), gw = d.gateway || {};
    if (!gw.url || pulling || typeof fetch !== "function") return null;
    if (!force && Date.now() - (gw.at || 0) < 10 * 60000) return null;
    pulling = true;
    let next = Object.assign({}, d.gateway, { at: Date.now() }), r = null;
    try {
      const res = await fetch(gw.url, { headers: gw.key ? { Authorization: "Bearer " + gw.key } : {}, cache: "no-store" });
      if (!res.ok) throw new Error("网关回了 " + res.status);
      const raw = await res.text();
      // 新版网关一次回好几段（最近一份健康 + 最近几件事），每段都以「秋秋健康」开头；旧版只回一段
      const blocks = raw.includes(SHORTCUT_MARK) ? raw.split(new RegExp("(?=" + SHORTCUT_MARK + ")")).filter(b => b.includes(SHORTCUT_MARK)) : [gatewayText(raw)];
      const seen = (d.gateway && d.gateway.seen) || [];
      const fresh = blocks.map(b => b.trim()).filter(b => b && !seen.includes(hash(b)));
      const rs = fresh.map(b => parseShortcut(b, dayOf())).filter(Boolean);
      if (!blocks.some(b => parseShortcut(b, dayOf()))) throw new Error("网关回的不是那几行字。它回的是：" + raw.slice(0, 120));
      // 同一段拿过就不再用：不然每拿一次，那份旧位置旧电量就又被当成「刚报的」
      next.seen = seen.concat(fresh.map(hash)).slice(-60);
      r = rs.length ? rs : null;
      next.err = "";
    } catch (e) {
      next.err = String(e && e.message || e).slice(0, 200);
    } finally { pulling = false; }
    const cur = load();
    save(Object.assign((r || []).reduce((acc, x) => applyShortcut(acc, x), cur), { gateway: next }));
    try { g.dispatchEvent && g.dispatchEvent(new Event("qq-health-updated")); } catch (e) {}
    return r;
  }
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("visibilitychange", () => { if (!document.hidden) pullGateway(false); });
    setTimeout(() => pullGateway(false), 4000);
  }

  // ── 让模型估 ────────────────────────────────────────────────
  // 一次性生成：料全放 system，user 只留一句触发（prompt-send-shape.md）
  async function estimate(api, text) {
    if (!api || typeof callAI !== "function") throw new Error("先到设置配置 API");
    const sys = "她吃了下面这些，帮她估一下热量和三大营养素。按中国家常/外卖常见的一份量来估，说的是几份就算几份。\n"
      + "拆成一样一样的吃食，每样给：name（她说的那样东西）、kcal（千卡，整数）、p / c / f（蛋白质、碳水、脂肪，克，整数）。\n"
      + "只回 JSON：{\"items\":[{\"name\":\"吃食\",\"kcal\":0,\"p\":0,\"c\":0,\"f\":0}]}\n\n她写的：" + String(text || "").slice(0, 400);
    const raw = await callAI(api, sys, [{ role: "user", content: "开始。" }], { maxTokens: 65000, tag: "health" });
    const j = typeof extractJSON === "function" ? extractJSON(raw) : null;
    const items = (j && Array.isArray(j.items) ? j.items : [])
      .map(x => ({ name: String(x && x.name || "").slice(0, 30), kcal: Math.max(0, Math.round(Number(x && x.kcal) || 0)),
        p: Math.round(Number(x && x.p) || 0), c: Math.round(Number(x && x.c) || 0), f: Math.round(Number(x && x.f) || 0) }))
      .filter(x => x.name && x.kcal > 0);
    if (!items.length) throw new Error("没估出来。模型回的是：\n" + String(raw || "").slice(0, 320));
    return items;
  }
  // 心情五档：只是一张脸的嘴角，从往下撇到往上翘
  const MOODS = ["很差", "不太好", "一般", "还不错", "很好"];

  // ── 角色替她记（她 2026-10-05：「健康那里能不能也支持让角色帮我记，跟记账一样触发关键词才记」）──
  //   跟 ledgerAddByChar 同一个形状：模型给一份（或几份）结构化记录，这里逐条校验、落进同一份 x_health。
  //   认不出的那条直接丢掉，绝不猜着记；一条都没记上就返回 null（app 那头就不会出「记好了」的卡）。
  //   rec.kind：meal 一餐 / water 喝水（杯）/ sport 运动 / weight 体重 / sleep 睡眠 / steps 步数 / mood 心情
  const MEAL_ZH = { 早餐: "breakfast", 早饭: "breakfast", 午餐: "lunch", 午饭: "lunch", 晚餐: "dinner", 晚饭: "dinner", 加餐: "snack", 零食: "snack", 夜宵: "snack" };
  const MOOD_ZH = ["很糟", "低落", "一般", "不错", "很好"];
  function healthAddByChar(charId, recs) {
    try {
      const list = (Array.isArray(recs) ? recs : [recs]).filter(r => r && typeof r === "object").slice(0, 6);
      if (!list.length) return null;
      let d = load(); const today = dayOf(), done = [];
      const lastKg = () => { const w = weightTrend(d); return w.length ? w[w.length - 1].kg : null; };
      list.forEach((r, i) => {
        const day = /^\d{4}-\d{2}-\d{2}$/.test(String(r.date || "")) ? r.date : today;
        const by = { byChar: charId || "", ts: Date.now() };
        const kind = String(r.kind || "").trim();
        if (kind === "meal") {
          const name = String(r.name || "").trim().slice(0, 30), kcal = Math.round(Number(r.kcal) || 0);
          if (!name || !(kcal > 0 && kcal < 5000)) return;
          const meal = MEALS.some(m => m[0] === r.meal) ? r.meal : MEAL_ZH[String(r.meal || "").trim()] || "snack";
          d = Object.assign({}, d, { meals: (d.meals || []).concat([Object.assign({ id: "m" + Date.now().toString(36) + "c" + i, day, meal, name, kcal, p: 0, c: 0, f: 0, qty: 1, src: "char" }, by)]) });
          done.push({ t: mealName(meal) + " · " + name, v: kcal + " 千卡", k: "meal", meal: mealName(meal), name, kcal });
        } else if (kind === "water") {
          const cups = Math.round(Number(r.cups) || 0); if (!(cups > 0 && cups <= 20)) return;
          const now = Number((d.water || {})[day]) || 0;
          d = Object.assign({}, d, { water: Object.assign({}, d.water, { [day]: now + cups }) });
          done.push({ t: "喝水", v: "+" + cups + " 杯（这天共 " + (now + cups) + " 杯）", k: "water", cups, total: now + cups });
        } else if (kind === "sport") {
          const min = Math.round(Number(r.min) || 0); if (!(min > 0 && min <= 600)) return;
          const name = String(r.sport || r.name || "运动").trim().slice(0, 12), sp = SPORTS.find(x => x[0] === name);
          const kcal = Math.round(Number(r.kcal) || 0) || burnOf(sp ? sp[1] : 5, min, lastKg());
          d = Object.assign({}, d, { sport: (d.sport || []).concat([Object.assign({ id: "s" + Date.now().toString(36) + "c" + i, day, kind: name, min, kcal }, by)]) });
          done.push({ t: name, v: min + " 分钟 · 约 " + kcal + " 千卡" });
        } else if (kind === "weight") {
          const kg = Math.round((Number(r.kg) || 0) * 10) / 10; if (!(kg > 20 && kg < 300)) return;
          d = Object.assign({}, d, { weight: (d.weight || []).filter(w => w.day !== day).concat([{ day, kg }]) });
          done.push({ t: "体重", v: kg + " kg" });
        } else if (kind === "sleep") {
          const ok = v => /^\d{1,2}:\d{2}$/.test(String(v || "")); if (!ok(r.bed) || !ok(r.wake)) return;
          const row = { bed: r.bed, wake: r.wake }; const mins = sleepMin(row); if (!mins) return;
          d = Object.assign({}, d, { sleep: Object.assign({}, d.sleep, { [day]: Object.assign({}, (d.sleep || {})[day] || {}, row, { src: "char" }) }) });
          done.push({ t: "睡眠", v: r.bed + " → " + r.wake + "（" + Math.floor(mins / 60) + " 小时" + (mins % 60 ? mins % 60 + " 分" : "") + "）" });
        } else if (kind === "steps") {
          const n = Math.round(Number(r.steps) || 0); if (!(n > 0 && n < 200000)) return;
          d = Object.assign({}, d, { steps: Object.assign({}, d.steps, { [day]: n }) });
          done.push({ t: "步数", v: n + " 步" });
        } else if (kind === "mood") {
          const v = Math.round(Number(r.v)); if (!(v >= 0 && v <= 4)) return;
          d = Object.assign({}, d, { mood: Object.assign({}, d.mood, { [day]: { v, note: String(r.note || "").trim().slice(0, 40) } }) });
          done.push({ t: "心情", v: MOOD_ZH[v] });
        }
      });
      if (!done.length) return null;
      save(d);
      try { g.dispatchEvent && g.dispatchEvent(new CustomEvent("qq-health-updated")); } catch (_) {}
      return { title: done.map(x => x.t).join("、"), sub: done.map(x => x.v).join(" · "), n: done.length, rows: done, day: today };
    } catch (e) { return null; }
  }
  g.healthAddByChar = healthAddByChar;
  g.HealthCtx = { GATEWAY_WORKER, envLine, bodyLine, peekText, whereText, pullGateway, gatewayText, noteFor, nudgeDue, markNudged, habitDue, markHabitPinged, pactDays, weekFacts, weightEta, PACT_KINDS, load, dayTotals, weekOf, FOODS, KEY };
  g.Health = { MOOD_ZH, parseShortcut, applyShortcut, SHORTCUT_TEMPLATE, SHORTCUT_TEMPLATE_MINI, estimate, FOODS, MEALS, SPORTS, burnOf, sleepMin, windowAt, dayTotals, weekOf, load, save };
  // 图标：一颗心上走过一段心电
  g.GHealth = function (p) {
    return h(Svg, p, h("path", { d: "M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" }),
      h("path", { d: "M6 12.5h3l1.3-2.2 2 4 1.3-1.8H18" }));
  };

  // 页面那半要用的，原样递过去
  (typeof window !== "undefined" ? window : globalThis).HealthCore = { g, dayOf, shift, load, save, MEALS, FOODS, SPORTS, burnOf, lastKg, hrs, mealsOn, sum, dayTotals, weekOf, weightTrend, lateMin, PACT_KINDS, pactKind, pactDays, pactLive, weightEta, weekFacts, SHORTCUT_MARK, SHORTCUT_TEMPLATE, SHORTCUT_TEMPLATE_MINI, num, parseShortcut, applyShortcut, GATEWAY_WORKER, pullGateway, estimate, MOODS };
})();
