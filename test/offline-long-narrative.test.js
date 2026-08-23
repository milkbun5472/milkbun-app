const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

// 她 2026-08-22：「线下模式的拉条最大 token 和最低字数都放宽一点，
// 然后如果开了允许他们描述我的行动就可以一直生成很多拍，变成有点像酒馆那样的长叙述风格」。

test("四条拉条都放宽了，单人与群线下各两条", () => {
  const sliders = [...comp.matchAll(/h\(Slider, \{ value: (sMax|sMinW), min: (\d+), max: (\d+)/g)]
    .map(m => ({ k: m[1], min: +m[2], max: +m[3] }));
  const maxes = sliders.filter(x => x.k === "sMax").map(x => x.max);
  const mins = sliders.filter(x => x.k === "sMinW").map(x => x.max);
  assert.equal(maxes.length, 2, "单人线下 + 群线下各一条输出上限");
  assert.equal(mins.length, 2);
  maxes.forEach(m => assert.ok(m >= 24000, "输出上限还是太窄：" + m));
  mins.forEach(m => assert.ok(m >= 3000, "最低字数还是太窄：" + m));
  // 群线下要写好几个人的戏，上限不该比单聊低
  assert.ok(Math.max(...maxes) >= 32000);
});

test("步长跟着放大，别让她从 400 拖到两万", () => {
  const steps = [...comp.matchAll(/h\(Slider, \{ value: (sMax|sMinW), min: \d+, max: \d+, step: (\d+)/g)]
    .map(m => ({ k: m[1], step: +m[2] }));
  steps.filter(x => x.k === "sMax").forEach(x => assert.ok(x.step >= 400, "token 步长太小：" + x.step));
  steps.filter(x => x.k === "sMinW").forEach(x => assert.ok(x.step >= 100, "字数步长太小：" + x.step));
});

// 长叙述只挂在【已授权替她写动作】那一支上——没授权时替她连推几拍就是越权
const grantOn = (() => {
  const i = engine.indexOf("〔本场叙事权限·已开启〕");
  return engine.slice(i, engine.indexOf('"', i));
})();
const grantOff = (() => {
  const i = engine.indexOf("〔本场叙事权限·未开启〕");
  return engine.slice(i, engine.indexOf('"', i));
})();

test("开了授权才给长叙述：可以连推几拍、让时间往前走", () => {
  assert.match(grantOn, /【既然授权了，就把这一段演开】不必写完一个来回就停下等她/);
  assert.match(grantOn, /把这一场连着推几拍，写成一段完整往前走的叙事，而不是一问一答的小片段/);
  assert.match(grantOn, /甚至过了一会儿/, "时间要能往前走，不然还是原地一拍");
});

test("刹车必须在：走到她本人要做选择的岔口就停", () => {
  assert.match(grantOn, /【但必须停的时候要停】走到【真正需要她本人做选择】的岔口就收住/);
  assert.match(grantOn, /去不去、答不答应、要不要说出那句话，这些是她的，不许替她决定/);
  assert.match(grantOn, /也别为了写长而硬拖/, "放开篇幅最容易变成注水，得当场堵住");
  // 原有的边界一条都不能丢
  assert.match(grantOn, /不替 Ta 宣布重大决定、长期承诺或内心真实想法/);
});

test("没授权时一个字都不许变——那条支线仍然只写自己", () => {
  assert.match(grantOff, /只描写你自己的言行和心理，不要替用户决定动作、反应或台词/);
  assert.ok(!/连着推几拍/.test(grantOff), "长叙述不许漏到未授权的那一支");
});
