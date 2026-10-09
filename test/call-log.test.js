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
