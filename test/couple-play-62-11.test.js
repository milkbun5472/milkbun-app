// 玩法三件（v62.11，她 2026-09-04 同意）——全长在已有机制上，不另起炉灶：
// ① 愿望「已计划」挑个日子 → 走 x_promises 约回链，到那天他主动来约；
// ② 纪念日当天 TODAY 卡露一个口子：让他写一条「走到今天」的感慨（还是 genTimelineMusing）；
// ③ 唱片正在转时，主页那条露正在放的那首和它 B 面的刻字（零调用，纯 UI）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

test("愿望挑日子走的是 x_promises 那条现成的链，不是新机制", () => {
  const i = app.indexOf("const planWish = ");
  assert.ok(i > 0, "没有 planWish");
  const fn = app.slice(i, app.indexOf("const wishPlanOf", i));
  assert.match(fn, /x\.wishId !== wish\.id/, "改日子没先把旧的那条换掉——会攒出两条约");
  assert.match(fn, /about: "你们想一起做的：/, "about 没说清这是哪件事");
  assert.match(fn, /saveJSON\("x_promises", n\)/, "没落到约回链的存储上");
  // 消费端只认 charId/dueTs/about——wishId 是认领用的，别让消费端多要求什么
  assert.match(app, /wishPlanOf = wishId => \(promisesRef\.current \|\| \[\]\)\.find/, "查不到某条愿望约在哪天");
  // UI：只有「已计划」的才给挑日子（想做/实现/搁着都轮不到）
  assert.match(screens, /w\.status !== "planned" \|\| !onPlan\) return null/, "不是已计划也能挑日子");
  assert.match(screens, /挑个日子 · 到那天他来约/, "界面上没有那个口子");
});

test("纪念日当天：TODAY 卡露仪式口子，感慨带上是哪个日子", () => {
  assert.match(screens, /bAnn && bAnn\.days === 0 \? h\("button", \{ onClick: \(\) => !tlGen && onGenTimeline\(partner, bAnn\.name\)/,
    "当天没有仪式口子（或没带日子名）");
  assert.match(app, /const genTimelineMusing = async \(char, occasion\) =>/, "感慨链没收 occasion");
  assert.match(app, /occasion \? "今天是你们的「"/, "带了日子却没进提示词");
  assert.match(app, /要落在你们之间某件具体的事上，不许写贺词/, "没给「怎么算写对了」的判据");
  // CoupleDays 里那颗刷新键仍是单参调用，occasion 不传＝平时行为不变
  assert.match(screens, /onClick: \(\) => onGen\(partner\), disabled: gen/, "平时那颗刷新键被改坏了");
});

test("唱片正在转时露正在放的那首和它的刻字；停着退回最近刻的", () => {
  assert.match(screens, /const dNow = dOn \? dSongs\.find\(s => s\.id === discNowId\) : null;/, "没找正在放的那首");
  assert.match(screens, /dNow \? "《" \+ dNow\.title \+ "》正在转" : "唱片正在转"/, "转着却不说放的是哪首");
  assert.match(screens, /dFace && dFace\.note \?/, "刻字没露出来");
});
