"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const C = require("../js/date-game-core.js");
const config = { charIds: ["test-char"], mode: "normal", injectChat: false, ccSeat: false, npcFill: false };
const fresh = () => C.newGame(config, () => .01);
const reply = (id, other) => Object.assign({ place: id, accept: true, pose: 2, row: 1, hint: "配合提示", say: "测试台词" }, other);
const plan = (s, id) => C.receiveReply(C.startRequest(s, "plan", "测试提议", id), reply(id));
const stop = (s, id, choice) => C.nextStop(C.resolveActivity(C.commitPlace(plan(s, id), id), choice));

test("任务各一张、不会重复；预算与四站上限从真实新局生成", () => {
  for (let i = 0; i < 100; i++) {
    const s = C.newGame(config); assert.notEqual(s.missions.user, s.missions.char);
    assert.equal(s.minutes, 180); assert.equal(s.money, 200); assert.deepEqual(s.visits, []);
  }
});
test("模型视角只给自己的任务与公共事件，原存档的私密字段不透传", () => {
  const s = fresh(); s.userGuess = "SECRET_USER_GUESS"; s.config.private = "SECRET_CONFIG"; s.privateDebug = "SECRET_DEBUG";
  const view = C.aiView(s);
  assert.equal(view.yourMission.id, s.missions.char);
  assert.equal(Object.hasOwn(view, "missions"), false); assert.equal(Object.hasOwn(view, "userGuess"), false);
  assert.doesNotMatch(JSON.stringify(view), /SECRET_/);
  view.places.forEach(p => assert.ok(C.legalPlaces(s).some(x => x.id === p.id)));
});
test("无效回复保留待办；不扣资源、不换任务、不伪造 TA 发言", () => {
  const s = C.startRequest(fresh(), "plan", "测试提议", "photo"), before = JSON.stringify(s);
  assert.throws(() => C.receiveReply(s, reply("does-not-exist")), /去不了/);
  assert.throws(() => C.receiveReply(s, reply("cafe")), /对不上/);
  assert.throws(() => C.receiveReply(s, reply("photo", { row: 6 })), /动作/);
  assert.equal(JSON.stringify(s), before);
  assert.throws(() => C.commitPlace(s, "photo"), /先听听/);
  const n = C.receiveReply(s, reply("photo")); assert.equal(n.pending, null); assert.equal(n.minutes, 180);
  assert.equal(n.talk.length, 2); assert.equal(s.talk.length, 1);
});
test("轮流做主：你商量两次后能拍板，TA 的站要接受提议", () => {
  let s = C.receiveReply(C.startRequest(fresh(), "plan", "", "cafe"), reply("book", { accept: false }));
  assert.throws(() => C.commitPlace(s, "cafe", true), /商量好/);
  s = C.receiveReply(C.startRequest(s, "plan", "", "cafe"), reply("book", { accept: false }));
  s = C.commitPlace(s, "cafe", true); assert.equal(s.money, 145); assert.equal(s.minutes, 140);
  s = C.nextStop(C.resolveActivity(s, "tea")); assert.equal(s.round, 2);
  s = C.receiveReply(C.startRequest(s, "plan", "", "photo"), reply("book", { accept: false }));
  s = C.receiveReply(C.startRequest(s, "plan", "", "photo"), reply("book", { accept: false }));
  assert.throws(() => C.commitPlace(s, "photo", true), /商量好/);
  assert.equal(C.commitPlace(s, "book").current, "book");
});
test("去一站只扣一次；重复提交和走重复路都挡住", () => {
  const s = C.commitPlace(plan(fresh(), "photo"), "photo");
  assert.equal(s.money, 155); assert.equal(s.minutes, 150);
  assert.throws(() => C.commitPlace(s, "photo"), /先听听/);
  const n = C.nextStop(C.resolveActivity(s, 2));
  assert.ok(!C.legalPlaces(n).some(p => p.id === "photo"));
  assert.throws(() => C.startRequest(n, "plan", "", "photo"), /去不了/);
});
test("合照只认动作匹配，失败重试花五分钟且最多一次", () => {
  let s = C.resolveActivity(C.commitPlace(plan(fresh(), "photo"), "photo"), 1);
  assert.equal(C.progress(s, "photo").done, false);
  s = C.retryActivity(s); assert.equal(s.minutes, 145); assert.equal(s.money, 155);
  s = C.resolveActivity(s, 2); assert.equal(C.progress(s, "photo").done, true);
  assert.throws(() => C.retryActivity(s), /不能重试/);
  assert.throws(() => C.resolveActivity(s, 2), /活动时间/);
});
test("抓钩合并 TA 前后排与你左右列，只有实际抓到才完成任务", () => {
  const s = C.commitPlace(plan(fresh(), "arcade"), "arcade");
  const miss = C.resolveActivity(s, 2), hit = C.resolveActivity(s, 0);
  assert.equal(C.progress(miss, "plush").done, false); assert.equal(C.progress(hit, "plush").done, true);
});
test("菜单、成对小物、晚一点散步与节省预算都按真实事件判，不吃模型报分", () => {
  let s = fresh(); s = stop(s, "cafe", "tea"); assert.equal(C.progress(s, "cake").done, false);
  s = stop(s, "book", "browse"); s = stop(s, "river", "walk");
  assert.equal(C.progress(s, "late").done, false, "抵达才 80 分钟，不算晚一点");
  assert.equal(C.progress(s, "save").done, true);
  let t = stop(stop(stop(fresh(), "photo", 2), "cafe", "cake"), "book", "browse");
  t = stop(t, "river", "walk"); assert.equal(t.phase, "guess");
  assert.equal(C.progress(t, "late").done, true); assert.equal(C.progress(t, "cake").done, true);
  const shop = stop(fresh(), "shop", "pair"); assert.equal(C.progress(shop, "pair").done, true);
});
test("资源不足的路线不会出现在合法提议里；走四站就收工", () => {
  let s = stop(stop(fresh(), "arcade", 0), "shop", "single");
  assert.equal(s.money, 60); assert.ok(C.legalPlaces(s).some(p => p.id === "cafe"));
  s = stop(s, "cafe", "meal"); assert.equal(s.money, 5);
  assert.ok(!C.legalPlaces(s).some(p => p.id === "photo"));
  s = stop(s, "book", "browse"); assert.equal(s.phase, "guess");
  assert.throws(() => C.startRequest(s, "plan", "", "river"), /这一步/);
});
test("先封 TA 猜测，再收用户猜测；分数、证据与翻牌存档能往返", () => {
  let s = C.closeDate(stop(fresh(), "photo", 2));
  assert.throws(() => C.finish(s, "unknown"), /等 TA/);
  s = C.receiveReply(C.startRequest(s, "guess", "", ""), { guess: s.missions.user, say: "封好了。" });
  assert.throws(() => C.startRequest(s, "guess", "", ""), /交好/);
  s = C.finish(s, s.missions.char); assert.equal(s.phase, "finished");
  assert.equal(s.result.user.score, 3); assert.equal(s.result.char.score, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  assert.throws(() => C.finish(s, "unknown"), /等 TA/);
});
test("实际组装的 system 人设全文、不带用户秘密；user 只有触发；写主线回调不下发", () => {
  const ctx = { React: { createElement() {} }, window: { DateGameCore: C }, module: { exports: {} } }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(require.resolve("../js/date-game.js"), "utf8"), ctx);
  const persona = "PERSONA_BEGIN" + "人设全文".repeat(2000) + "PERSONA_END", s = C.startRequest(fresh(), "plan", "TEST_PUBLIC_LINE", "photo");
  const sys = ctx.module.exports.buildPrompt({ rules: "SHARED_RULES", profile: { name: "用户" } }, { name: "测试", persona }, s);
  assert.ok(sys.includes(persona)); assert.match(sys, /SHARED_RULES/); assert.match(sys, /TEST_PUBLIC_LINE/);
  assert.ok(!sys.includes('"missions"')); assert.ok(!sys.includes('"userGuess"'));
  const games = fs.readFileSync(require.resolve("../js/games.js"), "utf8");
  const a = games.indexOf('if (session.game.key === "date")'), b = games.indexOf("const engineProps", a); assert.ok(a > 0 && b > a);
  const entry = games.slice(a, b); assert.doesNotMatch(entry, /keepGameMemory|sendGameReport|ccGameResult|pChat|moods:/);
  const ui = fs.readFileSync(require.resolve("../js/date-game.js"), "utf8"); assert.doesNotMatch(ui, /KeepMemBtn|localStorage|CCSeat/);
  assert.match(ui, /maxTokens: 65000/); assert.match(ui, /content: "轮到你了。"/); assert.match(ui, /paddingBottom: COMPOSER_PAD_BOTTOM/);
});
