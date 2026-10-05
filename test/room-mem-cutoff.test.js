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
