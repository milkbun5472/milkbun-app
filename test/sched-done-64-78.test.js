// 她 2026-09-06（截图）：「日程没过的日期也都 cross out 了」。
// 中午 12:35 的屏幕上，9月7日 17:30、18:30、20:00、23:00 和 9月8日 07:15、08:00
// 那几段全是划掉的——等于告诉她他明天的事已经做完了。
//
// ⚠️病根：查手机日历那一处把行程的 done 写死成 true，注释里的假设是
//   「已经推演过的那几天」。可行程是【提前推演】的：中午十二点半，明天早上
//   七点那一段就已经在存档里了。已经生成 ≠ 已经发生。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const app = fs.readFileSync(path.resolve(__dirname, "..", "js/app.js"), "utf8");
const cut = (a, b) => { const i = app.indexOf(a), j = app.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return app.slice(i, j); };
const SEG = cut("// ④ x_schedules[charId]：已经推演过的那几天", "// 同一天同一件事只留一条");

test("行程的 done 不许再写死", () => {
  assert.ok(!/done: true, postponed: 0, note: S\(sq\.location\)/.test(SEG), "又写死成 true 了");
  assert.match(SEG, /done: _done,/);
});

// 把那一段真跑起来：桩照【写行程那一头】的字段名（stub-from-the-writer.md）——
// x_schedules[charId][dayKey] = { seqs: [{time, end, type, title, location}] }
test("过去划掉、今天看结束了没有、明天一律不划", () => {
  const sandbox = {
    items: [], S: x => String(x == null ? "" : x), DK: x => String(x),
    char: { id: "c1", name: "陆衍" },
    schedulesRef: { current: { c1: { "2026-09-06": { seqs: [{ time: "22:00", end: "23:00", title: "昨天做完的事" }] },
      "2026-09-07": { seqs: [
        { time: "08:00", end: "09:00", title: "早上那段" },
        { time: "12:00", end: "13:00", title: "正在做的那段" },
        { time: "17:30", end: "18:30", title: "下午那段" }] },
      "2026-09-08": { seqs: [{ time: "07:15", end: "08:00", title: "明天早上那段" }] } } } },
    schedLocalDayKey: () => "2026-09-07",
    charLocalMin: () => 12 * 60 + 35,          // 她截图那一刻：12:35
    schedFillEnds: seqs => seqs
  };
  vm.createContext(sandbox);
  vm.runInContext("(function(){" + SEG + "})();", sandbox);
  const by = t => sandbox.items.filter(x => x.title === t)[0];
  assert.equal(by("昨天做完的事").done, true, "过去的日子整天算做完");
  assert.equal(by("早上那段").done, true, "今天已经结束的那段");
  assert.equal(by("正在做的那段").done, false, "正在做的不算做完");
  assert.equal(by("下午那段").done, false, "还没到的不许划掉");
  assert.equal(by("明天早上那段").done, false, "明天的更不许划掉");
});

test("按【他自己那边的钟】算——他可能在另一个时区", () => {
  // ⚠️拿设备时间判会整体错开：温尼伯的角色跟她差十几个小时。
  assert.match(SEG, /schedLocalDayKey\(char\)/, "日期没按他那边的算");
  assert.match(SEG, /charLocalMin\(char\)/, "时刻没按他那边的算");
});

test("没有 end 的那种退回开始时刻，别当成永远没做完", () => {
  const sandbox = {
    items: [], S: x => String(x == null ? "" : x), DK: x => String(x),
    char: { id: "c1" },
    schedulesRef: { current: { c1: { "2026-09-07": { seqs: [
      { time: "08:00", title: "没写 end 的过去那段" },
      { time: "20:00", title: "没写 end 的未来那段" }] } } } },
    schedLocalDayKey: () => "2026-09-07",
    charLocalMin: () => 12 * 60 + 35,
    schedFillEnds: undefined   // 这个辅助函数不在时也要能跑
  };
  vm.createContext(sandbox);
  vm.runInContext("(function(){" + SEG + "})();", sandbox);
  const by = t => sandbox.items.filter(x => x.title === t)[0];
  assert.equal(by("没写 end 的过去那段").done, true);
  assert.equal(by("没写 end 的未来那段").done, false);
});

test("时刻整个读不出来的那种，宁可不划掉", () => {
  // 划错成「做完了」比划错成「还没做」更糟：前者是在骗她，后者只是没帮上忙。
  const sandbox = {
    items: [], S: x => String(x == null ? "" : x), DK: x => String(x),
    char: { id: "c1" },
    schedulesRef: { current: { c1: { "2026-09-07": { seqs: [{ time: "傍晚", title: "没有时刻的那段" }] } } } },
    schedLocalDayKey: () => "2026-09-07", charLocalMin: () => 23 * 60, schedFillEnds: seqs => seqs
  };
  vm.createContext(sandbox);
  vm.runInContext("(function(){" + SEG + "})();", sandbox);
  assert.equal(sandbox.items[0].done, false);
});
