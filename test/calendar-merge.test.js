const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = f => path.join(__dirname, "..", "js", f);
const app = fs.readFileSync(R("app.js"), "utf8"), comp = fs.readFileSync(R("components.js"), "utf8"), memo = fs.readFileSync(R("memo.js"), "utf8");

// 真把组件跑一遍。React 换成只记结构的假货、hooks 打桩，
// 这样一次 render 就能抓出拼错的变量名、忘了定义的常量、和重名覆盖——
// v56.31 就是靠它发现 lunarDayLabel 撞了名（engine.js 里早有一个同名函数，
// 后声明的把先声明的整个换掉，月历那行农历会静悄悄变成 NaN）。
function harness() {
  const t = { ink: "#111", sub: "#555", fog: "#999", line: "#ddd", bg: "#fff", bg2: "#f5f5f5", tint: "#37c", accent: "#c25" };
  const el = (type, props, ...ch) => ({ type, props, ch });
  const noop = () => {};
  let OV = {};
  const React = {
    createElement: el,
    useState: i => { const v = typeof i === "function" ? i() : i; return [Object.prototype.hasOwnProperty.call(OV, String(v)) ? OV[String(v)] : v, noop]; },
    useEffect: noop, useRef: () => ({ current: null }), useCallback: f => f,
    useContext: () => t, createContext: () => ({ Provider: "P" }), Fragment: "F"
  };
  const ctx = {
    React, console, Math, Date, JSON, setTimeout, clearTimeout, setInterval, clearInterval, Intl, Promise,
    document: { getElementById: () => null, head: { appendChild: noop }, createElement: () => ({ style: {} }), addEventListener: noop, removeEventListener: noop },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop, key: () => null, length: 0 },
    indexedDB: { open: () => ({}) }, navigator: {}, URL: { createObjectURL: () => "" }, fetch: noop, btoa: s => s, atob: s => s,
    addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop })
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ["core.js", "engine.js", "components.js"].forEach(f => vm.runInContext(fs.readFileSync(R(f), "utf8"), ctx, { filename: f }));
  return { ctx, setOverrides: o => { OV = o || {}; } };
}
const TODAY = (() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();
const props = () => ({
  characters: [{ id: "c1", name: "沈屿白", birthday: "1998-03-04" }],
  calendar: { world: { "2026-8-27": [{ id: "w1", title: "世界大事" }] }, chars: {}, mine: { "2026-8-28": [{ id: "m1", title: "体检" }] } },
  calEvents: [{ id: "e1", owner: "mine", startDate: TODAY, endDate: TODAY, startTime: "09:00", endTime: "11:00", title: "出差", location: "北京", icon: "✈️" },
              { id: "e2", owner: "mine", startDate: TODAY, endDate: TODAY, title: "全天事" }],
  schedules: { c1: { [TODAY]: { load: "HIGH LOAD", estTime: 9, kind: "live", murmurs: [{ time: "10:10", text: "困" }],
    seqs: [{ time: "08:00", end: "08:40", title: "起床", type: "coffee" },
           { time: "10:00", end: "12:00", title: "跑实验", location: "实验室", type: "work", deviation: { plan: "本来去健身", reason: "下雨", actual: "留在实验室" } }] } } },
  profile: { name: "Lisa", birthday: "1999-08-26" },
  period: { cycleLen: 28, periodLen: 5, starts: [{ start: "2026-08-20" }], visibleTo: ["c1"] },
  busy: false, genWeekBusy: false, onBack: () => {}, onSaveEvent: () => {}, onDelEvent: () => {}, onGenMonth: () => {},
  onSavePeriod: () => {}, onRecordPeriod: () => {}, onSaveTimed: () => {}, onDelTimed: () => {}, onGenWeek: () => {}
});
const nodeCount = n => { let k = 0; (function walk(x) { if (!x) return; if (Array.isArray(x)) return x.forEach(walk); if (x.type !== undefined) { k++; walk(x.ch); walk(x.props && x.props.children); } })(n); return k; };

test("日历的每个分支都渲染得出来", () => {
  const { ctx, setOverrides } = harness();
  const cases = [
    ["月视图·我的", {}], ["日视图·我的", { month: "day" }],
    ["月视图·角色", { mine: "c1" }], ["日视图·角色（有块、有偏差、有碎碎念）", { mine: "c1", month: "day" }],
    ["月视图·世界", { mine: "world" }], ["各种弹层全开", { month: "day", false: true }]
  ];
  cases.forEach(([name, ov]) => {
    setOverrides(ov);
    const out = ctx.Calendar(props());
    assert.ok(nodeCount(out) > 30, name + " 渲染出来是空的");
  });
  setOverrides({});
  assert.ok(nodeCount(ctx.CalEventForm({ initial: { startDate: TODAY }, owner: "mine", ownerName: "我", onClose: () => {}, onSave: () => {}, onDelete: () => {} })) > 30);
  assert.ok(nodeCount(ctx.CalWidget({ now: new Date(), calendar: props().calendar, onOpen: () => {}, period: props().period })) > 30);
});

// 她 2026-08-26 截图：17:00–19:00 的块贴在 19:00 的刻度旁边，整体错开一格。
// 病因是刻度列拿写死的 paddingTop:52 去凑表头高度——而表头是变高的（日期两行 +
// 最多三条全天事件）。现在表头独立成一行，刻度和事件从同一个 y=0 起算。
// 这条不看代码长什么样，直接量渲染出来的坐标。
test("刻度和事件块对得上：整点块的 top 必须等于那条整点线的 top", () => {
  const { ctx, setOverrides } = harness();
  setOverrides({ mine: "c1", month: "day" });
  const tree = ctx.Calendar(props());
  const tops = { line: [], label: [], block: [] };
  // 把祖先身上的 paddingTop / marginTop 一路累加进来——那个 52px 的偏移就藏在这儿，
  // 只量各自容器内部的 top 是量不出来的。
  (function walk(x, off) {
    if (!x) return;
    if (Array.isArray(x)) return x.forEach(n => walk(n, off));
    if (x.type === undefined) return;
    const st = (x.props && x.props.style) || {};
    const abs = st.position === "absolute";
    if (abs && typeof st.top === "number") {
      const y = st.top + off;
      if (st.height === 1) tops.line.push(y);
      else if (st.fontSize === 10 && typeof x.ch[0] === "string") tops.label.push({ top: y, text: x.ch[0] });
    }
    if (x.props && x.props.className && String(x.props.className).indexOf("absolute") >= 0 && typeof st.top === "number") tops.block.push({ top: st.top + off, h: st.height });
    const inner = abs ? off + (Number(st.paddingTop) || 0) : off + (Number(st.paddingTop) || 0) + (Number(st.marginTop) || 0);
    walk(x.ch, inner); walk(x.props && x.props.children, inner);
  })(tree, 0);
  assert.ok(tops.line.length >= 8, "整点线没画出来");
  assert.ok(tops.label.length >= 8, "刻度文字没画出来");
  assert.ok(tops.block.length >= 2, "事件块没画出来：" + tops.block.length);

  // 刻度文字是把基线往上抬 6px 画的，所以 label.top + 6 就是那条线的位置
  const lineSet = new Set(tops.line);
  tops.label.forEach(l => {
    if (!/^\d{2}:00$/.test(l.text)) return;
    assert.ok(lineSet.has(l.top + 6), l.text + " 的刻度（top=" + l.top + "）旁边没有对应的整点线");
  });
  // 10:00 起的那个块（测试数据里的「跑实验」）必须正好落在 10:00 那条线上
  const tenLabel = tops.label.find(l => l.text === "10:00");
  assert.ok(tenLabel, "没有 10:00 这一格");
  assert.ok(tops.block.some(b => Math.abs(b.top - (tenLabel.top + 6)) < 0.01),
    "10:00 开始的块没落在 10:00 那条线上：块 " + JSON.stringify(tops.block.map(b => b.top)) + " vs 线 " + (tenLabel.top + 6));
});

// 她 2026-08-26：角色在日本、和她有时差，可日程还是按「正常时间」画的。
// 刻度和「此刻」红线是【她的】时间，块却是 TA 当地时刻——不换算就永远对不上。
test("异地角色的块按她的时间摆位，块上写 TA 当地时刻", () => {
  const comp2 = fs.readFileSync(R("components.js"), "utf8");
  assert.match(comp2, /const tzShift = isCharView && typeof schedTzShiftMin === "function" \? schedTzShiftMin\(curChar\) : 0/);
  assert.match(comp2, /const toMyMin = m => \(m == null \? null : \(\(\(m - tzShift\) % 1440\) \+ 1440\) % 1440\)/);
  const seg = comp2.slice(comp2.indexOf("const blocksOn = dk =>"), comp2.indexOf("const dayHasAnything"));
  assert.match(seg, /let st = toMyMin\(cst\), en = st \+ \(cen - cst\)/, "块长度不变，只是整体挪位");
  assert.match(seg, /if \(en > 1440\) en = 1440;/, "换算后跨天的截在这一天里，别画成溢出");
  assert.match(seg, /charFrom: tzShift \? s\.time : ""/, "块上仍写 TA 当地时刻——他嘴里说的是这个");
  assert.match(comp2, /b\.charFrom \? b\.charFrom \+ "–"/);
  assert.match(comp2, /格子按你的时间，块上写的是 TA 当地时刻/, "得在界面上说清楚，不然更糊涂");
});

test("同时区的角色一个字都不变", () => {
  const { ctx } = harness();
  // tzShift=0 时 toMyMin 是恒等的：这条靠公式本身保证，钉住免得哪天加了偏移
  const toMyMin = (m, tzShift) => (m == null ? null : (((m - tzShift) % 1440) + 1440) % 1440);
  assert.equal(toMyMin(600, 0), 600);
  assert.equal(toMyMin(600, 60), 540, "TA 快 1 小时：TA 的 10:00 是她的 09:00");
  assert.equal(toMyMin(30, 60), 1410, "跨过零点要绕回去，不能变成负数");
  assert.ok(ctx);
});

// 她 2026-08-26：「点到27号凌晨那块就拉不下来只能到5.00了」——
// 范围原来是按「当天有没有更早的块」现算的，27 号第一件事在 05:00，凌晨那五小时整段不画。
test("时间轴永远是整 24 小时，凌晨拉得上去", () => {
  const comp2 = fs.readFileSync(R("components.js"), "utf8");
  assert.match(comp2, /const range = \{ lo: 0, hi: 24 \* 60 \};/);
  assert.ok(!/lo = Math\.min\(lo, Math\.floor\(b\.from \/ 60\)/.test(comp2), "别再按当天的块去缩范围");
  // 真量一遍：刻度必须从 00:00 一直排到 24:00
  const { ctx, setOverrides } = harness();
  setOverrides({ mine: "c1", month: "day" });
  const labels = [];
  (function walk(x) { if (!x) return; if (Array.isArray(x)) return x.forEach(walk);
    if (x.type === undefined) return;
    const st = (x.props && x.props.style) || {};
    if (st.position === "absolute" && st.fontSize === 10 && typeof x.ch[0] === "string" && /^\d{2}:00$/.test(x.ch[0])) labels.push(x.ch[0]);
    walk(x.ch); walk(x.props && x.props.children); })(ctx.Calendar(props()));
  assert.ok(labels.includes("00:00"), "凌晨那一格必须在：" + labels.slice(0, 5).join(","));
  assert.ok(labels.includes("24:00"));
  assert.equal(labels.length, 25, "00:00 到 24:00 共 25 条刻度");
});

test("进日视图自动滚到该看的地方，不是一片凌晨空白", () => {
  const comp2 = fs.readFileSync(R("components.js"), "utf8");
  const seg = comp2.slice(comp2.indexOf("useEffect(() => {\n    if (mode !== \"day\""), comp2.indexOf("const blockNode"));
  assert.match(seg, /dayList\.indexOf\(todayKey\) >= 0\) at = nowMin - 90/, "有今天就滚到此刻前一个半小时");
  assert.match(seg, /Math\.min\.apply\(null, firsts\) : 8 \* 60\) - 30/, "否则滚到当天第一件事之前半小时");
});

