const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const engine = fs.readFileSync(require.resolve("../js/engine.js"), "utf8");
const components = fs.readFileSync(require.resolve("../js/components.js"), "utf8");

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

test("未结束单人线下重入时按真实时间接入期间全部线上私聊", () => {
  const mergeBlock = app.slice(app.indexOf("const _onlineInterlude"), app.indexOf("const res = await generateOffline", app.indexOf("const _onlineInterlude")));
  const singleSettings = components.slice(components.indexOf("function OfflineMode("), components.indexOf("function GroupOfflineMode("));
  assert.match(app, /const _onlineInterlude = settingsFor\(charId\)\.engineerEyes \? \[\] :/);
  assert.match(app, /\(m\.ts \|\| 0\) >= \(workSess\.startTs \|\| 0\)/);
  assert.match(app, /_windowMsgs\.concat\(_onlineInterlude/);
  assert.match(app, /sort\(\(a, b\) => \(a\.ts \|\| 0\) - \(b\.ts \|\| 0\)\)/);
  assert.match(app, /msgs: _timelineMsgs, hasOnlineInterlude:/);
  assert.doesNotMatch(mergeBlock, /_onlineCtxN|onlineCtxN/);
  assert.match(mergeBlock, /\.map\(m => \(\{[^;]+_surface: "online" \}\)\);/);
  assert.doesNotMatch(singleSettings, /sOnlineN|onlineCtxN|带入线上私聊条数/);
  assert.match(singleSettings, /本次线下开始后的线上私聊会自动全部按时间顺序并入，不另设条数/);
  assert.match(engine, /【线上私聊】/);
  assert.match(engine, /不能跳过今天的线上聊天、倒回去续演更早的线下剧情/);
});
