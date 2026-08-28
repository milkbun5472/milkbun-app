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

test("未结束单人线下按设置条数接入线上私聊并按真实时间合流", () => {
  const mergeBlock = app.slice(app.indexOf("const _onlineInterlude"), app.indexOf("const res = await generateOffline", app.indexOf("const _onlineInterlude")));
  const singleSettings = components.slice(components.indexOf("function OfflineMode("), components.indexOf("function GroupOfflineMode("));
  assert.match(app, /const _onlineCtxN = Math\.max/);
  assert.match(app, /settingsFor\(charId\)\.engineerEyes \|\| !_onlineCtxN/);
  assert.doesNotMatch(mergeBlock, /workSess\.startTs/);
  assert.match(app, /_windowMsgs\.concat\(_onlineInterlude/);
  assert.match(app, /sort\(\(a, b\) => \(a\.ts \|\| 0\) - \(b\.ts \|\| 0\)\)/);
  assert.match(app, /msgs: _timelineMsgs, hasOnlineInterlude:/);
  assert.match(mergeBlock, /_onlineCtxN|onlineCtxN/);
  assert.match(mergeBlock, /\.map\(m => \(\{[^;]+_surface: "online" \}\)\);/);
  assert.match(singleSettings, /sOnlineN|onlineCtxN|带入线上私聊条数/);
  assert.match(singleSettings, /开场前和线下进行中后来发的消息都会参与/);
  assert.match(engine, /【线上私聊】/);
  assert.match(engine, /不能跳过今天的线上聊天、倒回去续演更早的线下剧情/);
});

test("普通角色线上生成按 ctxN 合并当前线下逐条记录，言秋专线不动", () => {
  const recentChat = app.slice(app.indexOf("recentChat: (() =>"), app.indexOf("groupRecent:", app.indexOf("recentChat: (() =>")));
  // v57.07：两边【各自】先切再合流。以前是 concat 之后才切最近 ctxN 条，开着一场四十拍的
  // 线下时五十个名额几乎全被线下占走，实测线上只剩 195 字进得来。
  // v57.08：线上那一侧的取数改叫 onlineWindow——它在 ctxN 之外还要保住【短期窗覆盖天数】
  // 那根拉条圈定的最近几天（floorTs）。
  assert.match(recentChat, /const onlineWindow = floorTs/);
  // v57.13：线下那一侧先切成 offSlice（还要拿它算装不装得下、要不要摘录）
  assert.match(recentChat, /const offSlice = offline\.slice\(-OFF_BEATS\);/);
  assert.match(recentChat, /onlineWindow\.concat\(offSlice\)\.sort/);
  assert.match(recentChat, /: online\.slice\(-ctxN\);/, "地板关掉时仍按 ctxN 走");
  assert.match(recentChat, /Math\.max\(0, Number\(settingsFor\(char\.id\)\.ctxN/);
  assert.match(recentChat, /settingsFor\(char\.id\)\.engineerEyes/);
  assert.match(recentChat, /【线下场景】/);
});