test("表头不在滚动区里——它一变高就会把整条时间轴顶歪", () => {
  const comp2 = fs.readFileSync(R("components.js"), "utf8");
  const i = comp2.indexOf("const dayView = () =>");
  const seg = comp2.slice(i, comp2.indexOf("// ---- 人物条 ----", i));
  assert.ok(!/paddingTop:\s*\d/.test(seg), "刻度列不许再拿写死的 paddingTop 去凑表头高度");
  assert.match(seg, /表头行（不滚）/);
  assert.match(seg, /dayList\.map\(dayHeader\)/);
});

// 重名会把先来的那个函数整个换掉，而且一声不吭
test("月历那行农历小字没跟已有的同名函数撞车", () => {
  const { ctx } = harness();
  assert.equal(typeof ctx.calLunarCell, "function");
  const r = ctx.calLunarCell(new Date(2026, 7, 26));
  assert.equal(r.text, "十四");
  assert.equal(ctx.calLunarCell(new Date(2026, 7, 13)).text, "七月", "初一那天写月名");
  assert.equal(ctx.calLunarCell(new Date(2026, 7, 13)).hi, true);
  assert.equal((fs.readFileSync(R("engine.js"), "utf8").match(/function lunarDayLabel\(/g) || []).length, 1,
    "lunarDayLabel 只该有一个定义");
});

test("跨天事件每天各出现一次，首尾按当天截断", () => {
  const { ctx } = harness();
  const evs = [{ id: "a", owner: "mine", startDate: "2026-08-26", endDate: "2026-08-28", startTime: "09:00", endTime: "11:00", title: "出差" }];
  const say = d => ctx.calEventsOnDay(evs, "mine", d).map(x => x._from + "-" + x._to).join();
  assert.equal(say("2026-08-26"), "09:00-24:00");
  assert.equal(say("2026-08-27"), "00:00-24:00");
  assert.equal(say("2026-08-28"), "00:00-11:00");
  assert.equal(ctx.calEventsOnDay(evs, "mine", "2026-08-29").length, 0);
  assert.equal(ctx.calEventsOnDay(evs, "c1", "2026-08-26").length, 0, "别人的日历上不许出现");
});

test("没填时刻的就是全天事件", () => {
  const { ctx } = harness();
  const r = ctx.calEventsOnDay([{ id: "a", owner: "mine", startDate: "2026-08-26", title: "体检" }], "mine", "2026-08-26");
  assert.equal(r[0]._allDay, true);
});

test("同一条事件永远同一个颜色", () => {
  const { ctx } = harness();
  assert.equal(ctx.calEvAutoColor("ce_abc"), ctx.calEvAutoColor("ce_abc"));
});

// 她 2026-08-26：「跟备忘录一样」——那就用同一套规则，别自己另发明一套
test("重复规则和备忘录逐条对得上", () => {
  const { ctx } = harness();
  const on = (start, rp, day) => ctx.calRepeatOn(start, rp, day);
  assert.equal(on("2026-08-26", "none", "2026-08-26"), true);
  assert.equal(on("2026-08-26", "none", "2026-08-27"), false);
  assert.equal(on("2026-08-26", "weekly", "2026-09-02"), true);
  assert.equal(on("2026-08-26", "weekly", "2026-08-19"), false, "锚点之前不算");
  assert.equal(on("2026-08-26", "biweekly", "2026-09-09"), true);
  assert.equal(on("2026-08-26", "biweekly", "2026-09-02"), false);
  assert.equal(on("2026-08-31", "monthly", "2026-09-30"), true, "短月压到月底");
  assert.equal(on("2026-01-15", "monthlyEnd", "2026-02-28"), true);
  assert.equal(on("2020-02-29", "yearly", "2026-02-28"), true);
});

test("重复的日程按单日算，不和跨天混在一起", () => {
  const { ctx } = harness();
  const ev = [{ id: "r", owner: "mine", startDate: "2026-08-26", endDate: "2026-08-30", repeat: "weekly", startTime: "09:00", endTime: "10:00", title: "周会" }];
  assert.equal(ctx.calEventsOnDay(ev, "mine", "2026-08-26").length, 1);
  assert.equal(ctx.calEventsOnDay(ev, "mine", "2026-08-27").length, 0, "重复的就别再按 endDate 铺开");
  assert.equal(ctx.calEventsOnDay(ev, "mine", "2026-09-02").length, 1);
  assert.equal(ctx.calEventsOnDay(ev, "mine", "2026-08-26")[0]._repeats, true);
});

// 她 2026-08-26：「颜色注释现在看不到了你帮我弄回来」
test("经期四个阶段的颜色注释还在", () => {
  const { ctx, setOverrides } = harness();
  setOverrides({});
  const tree = ctx.Calendar(props());
  const texts = [];
  (function walk(x) { if (!x) return; if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x === "string") return texts.push(x);
    if (x.type !== undefined) { walk(x.ch); walk(x.props && x.props.children); } })(tree);
  ["经期", "排卵期", "排卵日", "安全期"].forEach(w => assert.ok(texts.includes(w), "图例里少了「" + w + "」"));
});

