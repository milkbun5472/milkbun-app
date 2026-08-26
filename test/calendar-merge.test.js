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
