// 发公共版前把陪伴这只桌宠该有的分寸补上（她 2026-09-26 定的位置：
// 「这本来就是看看戳戳、挂一个桌宠给她们看着可以装饰」）。
// 装饰品的唯一失败方式是「开着很烦」：发烫、卡住、挡住输入框。所以这一批全是这个方向，
// 不给它加任何会把人往聊天上引的东西。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const pet = R("apps/companion/pet.mjs"), shell = R("js/companion.js"), app = R("js/app.js");

test("看不见就真的停：它是全 app 唯一常驻的 WebGL", () => {
  assert.match(pet, /document\.addEventListener\('visibilitychange'/);
  assert.match(pet, /if\(document\.hidden\)\{r\.setAnimationLoop\(null\);return;\}/, "切后台要真停，不是只跳过一帧");
  // 回到前台不许从半个动作里接着演
  assert.match(pet, /act=null;lastT=clock\.getElapsedTime\(\);nextAt=lastT\+1;lastDraw=-1;r\.setAnimationLoop\(frame\)/);
});

test("悬浮那只按 24 帧画（指甲盖大小，60 帧换不到一分钱好看）", () => {
  assert.match(pet, /const FRAME=mode==='float'\?1\/24:1\/40;/);
  assert.match(pet, /if\(t-lastDraw<FRAME\)return;/);
});

test("小人下不来要说人话、要能重试——不许永远挂在「来的路上」", () => {
  assert.match(pet, /catch\(err\)\{/, "原来是模块顶层的裸 await，失败就整个 iframe 卡死");
  assert.match(pet, /type:'pet-failed'/);
  assert.match(shell, /petState\.state === "failed"/);
  assert.match(shell, /再试一次/);
  assert.match(shell, /setRetry\(n => n \+ 1\)/, "重试要真的重挂 iframe");
  // 悬浮那只不弹话，直接不占地方
  assert.match(shell, /props\.hidden \|\| failed\) return null/);
});

test("5MB 的小人第一次要下：有进度，别让人猜是不是坏了", () => {
  assert.match(pet, /type:'pet-progress'/);
  assert.match(pet, /Math\.round\(e\.loaded\/e\.total\*100\)/);
  assert.match(shell, /小人在来的路上… " \+ \(petState\.pct \|\| 0\) \+ "%/);
});

test("打字的时候让开：挡住输入框的装饰品会被直接关掉", () => {
  assert.match(shell, /function useTyping\(\)/);
  assert.match(shell, /\^\(input\|textarea\)\$/, "输入框认得出来");
  assert.match(shell, /opacity: typing \? \.2 : 1, pointerEvents: typing \? "none" : "auto"/);
});

test("带 3D 的页里先收起来，别两套 three 同时跑", () => {
  assert.match(app, /const COMPANION_HIDE_SCREENS = new Set\(\["companion", "fairyGarden"\]\)/);
  assert.match(app, /hidden: COMPANION_HIDE_SCREENS\.has\(screen\)/);
  assert.ok(!/hidden: screen === "companion"/.test(app), "旧的单页判断要撤掉");
});

test("他此刻在做什么要说出来：十种心情各一套动作，不说没人看得出", () => {
  assert.match(pet, /type:'pet-act'/);
  assert.match(pet, /const now=sleeping\?'sleep':held\?'held':act\?act\.kind:'';/);
  assert.match(shell, /const ACT_ZH = \{/);
  assert.match(shell, /ACT_ZH\[actNow\] \? "他" \+ ACT_ZH\[actNow\] \+ "。" : ""/);
  // 动作名两头要对得上（桩照写入方写：名字是 pet.mjs 那头定的）
  const kinds = [...pet.matchAll(/case '([a-z]+)':/g)].map(m => m[1]);
  const zh = shell.slice(shell.indexOf("const ACT_ZH = {"), shell.indexOf("}", shell.indexOf("const ACT_ZH = {")));
  for (const k of new Set(kinds)) assert.ok(zh.includes(k + ":"), "动作「" + k + "」没有中文说法，界面上会漏掉这一种");
});
