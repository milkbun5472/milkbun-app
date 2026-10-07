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
