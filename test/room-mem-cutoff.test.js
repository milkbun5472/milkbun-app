const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
global.window = global;
require(path.join(__dirname, "..", "js", "chat-rooms.js"));
const K = global.ChatRooms;

// 她 2026-10-05：「比如我翻到三天前的然后不想要这三天的新记忆」
test("开了才截，截到起点那一句；没时间戳的老记忆放行", () => {
  const room = { id: "r1", main: false, memUntilAnchor: true, startFrom: { mode: "until", anchorTs: 1000 } };
  assert.equal(K.memCutoff(room), 1000);
  assert.equal(K.memCutoff({ ...room, memUntilAnchor: false }), 0);
  assert.equal(K.memCutoff({ ...room, startFrom: null }), 0);
  const lib = [{ text: "旧", ts: 900 }, { text: "新", ts: 1100 }, { text: "老存档" }];
  assert.deepEqual(K.memBefore(lib, 1000).map(e => e.text), ["旧", "老存档"]);
  assert.equal(K.memBefore(lib, 0).length, 3);
});

test("单聊房、线下房两条检索都过这道截", () => {
  assert.match(app, /memCutoff: window\.ChatRooms\.memCutoff \? window\.ChatRooms\.memCutoff\(room\) : 0/);
  assert.match(app, /window\.ChatRooms\.memBefore\(memLibRef\.current, ctxOpts\.memCutoff\)/);
  assert.match(app, /let oCtx = ctxFor\(char, sideRoom && window\.ChatRooms && window\.ChatRooms\.memCutoff/);
  assert.match(comp, /patch\(\{ memUntilAnchor: !draft\.memUntilAnchor \}\)/);
});

// 她 2026-10-05：「能不能做区分就是有一个只开到那一句之前的记忆库」
test("一起经历过的事关着、只开截断：只带截过的记忆库", () => {
  const base = { id: "r2", main: false, memUntilAnchor: true, startFrom: { mode: "until", anchorTs: 1000 } };
  assert.equal(K.memOnly({ ...base, cognition: { formalMemory: false } }), true);
  assert.equal(K.memOnly({ ...base, cognition: { formalMemory: true } }), false);
  assert.equal(K.memOnly({ ...base, memUntilAnchor: false, cognition: { formalMemory: false } }), false);
  assert.match(app, /window\.ChatRooms\.memOnly\(room\)\) gated\.memLib = Array\.isArray\(ctx\.memLib\)/);
  assert.match(app, /!window\.ChatRooms\.allows\(room, "formalMemory"\) && !\(window\.ChatRooms\.memOnly/);
  assert.match(comp, /const memCutRow = show => show \? h\("div",/);
});
