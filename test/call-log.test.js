const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const eng = R("engine.js"), app = R("app.js"), scr = R("screens.js");

test("调用记录只在 callAI 这一个出口记：成功、重试成功、失败、她自己断的都记", () => {
  const i = eng.indexOf("async function callAI("), fn = eng.slice(i, eng.indexOf("async function callAIOnce(", i));
  assert.match(fn, /bgSay\(true\); logIt\(true\);/);
  assert.match(fn, /const again = await once\(\); bgSay\(true\); logIt\(true\); return again;/);
  assert.match(fn, /logIt\("cut", "她自己断掉了"\)/);
  assert.match(fn, /bgSay\(false, m2\); logIt\(/);
  assert.match(fn, /if \(typeof CallLog === "undefined"\) return;/, "单独抠出 callAI 跑的测试里没有 CallLog，不许炸");
  assert.match(fn, /turn: !!LOG_USE\[use\] && !o0\.logRetry/);
});

test("记录存自己的 IDB 小库，不进存档不上云", () => {
  assert.match(eng, /indexedDB\.open\("x_calllog", 1\)/);
  assert.ok(!/saveJSON\("x_callLog/.test(eng + app), "别塞进存档");
});

test("聊天、线下、群聊、群线下、通话都写清是谁在干嘛", () => {
  assert.match(app, /use: "chat", logWho: \(char && char\.name\) \|\| "",/);
  assert.match(app, /use: "chat", logRetry: true,/);
  assert.match(app, /use: "chat", logLabel: "群聊", logWho: \(group && group\.name\) \|\| "",/);
  assert.match(app, /use: "call", logWho: char\.name \|\| "",/);
  assert.match(eng, /use: "offline", logLabel: "群线下"/);
});

test("设置里那一页：今日请求与回合、清空走 app 自己的确认框", () => {
  const i = scr.indexOf("function CallLogCard("), card = scr.slice(i, scr.indexOf("function CacheStatCard(", i));
  assert.match(card, /"今日 " \+ today\.length \+ " 次请求 · " \+ today\.filter\(r => r\.turn\)\.length \+ " 个回合"/);
  assert.match(card, /requestAppConfirm\("清空调用记录？"/);
  assert.match(scr, /h\(CallLogCard, null\), h\(CacheStatCard, null\)/);
});

test("认不出用途时按调用栈认：先认函数名，再认文件；Chrome/Safari/Firefox 三种栈都认得", () => {
  const a = eng.indexOf("const CALL_FN_LABEL"), b = eng.indexOf("async function callAI(");
  const env = {};
  new Function("env", eng.slice(a, b).replace(/^const (CALL_\w+)/gm, "var $1") + "\nenv.f = callerLabelOf;")(env);
  const f = env.f;
  assert.equal(f("Error\n    at callAI (https://x/js/engine.js?v=1:1:1)\n    at runProbeInner (https://x/js/engine.js:2:2)\n    at genMoment (https://x/js/app.js?v=1:3:3)"), "朋友圈");
  assert.equal(f("Error\n    at callAI (https://x/js/engine.js:1:1)\n    at https://x/js/dream.js?v=1:5:2"), "梦境");
  assert.equal(f("callAI@https://x/js/engine.js:1:1\n@https://x/js/fanfic.js:2:2"), "同人文");
  assert.equal(f("callAI@https://x/js/engine.js:1:1\nApp/genShop<@https://x/js/app.js:2:2"), "购物");
  assert.equal(f("Error\n    at callAI (https://x/js/engine.js:1:1)\n    at whoKnows (https://x/js/app.js:3:3)"), "", "认不出就空着，外面落到「其他」");
});

test("runProbe 进门就把是谁叫的记下来，往下传给 callAI", () => {
  assert.match(eng, /async function runProbe\(p, ctx, probe\) \{\n  let _from = ""; try \{ _from = callerLabelOf\(new Error\(\)\.stack\); \}/);
  assert.equal((eng.match(/tag: _tag, logFrom: probe\.logFrom/g) || []).length, 3);
});

test("tag 当用途：中文照用，英文翻成中文，认不出的不摆英文", () => {
  const a = eng.indexOf("const CALL_TAG_LABEL"), b = eng.indexOf("const CALL_SKIP_FN");
  const env = {};
  new Function("env", eng.slice(a, b).replace(/^const /gm, "var ") + "\nenv.f = callTagLabel;")(env);
  assert.equal(env.f("番茄钟"), "番茄钟");
  assert.equal(env.f("live"), "直播");
  assert.equal(env.f("wh-c_12"), "悄悄话");
  assert.equal(env.f("zzz"), "");
});
