// 她 2026-09-18：「做ai生成的日程可以删除吧，both individually for each 角色的日程
// 或者角色整周生成的，每个角色单独弄」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const bare = src => src.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");

// ⚠️桩照【写存档的那段】写，不是照删除那段编（施工规则/stub-from-the-writer.md）：
//   saveSchedDay 落的是 x_schedules[charId][dayKey] = { load, estTime, seqs, murmurs, generatedAt }。
test("桩钉在写入方身上：删的必须是 saveSchedDay 真正落下的那个形状", () => {
  assert.match(app, /const n = \{ \.\.\.p, \[charId\]: \{ \.\.\.cur, \[dayKey\]: plan \} \};/, "saveSchedDay 的落法变了");
  assert.match(app, /saveJSON\("x_schedules", n\);/);
});

// 把 delSchedDays 抠出来真跑一遍——光 grep「函数在」挡不住「它其实什么都没删」
const runDel = (book, charId, keys) => {
  const i = app.indexOf("  const delSchedDays = (charId, dayKeys) => {");
  assert.ok(i > 0, "delSchedDays 没了");
  const src = app.slice(i, app.indexOf("\n  };", i) + 5);
  const saved = [];
  const ctx = {
    schedulesRef: { current: book },
    setSchedules: fn => { ctx.__state = fn(book); },
    saveJSON: (k, v) => saved.push([k, v])
  };
  vm.createContext(ctx);
  vm.runInContext(src + "\nthis.__n = delSchedDays(" + JSON.stringify(charId) + ", " + JSON.stringify(keys) + ");", ctx);
  return { n: ctx.__n, next: ctx.__state, saved };
};

const plan = t => ({ load: "NORMAL", estTime: 12, seqs: [{ seq: 1, time: "08:00", title: t }], murmurs: [], generatedAt: 1 });
const book = () => ({
  c1: { "2026-09-16": plan("前天"), "2026-09-18": plan("今天"), "2026-09-19": plan("明天") },
  c2: { "2026-09-18": plan("别人的今天") }
});

test("单天删：只掉那一天，同一个人别的天和别人一天都不动", () => {
  const r = runDel(book(), "c1", "2026-09-18");
  assert.equal(r.n, 1);
  assert.deepEqual(Object.keys(r.next.c1).sort(), ["2026-09-16", "2026-09-19"]);
  assert.deepEqual(Object.keys(r.next.c2), ["2026-09-18"], "串到别的角色身上了");
  assert.equal(r.saved.length, 1);
  assert.equal(r.saved[0][0], "x_schedules", "落盘键写错了，重开就回来了");
});

test("整周删：一次给一串 dayKey，只删存在的那几天", () => {
  const r = runDel(book(), "c1", ["2026-09-18", "2026-09-19", "2026-09-20"]);
  assert.equal(r.n, 2, "只有两天真的存在，别把没有的也数进去");
  assert.deepEqual(Object.keys(r.next.c1), ["2026-09-16"], "过去那天不许被整周删带走");
});

test("一天都没命中就什么也不做——别白写一次盘、也别弹「删好了」", () => {
  const r = runDel(book(), "c1", ["2026-09-30"]);
  assert.equal(r.n, 0);
  assert.equal(r.saved.length, 0);
  assert.equal(r.next, undefined);
});

// ⚠️过滤有两种坏法，方向相反、都不抛异常（stub-from-the-writer.md §3）：
//   「全都能过」＝一删删掉整本；「一条都过不了」＝按了没反应。上面两条各钉一个方向。
test("删除口子只有一个：界面那头不许自己写第二份 setSchedules", () => {
  const b = bare(app);
  assert.equal((b.match(/saveJSON\("x_schedules"/g) || []).length, 3,
    "开机瘦身 + saveSchedDay + delSchedDays，第四处就是又开了一处要同步的地方");
  assert.equal((b.match(/const delSchedDays = /g) || []).length, 1);
});

test("整周那段跟「AI 排剩下这几天」写的是同一段日子", () => {
  // 生成那头：from=today、count=7-dowMon
  assert.match(app, /const ok = await genScheduleWeek\(c, \{ force: true, from: today, count: 7 - dowMon \}\);/);
  // 删那头：同一个算法，抠成 schedWeekKeysFrom 一处
  assert.match(app, /const schedWeekKeysFrom = char => \{[\s\S]*?length: 7 - dowMon[\s\S]*?\};/);
  assert.match(app, /schedWeekKeys: schedWeekKeysFrom,/, "没传给日历那一页");
});

test("两个入口都接上了，而且都先问一句再删", () => {
  assert.match(comp, /onGenWeek, schedWeekKeys, onDelSchedDay, onDelSchedWeek \}\)/, "Calendar 没收这三个参数");
  // 整周那颗在 FAB 里，按钮上要写清删几天
  assert.match(comp, /"🗑　删掉 AI 排的这 " \+ have \+ " 天"/);
  // 单天那颗在块详情里，只对 AI 排的块出现（手填的那种走原来的编辑/删除）
  assert.match(comp, /dayEv\.b\.ai && isCharView && h\("button"/);
  assert.match(comp, /!dayEv\.b\.ai && h\("div", \{ className: "flex gap-2"/, "手填那两颗被顶掉了");
  // 删东西一律走公共确认层，不许直接删（js/components.js 的 requestAppConfirm）
  assert.equal((comp.match(/requestAppConfirm\("删掉 /g) || []).length, 2, "两个入口都要先问一句");
});

test("有几天可删要真的数出来，不能永远亮着一颗按不动的按钮", () => {
  assert.match(comp, /const have = keys\.filter\(k => \(\(schedules \|\| \{\}\)\[curChar\.id\] \|\| \{\}\)\[k\]\)\.length;/);
  assert.match(comp, /disabled: !have,/);
});
