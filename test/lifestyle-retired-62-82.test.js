// 她 2026-09-05：「不用行程了宝宝删了吧，有日历够了」。
//
// 行程那一屏（Lifestyle / LifeDay，四页）整块删掉。它本来就已经【进不去】了：
// screen === "lifestyle" 全库没有任何地方 set，入口早在行程被日历的当天视图接手时
// 就退场了，组件和路由被留在原地当了很久的第二份真相。
//
// ⚠️只删【浏览这一层】。行程的数据和算法还在被日历、状态卡、聊天上下文用着，
//   一个都不许跟着走——这份测试的一半就是钉这件事。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = f => fs.readFileSync(path.join(root, f), "utf8");
const scr = R("js/screens.js"), app = R("js/app.js"), asst = R("js/assistant.js");
const noComment = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("那一屏删干净了：组件、路由、跟着零引用的两个helper，一个都不剩", () => {
  const s = noComment(scr), a = noComment(app), t2 = noComment(asst);
  ["function Lifestyle(", "function LifeDay(", "function plannerSkin(", "function PlannerRings(",
   "PLANNER_RULE", "function schedWeek(", "function schedActIcon("].forEach(k =>
    assert.ok(s.indexOf(k) < 0, "screens.js 里还留着 " + k));
  assert.doesNotMatch(a, /screen === "lifestyle"/, "app.js 里那条路由还在");
  assert.doesNotMatch(a, /h\(Lifestyle,/, "app.js 里还在挂那个组件");
  // 秋秋那份「她此刻在哪一页」的名单也跟着撤：pg.screen 再也不会是 lifestyle
  assert.doesNotMatch(t2, /lifestyle: \["生活方式"/, "秋秋的页面名单里还留着一页不存在的屏");
});

test("只删浏览这一层：数据和算法一个都没跟着走", () => {
  // 这几样日历、状态卡、聊天上下文都还在用；删过头会让日历当场少一块
  ["function schedDateParts(", "function schedFillEnds(", "function schedSleepCarry(",
   "function schedDisplaySeqs(", "function schedCurrentSeqIdx(", "const SCHED_DOW_ZH ="].forEach(k =>
    assert.ok(scr.indexOf(k) >= 0, "screens.js 里少了 " + k + "——那是日历还在用的"));
  assert.match(app, /const genScheduleDay = /, "行程的生成没了");
  assert.match(app, /x_schedules/, "行程的存档键没了");
  // selSched 还留着：日历用它决定进去先看谁（initialView）
  assert.match(app, /const \[selSched, setSelSched\] = useState\(null\)/);
  assert.match(app, /initialView: selSched \|\| undefined/, "从聊天点「看 TA 的日程」进日历那条线断了");
  assert.equal((app.match(/setSelSched\(activeChar\.id\); setScreen\("calendar"\)/g) || []).length, 1);
  // 世界书那一档叫 lifestyle（生活功能），跟这一屏是两回事，不许被顺手删掉
  assert.match(scr, /lifestyle: "生"/);
  assert.match(app, /loreFor\(char, "lifestyle"\)/);
});

test("schedFillEnds 上面那三行说明还在——按行号切的时候最容易被顺手带走", () => {
  // ⚠️v62.82 第一刀就把它们切掉了：删 schedWeek 是按行号切的，紧跟其后的注释一起没了。
  //   「按【下一个顶层声明】收口，别按行数」——这个仓库在 v59.23 已经记过一次同样的教训。
  assert.match(scr, /\/\/ 结束时刻（v56\.30）。seqs 原来只有开始时刻/);
  assert.match(scr, /\/\/ 跨午夜（23:40 → 次日 00:30）按同一天的 24:00 收口/);
});
