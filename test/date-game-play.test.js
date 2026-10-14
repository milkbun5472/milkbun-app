// 她 2026-10-14：「先做 1 2 3」——TA 也出题、心情条、路上小意外变成选择
"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const C = require("../js/date-game-core.js");
const config = { charIds: ["c"], mode: "normal" };
const fresh = () => C.newGame(config, () => .01, { places: ["cafe", "photo", "arcade", "shop", "river", "book"], events: false });
const reply = (id, o) => Object.assign({ place: id, accept: true, pose: 2, row: 1, hint: "", say: "好" }, o);
const go = (s, id) => C.commitPlace(C.receiveReply(C.startRequest(s, "plan", "", id), reply(id)), id);

test("心情从 60 起，到站的反应能涨能跌，夹在 0~100、每次最多 ±10", () => {
  let s = fresh(); assert.equal(C.moodOf(s), 60);
  s = C.resolveActivity(go(s, "cafe"), "cake");
  s = C.receiveReply(C.startRequest(s, "react", "", ""), { say: "好吃", mood: 25 });
  assert.equal(C.moodOf(s), 70, "一次最多 +10");
  s = C.receiveReply(C.startRequest(s, "chat", "嗯", ""), { say: "哈", mood: -9 });
  assert.equal(C.moodOf(s), 67, "路上聊天只动 ±3");
});

test("有两条路的小意外：不挑不让做这一站；挑了才结算时间、钱和心情，写进小票", () => {
  let s = go(fresh(), "cafe");
  s.incident = { id: "rain", text: "突然下起雨", minutes: 0, money: 0, choices: [{ id: "umbrella", label: "买伞" }, { id: "eaves", label: "躲雨" }], picked: null };
  assert.throws(() => C.resolveActivity(s, "cake"), /路上那件事/);
  const m0 = s.minutes, $0 = s.money;
  s = C.chooseIncident(s, "umbrella");
  assert.equal(s.minutes, m0 - 5); assert.equal(s.money, $0 - 15); assert.equal(C.moodOf(s), 64);
  assert.throws(() => C.chooseIncident(s, "eaves"), /不用选/);
  s = C.resolveActivity(s, "cake");
  assert.match(s.events[0].text, /突然下起雨，一起冲进便利店买一把伞/);
});

test("TA 出题只在第 2、3 站；三句猜一句假的由代码判，答对多 10 分钟、心情 +5；没答完不让走", () => {
  let s = C.nextStop(C.receiveReply(C.startRequest(C.resolveActivity(go(fresh(), "cafe"), "cake"), "react", "", ""), { say: "x", challenge: { kind: "dare", text: "逗我笑" } }));
  assert.equal(s.challenge, null, "第一站不出题");
  s = C.resolveActivity(go(s, "shop"), "pair");
  s = C.receiveReply(C.startRequest(s, "react", "", ""), { say: "考考你", challenge: { kind: "lie", lines: ["我怕猫", "我会弹琴", "我没坐过飞机"], fake: 2 } });
  assert.equal(s.challenge.kind, "lie");
  assert.throws(() => C.nextStop(s), /还没答/);
  const m0 = s.minutes;
  const ok = C.answerLie(s, 2); assert.equal(ok.challenge.pass, true); assert.equal(ok.minutes, m0 + 10); assert.equal(C.moodOf(ok), 65);
  const no = C.answerLie(s, 0); assert.equal(no.challenge.pass, false); assert.equal(no.minutes, m0);
  C.nextStop(ok);
});

test("开放的小要求：她回一句，TA 判过没过；格式不全的题当没出，不作废这一句", () => {
  let s = C.nextStop(C.receiveReply(C.startRequest(C.resolveActivity(go(fresh(), "cafe"), "cake"), "react", "", ""), { say: "x" }));
  s = C.resolveActivity(go(s, "shop"), "pair");
  const bad = C.receiveReply(C.startRequest(s, "react", "", ""), { say: "嗯", challenge: { kind: "lie", lines: ["只有一句"] } });
  assert.equal(bad.challenge || null, null);
  s = C.receiveReply(C.startRequest(s, "react", "", ""), { say: "来", challenge: { kind: "dare", text: "用一句话夸我" } });
  s = C.receiveReply(C.startRequest(s, "dare", "你今天特别好看", ""), { pass: true, say: "算你会说话" });
  assert.equal(s.challenge.pass, true);
  assert.throws(() => C.startRequest(s, "dare", "再来", ""), /不是这一步/);
});

test("收工时 TA 给今天打分、留一句心里话", () => {
  let s = C.closeDate(C.resolveActivity(go(fresh(), "cafe"), "cake"));
  s = C.receiveReply(C.startRequest(s, "guess", "", ""), { guess: "unknown", say: "翻吧", rate: 8, heart: "其实挺想再来一次" });
  assert.deepEqual(s.rating, { score: 8, heart: "其实挺想再来一次" });
});
