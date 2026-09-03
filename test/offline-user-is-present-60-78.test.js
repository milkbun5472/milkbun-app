// 她 2026-09-03：「为啥线下也还是把我说的话当成微信线上说的」。
// 病因：线下历史里线上插播那几条【标着】「【线上私聊】」，她自己线下说的话
// 【什么都不标】；一边有标签另一边没有，模型只能猜，再加上每行前挂着时刻，
// 看着就像一屏聊天记录。所以这条钉两样：说清楚 + 两边都标。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

test("有一段专门说清楚「她那几行是当面说的」", () => {
  const m = eng.match(/const OFFLINE_USER_IS_PRESENT = `[\s\S]*?`;/);
  assert.ok(m, "找不到 OFFLINE_USER_IS_PRESENT");
  const b = m[0];
  assert.match(b, /没有明确标着【线上私聊】/, "要说清楚判据是什么");
  assert.match(b, /不是微信、不是短信/);
  assert.match(b, /手机屏幕亮起/, "要点名禁掉最常写歪的那几种写法");
  assert.match(b, /只是记录这句话发生在几点/, "时刻不是聊天记录的时间条");
});

test("单人线下和群线下两处都发（同一份，不是各写一遍）", () => {
  const hits = eng.match(/OFFLINE_USER_IS_PRESENT\.replace\(\/USERNAME\/g, userName\)/g) || [];
  assert.equal(hits.length, 2, "单人线下 / 群线下，两处都要接上");
  // 必须是同一份常量，不许某一处自己抄一段
  assert.equal((eng.match(/const OFFLINE_USER_IS_PRESENT/g) || []).length, 1);
});

test("混进线上内容时，线下那几行也要标出来——只标一边等于没标", () => {
  const m = eng.match(/function offlineHistory\([\s\S]*?\n\}/);
  assert.ok(m, "找不到 offlineHistory");
  assert.match(m[0], /const mixed = \(msgs \|\| \[\]\)\.some\(m => m && m\._surface === "online"\)/);
  assert.match(m[0], /m\._surface === "online" \? "【线上私聊】" : \(mixed \? "【当面】" : ""\)/);
});