// 她 2026-08-26：「世界日程只是在顶部放东西的话那还不如把世界和我的日历合并成一个」
test("世界并进我的：只剩一个「我」的档，世界事件挂 🌐", () => {
  const { ctx, setOverrides } = harness();
  setOverrides({});
  const tree = ctx.Calendar(props());
  const texts = [];
  (function walk(x) { if (!x) return; if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x === "string") return texts.push(x);
    if (x.type !== undefined) { walk(x.ch); walk(x.props && x.props.children); } })(tree);
  assert.ok(!texts.includes("世界"), "人物条里不该再有单独的「世界」档");
  const comp2 = fs.readFileSync(R("components.js"), "utf8");
  assert.match(comp2, /worldStore\[legacyKeyOf\(dk\)\] \|\| \[\]\)\.forEach\(e => out\.push\(\{ text: "🌐 "/, "世界事件仍要显示，挂 🌐 区分");
  assert.match(comp2, /onGenMonth\(view === "mine" \? "world" : view/, "在「我的」里生成的仍写进世界那个桶");
});

// 她 2026-08-26 拿 float 那个日历对比：「他的每一个比我们的大」——
// 「日历 / CALENDAR」那个大标题白占掉小半屏，删掉，头像条上移，格子按剩下的高度平分。
test("月视图铺满剩下的高度，不再被大标题挤扁", () => {
  const comp2 = fs.readFileSync(R("components.js"), "utf8");
  const i = comp2.indexOf("const monthView = () =>");
  const seg = comp2.slice(i, comp2.indexOf("// ---- 日视图", i));
  assert.match(seg, /gridAutoRows: "1fr"/, "行高要按剩余高度平分，不能是内容高度");
  assert.ok(!/overflow-y-auto/.test(seg), "一个月本来就该一屏放下，不该出现滚动");
  assert.ok(!/pb-24/.test(seg));
  // 日期和农历都放大了
  assert.match(seg, /width: 36, height: 36/);
  assert.match(seg, /fontSize: 19, color: isT/);
});

test("顶栏收成一行，不再有「日历 / CALENDAR」大标题", () => {
  const { ctx, setOverrides } = harness();
  setOverrides({});
  const texts = [];
  (function walk(x) { if (!x) return; if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x === "string") return texts.push(x);
    if (x.type !== undefined) { walk(x.ch); walk(x.props && x.props.children); } })(ctx.Calendar(props()));
  assert.ok(!texts.includes("Calendar"), "英文副标题该没了");
  assert.ok(texts.some(x => /^\d{4}年$/.test(x)), "左上角改成年份：" + JSON.stringify(texts.slice(0, 12)));
  assert.ok(texts.includes("今天"));
  const comp2 = fs.readFileSync(R("components.js"), "utf8");
  const i = comp2.indexOf("function Calendar({");
  assert.ok(!/h\(Head, \{ zh: "日历"/.test(comp2.slice(i, comp2.indexOf("function calPlanLoadLine", i))), "Calendar 不该再用 Head");
});

// 她 2026-08-26：「日历和日程合并了那其实是不是不需要这个 ai 生成本月事件了，
// 可以直接在我的日历界面生成全部世界大事」——角色的日子已经由一周排程整天整天排出来了，
// 再来一层月度事件是重复的。
test("月度事件生成只留在「我」这档，角色那边退场", () => {
  const comp2 = fs.readFileSync(R("components.js"), "utf8");
  const i = comp2.indexOf("fab && h(\"div\"");
  const seg = comp2.slice(i, comp2.indexOf("setFab(v => !v)", i));
  assert.match(seg, /view === "mine" && h\("button".*?setGenOpen\(true\)/s, "这个入口要挂在 mine 上");
  assert.ok(!/AI 生成本月事件/.test(seg), "角色那档的「AI 生成本月事件」要撤掉");
  assert.match(seg, /🌐　AI 生成本月世界大事/);
  assert.match(seg, /isCharView && h\("button".*?onGenWeek/s, "角色那档留的是排一周");
});

// 她 2026-08-26：「备忘录日程也要开开始结束时间…落在实际时间段，点开可以看细节跟备忘录那边一样」
test("备忘录提醒填了时刻就落在时间轴上，点开跳回备忘录同一份详情", () => {
  const comp2 = fs.readFileSync(R("components.js"), "utf8");
  assert.match(comp2, /if \(!r \|\| !r\.startTime\) return;/, "有时刻的才画成块");
  assert.match(comp2, /if \(r && r\.startTime\) return;\s*\/\/ 有时刻的画成块/, "有时刻的就别再挤在顶部");
  assert.match(comp2, /b\.memo && typeof window\.memoOpenReminder === "function"/, "点块要跳回备忘录");
  assert.match(memo, /window\.memoOpenReminder = /);
  assert.match(memo, /startTime: startTime \|\| ""/, "提醒表单要存起始时刻");
  assert.match(memo, /window\.__memoOpenId/, "备忘录要接得住这个跳转");
  assert.match(app, /window\.memoGoApp = \(\) => \{ setScreen\("memo"\); \}/);
});

// 她 2026-08-26：「从日历进的日程我想退出来返回日历而不是备忘录，从备忘录进的才返回备忘录」
test("从日历进的提醒，看完了要送回日历；自己在备忘录点开的照旧留在备忘录", () => {
  assert.match(memo, /const \[fromCal, setFromCal\] = useState\(false\)/);
  assert.match(memo, /setDetail\(\{ kind: "reminder", id: want \}\); setFromCal\(true\)/, "只有跳进来那一次才立旗子");
  assert.match(memo, /const leaveIfFromCal = \(\) => \{[\s\S]{0,240}?setFromCal\(false\)/);
  // 三个出口都要送回去：关详情、返回键、编辑表单关掉（含保存和删除）
  assert.match(memo, /const closeDetail = \(\) => \{ setDetail\(null\); leaveIfFromCal\(\); \}/);
  assert.match(memo, /const backOut = \(\) => \{ if \(!leaveIfFromCal\(\)\) props\.onBack/);
  assert.match(memo, /onClose: \(\) => \{ setForm\(null\); leaveIfFromCal\(\); \}, onSave: r => \{ saveReminder\(r\); setForm\(null\); leaveIfFromCal\(\); \}/);
  assert.match(memo, /onClose: closeDetail, tall: true/, "详情面板关掉走的是 closeDetail");
  assert.match(memo, /onBack: backOut/);
  // 中途点「编辑」只是把详情换成表单，旗子必须留着，否则会当场弹回日历
  assert.match(memo, /setForm\(\{ kind: "reminder", item: curReminder \}\); setDetail\(null\); \}/, "编辑那一步不许调 closeDetail");
});

test("日历上手填的日程角色也看得见", () => {
  assert.match(app, /const timedTitles = \(ownerKey\) =>/);
  assert.match(app, /Ta 让你能看到，可自然关心\/问起/);
  assert.match(app, /你自己今天的安排：/);
});

// 三层各存各的：AI 行程、手填带时刻的、无时刻的全天事件。合并只在显示层发生。
test("手填事件另起一个仓，不塞进 AI 排的 seqs 里", () => {
  assert.match(app, /saveJSON\("x_calEvents", next\)/);
  assert.match(app, /const \[calEvents, setCalEvents\] = useState\(\[\]\)/);
  assert.match(app, /calEventsRef\.current = calEvents;/, "ref 要跟着状态走，否则读到的是上一轮");
  assert.match(app, /setCalEvents\(loadJSON\("x_calEvents", \[\]\)\)/, "开机要读回来");
});

// 她 2026-08-26：「在日历建的日程，备忘录那边也要体现出来」
test("备忘录能看见日历里的日程，但不复制数据", () => {
  assert.match(app, /window\.calMyUpcoming = /);
  assert.match(memo, /window\.calMyUpcoming\(30\)/);
  assert.match(memo, /日历里的日程/);
  assert.ok(!/saveReminder\([^)]*calMyUpcoming/.test(memo), "不许把日程写成一条提醒——双写迟早会飘");
});

// 她 2026-08-26：「行程图标如果功能都合并了就没必要留了」
test("行程图标退场，入口改指日历", () => {
  assert.ok(!/lifestyle: \{ kind: "app"/.test(comp), "REG 里不该再有行程图标");
  assert.ok(!/"lifestyle"/.test(comp.slice(comp.indexOf("const DEFAULT_LAYOUT"), comp.indexOf("const DEFAULT_LAYOUT") + 900)), "默认布局里也不该有");
  assert.equal((app.match(/setScreen\("lifestyle"\)/g) || []).length, 0, "「看 TA 的日程」要跳日历");
  assert.match(app, /initialView: selSched \|\| undefined/, "从聊天进来要直接落在那个人身上");
});
