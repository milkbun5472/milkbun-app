const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const engine = fs.readFileSync(require.resolve("../js/engine.js"), "utf8");

test("单人和群线下每轮继续喂逐条原文，并给每条加真实时间与长间隔", () => {
  const one = engine.slice(engine.indexOf("function offlineHistory"), engine.indexOf("async function generateOffline"));
  const group = engine.slice(engine.indexOf("function offlineGroupHistory"), engine.indexOf("function offlineGroupSpeaker"));
  assert.match(one, /fmtStampAI\(ts\)/);
  assert.match(one, /gapPhrase\(ts - prevTs\)/);
  assert.match(group, /fmtStampAI\(ts\)/);
  assert.match(group, /gapPhrase\(ts - prevTs\)/);
  assert.match(engine, /offlineHistory\(session\.msgs/);
  assert.match(engine, /offlineGroupHistory\(session\.msgs/);
});

test("结束回线上后摘要只负责显示，模型另拿有上限的真实逐条尾段", () => {
  assert.match(app, /offlineTranscriptForOnline/);
  assert.match(app, /used \+ n > 6000/);
  assert.match(app, /transcript: offlineTranscriptForOnline\(sess\.msgs, false/);
  assert.match(app, /transcript: offlineTranscriptForOnline\(sess\.msgs, true/);
  assert.match(app, /【线下实际逐条记录·以原话为准】/);
});

test("两种线下都沿用全局时间感知开关", () => {
  assert.match(app, /timeAware: prefs\.timeAware/);
  assert.match(engine, /【当前真实时间】/);
});
