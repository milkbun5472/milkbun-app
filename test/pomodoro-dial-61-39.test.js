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
  // v61.40 起指针走的是「余数」那一段（超过一小时＝多拧一圈），所以这里是 wound
  assert.match(code, /const ang = \(wound \/ DIAL_MAX\) \* 360;/);
  // 拧过的那一段填成扇形——「上了多少发条」得看得见
  assert.match(code, /val > 0 \? h\("path", \{ d: arc, fill: t\.accent/);
  // 药丸那一排留着当快捷，但不是唯一入口
  assert.match(code, /onPick: v => setMin\(v\)/);
  // 眉标不许再写英文（v61.40 她立的那条）
  assert.match(code, /"这一轮只做"/);
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
  // 顶栏透明，让桌面透上来（mobile-ui-layout.md 那条）
  assert.match(code, /h\(Head, \{ zh: "番茄钟", onBack: props\.onBack, right: archiveRight, bg: "transparent" \}\)/);
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

// v61.40 她 2026-09-03：「那超过一个小时的咋办」＋「进去后的页面和结算的页面也很无聊」
test("超过一小时＝多拧一圈，不是把指针钉死在 60", () => {
  assert.match(code, /const laps = Math\.floor\(total \/ DIAL_MAX\);/);
  assert.match(code, /const val = total - laps \* DIAL_MAX;/);
  // 正好整点时发条是满的，指针不该弹回 12 点
  assert.match(code, /const wound = \(val === 0 && laps > 0\) \? DIAL_MAX : val;/);
  // 每满一圈，盘外面多一道细环
  assert.match(code, /lapRings\.push\(h\("circle"/);
  // 接着拧要往上加圈，不是从 0 重来
  assert.match(code, /onPick\(laps \* DIAL_MAX \+ m\);/);
  // 读数按「几小时几分」念
  assert.match(code, /const v = Number\(min\) \|\| 0, hh = Math\.floor\(v \/ 60\), mm = v % 60;/);
});

test("结算是整页的一张单子，不再是半窗", () => {
  // .claude/rules/no-half-sheet.md：默认不要半窗；原来那张就是从底下掀起来的
  assert.ok(code.indexOf('background: "rgba(20,18,15,0.58)"') < 0, "结算又变回半窗了");
  assert.match(code, /function ResultCard\(t, rec, char, onClose, tp\) \{[\s\S]{0,900}h\("div", \{ className: "h-full flex flex-col"/);
  assert.match(code, /const perf = pos =>/, "少了单据的齿孔边");
  // 齿孔翻面要用 scaleY(-1)：rotate(180deg) 绕中心转，齿口会转到卡片里侧
  assert.match(code, /pos === "top" \? \{ top: -4, transform: "scaleY\(-1\)" \}/);
  // 往期回看也整页替换，不能当兄弟节点挂在列表下面
  assert.match(code, /if \(view === "archive" && detail\) return ResultCard\(/);
});

test("专注页也摆着同一只钟，纸条也是贴着胶带的", () => {
  assert.match(code, /const leftMin = Math\.max\(0, Math\.ceil\(left \/ 60\)\);/);
  assert.match(code, /h\(Dial, \{ t: \{ bg2: "transparent"[\s\S]{0,140}min: leftMin, size: 288 \}\)/);
  assert.match(code, /transform: "rotate\(-\.8deg\)", animation: "fadeUp \.35s ease both"/);
});

test("标题里不留英文（她 2026-09-03 立的那条）", () => {
  // Head 那一层已经在 components.js 统一挡掉了，这儿钉的是源头也别再写
  assert.ok(code.indexOf('en: "FOCUS') < 0 && code.indexOf('"DESK CLEARED"') < 0
    && code.indexOf('"CLEAR THE DESK"') < 0 && code.indexOf('"ONE THING"') < 0
    && code.indexOf('"SEAT RESERVED"') < 0, "还留着英文标题/眉标");
});
