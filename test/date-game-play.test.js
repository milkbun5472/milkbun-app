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
  assert.deepEqual(s.rating, { score: 8, heart: "其实挺想再来一次", title: "" });
});

// 她 2026-10-14：「后面全部做」——追加任务、指认、票根名字、按钟点开的地方、主题局
test("按钟点开的地方：早餐铺只在早上、夜市跨过半夜、开局抽到的都是这会儿开着的", () => {
  const P = n => C.PLACE_POOL.find(p => p.id === n);
  assert.equal(C.openAt(P("breakfast"), 8), true); assert.equal(C.openAt(P("breakfast"), 20), false);
  assert.equal(C.openAt(P("nightmarket"), 23), true); assert.equal(C.openAt(P("nightmarket"), 1), true); assert.equal(C.openAt(P("nightmarket"), 12), false);
  for (const hour of [3, 8, 13, 17, 21]) for (let i = 0; i < 30; i++) {
    const s = C.newGame(config, Math.random, { hour });
    s.places.forEach(id => assert.ok(C.openAt(P(id), hour), id + " 在 " + hour + " 点没开"));
  }
});

test("主题局：任务池多一张这个主题的，TA 也看得到是哪种约会", () => {
  let seen = false;
  for (let i = 0; i < 200 && !seen; i++) {
    const s = C.newGame({ ...config, dateTheme: "makeup" });
    assert.equal(s.theme, "makeup");
    if ([s.missions.user, s.missions.char].includes("softword")) seen = true;
    assert.ok(![s.missions.user, s.missions.char].includes("askme"), "别的主题的任务不该抽到");
  }
  assert.ok(seen, "和好局抽得到「先服软」");
  assert.equal(C.aiView(C.newGame({ ...config, dateTheme: "anniv" })).theme, "纪念日");
});

test("走完第二站各抽一张追加任务；指认 TA 在演的那句，指中 +1", () => {
  let s = fresh();
  s = C.nextStop(C.receiveReply(C.startRequest(C.resolveActivity(go(s, "cafe"), "cake"), "react", "", ""), { say: "嗯", scheme: true }));
  assert.equal(s.bonus, null);
  s = C.nextStop(C.resolveActivity(go(s, "shop"), "pair"));
  assert.ok(s.bonus && C.mission(s.bonus.user) && C.mission(s.bonus.char) && s.bonus.user !== s.bonus.char);
  assert.ok(C.needsJudge(s), "追加任务要裁判读聊天");
  s = C.closeDate(s);
  s = C.receiveReply(C.startRequest(s, "guess", "", ""), { guess: "unknown", say: "翻吧", rate: 7, heart: "", title: "雨天小店" });
  const idx = s.talk.findIndex(m => m.scheme);
  const done = C.finish(s, "unknown", { userBonus: { done: true, evidence: "那句" } }, idx);
  assert.equal(done.result.user.accuse.hit, true);
  assert.equal(done.result.user.bonus.done, true);
  assert.equal(done.result.user.score, 2, "追加 +1、指认 +1");
  assert.equal(done.rating.title, "雨天小店");
});

test("地点池里每一处都有自己的图标（票根和路线上不显示成一个点）", () => {
  const src = require("fs").readFileSync(__dirname + "/../js/date-game.js", "utf8");
  const icon = src.slice(src.indexOf("const ICON = {"), src.indexOf("};", src.indexOf("const ICON = {")));
  C.PLACE_POOL.forEach(p => assert.ok(icon.indexOf(p.id + ":") >= 0, p.id + " 没有图标"));
});
