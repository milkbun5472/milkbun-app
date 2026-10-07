const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const R = require("../js/chat-rooms.js");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

test("小号房间是一个预设，默认全关、不出门", () => {
  const p = R.PRESETS.altme;
  assert.ok(p && p.alt && p.alt.who === "me");
  assert.equal(p.cognition.formalMemory, false);
  assert.equal(p.writeback.sharedState, false);
  assert.equal(p.writeback.mainSummary, false);
});

test("认不认得出三档；没认出来才换掉「对方是谁」", () => {
  const room = k => R.normalize({ id: "r1", alt: { maskId: "m1", knows: k } }, "c1");
  assert.equal(room("bogus").alt.knows, "no");
  assert.ok(R.altHidesMe(room("no")));
  assert.ok(R.altHidesMe(room("hint")));
  assert.ok(!R.altHidesMe(room("knows")));
  assert.equal(R.altOf(R.normalize({ id: "r2" }, "c1")), null);
});

test("prompt 里：认出来那档才给真名，没认出来只给小号名", () => {
  const r = k => R.normalize({ id: "r1", name: "x", alt: { maskId: "m1", mask: { name: "小鱼" }, knows: k } }, "c1");
  const no = R.prompt(r("no"), [], { realName: "真名" });
  assert.match(no, /网名「小鱼」/);
  assert.doesNotMatch(no, /真名/);
  assert.match(R.prompt(r("knows"), [], { realName: "真名" }), /「真名」/);
});

test("闸那一处换掉「对方是谁」；没认出来不漏主面具", () => {
  const room = k => R.normalize({ id: "r1", alt: { mask: { name: "小鱼" }, knows: k } }, "c1");
  assert.equal(R.gateCtx({ profile: { name: "真名" }, char: {} }, room("no")).profile.name, "小鱼");
  assert.equal(R.gateCtx({ profile: { name: "真名" }, char: {} }, room("knows")).profile.name, "真名");
  assert.match(app, /window\.ChatRooms\.altCallName\(room\) : ""\) \|\| userName\(profile\)/);
  assert.match(app, /window\.ChatRooms\.altCallName\(room\) : ""\) \|\| profile\.name \|\| "我"/);
});

test("自己写的小号：只存在房里，闸照样换上；没写名字就是陌生网友", () => {
  const own = R.normalize({ id: "r1", alt: { maskId: "__own", mask: { name: "夜猫", persona: "大学生" }, knows: "no" } }, "c1");
  assert.equal(R.gateCtx({ profile: { name: "真名" }, char: {} }, own).profile.persona, "大学生");
  const blank = R.normalize({ id: "r1", alt: { maskId: "__own", mask: { name: "", persona: "x" }, knows: "no" } }, "c1");
  assert.equal(R.altName(blank), "陌生网友");
  const comp = require("fs").readFileSync(__dirname + "/../js/components.js", "utf8");
  assert.match(comp, /"＋ 自己写一个"/);
});

test("拆穿：只认开了开关、还没认出来的房；说破后翻成认出来了", () => {
  const store = {}; global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } };
  const mk = (unmask, knows) => R.normalize({ id: "r9", personId: "c1", alt: { mask: { name: "小鱼" }, knows, unmask } }, "c1");
  assert.equal(R.altUnmask(mk(false, "no")), null);
  assert.equal(R.altUnmask(mk(true, "knows")), null);
  const r2 = R.altUnmask(mk(true, "hint"));
  assert.equal(r2.alt.knows, "knows");
  assert.ok(r2.alt.unmaskedAt > 0);
  assert.match(R.prompt(mk(true, "no"), [], {}), /"unmasked":true/);
  assert.doesNotMatch(R.prompt(mk(false, "no"), [], {}), /unmasked/);
  assert.match(app, /parsed\.unmasked === true && room/);
  assert.match(app, /window\.ChatRooms\.addSummary\(\{ personId: charId, roomId: r2\.id/);
});

test("TA开小号：TA知道自己用小号；她不知道时界面只显示小号；她那边不换", () => {
  const mk = (who, youKnow) => R.normalize({ id: "r1", name: "x", alt: { who, youKnow, ta: { name: "夜行", persona: "话少" }, mask: { name: "小鱼" } } }, "c1");
  const ta = mk("ta", false);
  assert.match(R.prompt(ta, [], {}), /【你的小号】.*网名「夜行」/);
  assert.doesNotMatch(R.prompt(ta, [], {}), /【小号】对方/);
  assert.equal(R.altTaFace(ta).name, "夜行");
  assert.equal(R.altTaFace(mk("ta", true)), null);
  assert.ok(!R.altHidesMe(ta));
  assert.ok(!R.altShowsMe(ta));
  const both = mk("both", false);
  assert.match(R.prompt(both, [], {}), /【你的小号】/);
  assert.match(R.prompt(both, [], {}), /【小号】对方/);
  assert.ok(R.altHidesMe(both));
  assert.equal(R.altTaFace(mk("me", false)), null);
  assert.match(app, /window\.ChatRooms\.altTaFace\(rm\)/);
  assert.match(app, /onGenAlt: async \(\) =>/);
});
