// v61.39 她 2026-09-03：「番茄钟的页面还是无聊」。
// 原来那一页是「横线分节的表单：输入框 + 一排头像 + 四颗药丸 + 三个单选点」——
// 按她立的判据（换个 app 还成立吗），那套东西搬到任何一个 app 上都成立，就是写坏了。
// 番茄钟在现实里是【一个上发条的厨房定时器】，摆在一张桌子上。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const src = fs.readFileSync("js/pomodoro.js", "utf8");
const code = src.split("\n").map(l => l.split("//")[0]).join("\n");

test("时长是一个真的发条盘，不是四颗药丸", () => {
  assert.match(code, /function Dial\(\{ t, min, onPick, size \}\)/);
  // 60 分钟一圈：25 分要真的落在四分之一多一点，刻度才和真钟面对得上
  assert.match(code, /const DIAL_MAX = 60;/);
  assert.match(code, /const ang = \(val \/ DIAL_MAX\) \* 360;/);
  // 拧过的那一段填成扇形——「上了多少发条」得看得见
  assert.match(code, /val > 0 \? h\("path", \{ d: arc, fill: t\.accent/);
  // 药丸那一排留着当快捷，但不是唯一入口
  assert.match(code, /onPick: v => setMin\(v\)/);
});

test("拧盘用 getBoundingClientRect 换算，不用 offsetX", () => {
  // offsetX 在 SVG 子元素上给的是【那个子元素】的局部坐标，指针会跳
  assert.match(code, /const box = e\.currentTarget\.getBoundingClientRect\(\);/);
  assert.ok(code.indexOf("offsetX") < 0, "又用回 offsetX 了");
  // 触摸也要能拧
  assert.match(code, /e\.touches \? e\.touches\[0\]\.clientX : e\.clientX/);
  assert.match(code, /touchAction: "none"/);
});

test("这一页是一张桌子：木纹底 + 便签 + 座位 + 小卡", () => {
  assert.match(code, /const DESK = "linear-gradient\(163deg,#efe9dd/);
  assert.match(code, /boxShadow: "inset 0 0 60px rgba\(96,72,40,\.16\)"/, "少了那圈内阴影，就不像在一张桌上");
  // 任务写在便签上，不是写在一个输入框里
  assert.match(code, /background: "#fdf6d8"/);
  assert.match(code, /"ONE THING"/);
  // 顶栏透明，让桌面透上来（mobile-ui-layout.md 那条）
  assert.match(code, /h\(Head, \{ zh: "番茄钟", en: "FOCUS DESK", onBack: props\.onBack, right: archiveRight, bg: "transparent" \}\)/);
});

test("专注页的进度也是发条在往回松，不是一条 2px 横线", () => {
  assert.match(code, /strokeDashoffset: \(C \* progress\)\.toFixed\(2\)/);
  assert.ok(code.indexOf('height: 2, background: "rgba(255,255,255,0.25)"') < 0, "那条横线还在");
});

test("原来的逻辑一条没动（计时以墙上时间为准、切后台能接回来）", () => {
  assert.match(code, /window\.PomodoroLogic = \{ remainingSec, focusedSec, resumeSession, noteIndex \};/);
  assert.match(code, /x_pomodoro_active/);
  assert.match(code, /if \(remain <= 0 && !current\.pausedAt\) finishRef\.current\("done"\);/);
});
