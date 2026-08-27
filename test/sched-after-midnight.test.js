const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => path.join(__dirname, "..", "js", f);
const app = fs.readFileSync(R("app.js"), "utf8");
const screens = fs.readFileSync(R("screens.js"), "utf8");
const Clock = require("../js/schedule-clock.js");

// screens.js 里那几个纯函数拿出来直接跑
const grab = name => {
  const i = screens.indexOf("function " + name);
  assert.ok(i >= 0, name + " 没了");
  return screens.slice(i, screens.indexOf("\n}\n", i) + 3);
};
const F = new Function("window",
  grab("pad2") + grab("schedFillEnds") + grab("schedSleepCarry") + grab("schedDisplaySeqs") +
  grab("schedTzShiftMin") + grab("schedCurrentSeqIdx") +
  "\nreturn { schedFillEnds, schedSleepCarry, schedDisplaySeqs, schedCurrentSeqIdx };")({ ScheduleClock: Clock });

const yesterday = { seqs: [
  { time: "08:00", title: "起床", type: "rest" },
  { time: "19:00", title: "回家做饭", type: "meal" },
  { time: "23:40", title: "洗漱、准备睡", type: "sleep", location: "家里卧室" }
] };
const today = { seqs: [
  { time: "07:30", title: "起床洗漱", type: "rest" },
  { time: "09:00", title: "去实验室", type: "work" }
] };

// 她 2026-08-27：「过了0点聊天界面的日程显示不出来了都显示还没开始今天的安排」
test("复现：凌晨 0:30 的时候，今天这份里一段都选不中", () => {
  const disp = F.schedDisplaySeqs({ tz: "" }, today.seqs);
  assert.equal(Clock.currentSeqIdx(disp, 30), -1, "今天第一项 07:30 还没到，本来就该是 -1");
  assert.equal(Clock.currentSeqIdx(disp, 8 * 60), 0, "过了 7:30 就该选中第一项");
});

test("昨晚那一觉睡到 24:00，凌晨这一截接得上", () => {
  const carry = F.schedSleepCarry(yesterday, today);
  assert.ok(carry, "昨天最后一段是睡觉、又睡到跨日，该接出这一截");
  assert.equal(carry.from, 0);
  assert.equal(carry.to, 7 * 60 + 30, "睡到今天第一项开始为止");
  assert.equal(carry.location, "家里卧室");
});

test("昨天最后一段不是睡觉就不许瞎接", () => {
  const awake = { seqs: [{ time: "20:00", title: "打游戏", type: "rest" }] };
  assert.equal(F.schedSleepCarry(awake, today), null);
  assert.equal(F.schedSleepCarry(null, today), null);
});

// ——接线：日历 v56.47 早就画出这一截了，状态这几处一直没跟上
const code = app.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("凌晨兜底只在【今天第一项还没到】的时候出手", () => {
  const i = code.indexOf("const schedCarryNowFor =");
  assert.ok(i > 0, "没有这个兜底");
  const seg = code.slice(i, i + 1400);
  assert.match(seg, /nowMin >= firstMin\) return null/, "今天已经开场了就该退出去，别盖住真正的当前段");
  assert.match(seg, /schedSleepCarry\(plans\[schedShiftDayKey\(todayKey, -1\)\], today\)/, "得去翻昨天那份");
  assert.match(seg, /title: "睡着"/, "标题要归一化——昨晚最后那段叫「洗漱、准备睡」，凌晨三点拿它当此刻在做什么是错的");
});

test("聊天顶栏、单聊行程块、群里那一行，三处都要接", () => {
  const hits = (code.match(/schedCarryNowFor\(char\)/g) || []).length;
  assert.equal(hits, 3, "现在只接了 " + hits + " 处");
  const i = code.indexOf('title: "还没开始今天的安排"');
  assert.ok(i > 0);
  const before = code.slice(Math.max(0, i - 400), i);
  assert.match(before, /schedCarryNowFor\(char\)/, "顶栏得先问兜底，问不到才说「还没开始」");
});

test("兜底和 charAwakeState 是同一个假设：今天第一项之前＝还没醒", () => {
  const i = code.indexOf("const charAwakeState =");
  const seg = code.slice(i, i + 1200);
  assert.match(seg, /nowMin < first\) return "asleep"/, "作息判断本来就这么判，兜底不能跟它打架");
});
