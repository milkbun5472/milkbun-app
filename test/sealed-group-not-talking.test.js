const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../js/interaction-clock.js");
// 她 2026-10-04：「111 没开记忆互通为什么会影响」——封闭群里开口，不该把私聊那头的想你清零
test("封闭群（没开记忆互通）里开口，不算她理过TA", () => {
  const g = { id: "g9", memberIds: ["c1"] };
  const data = { groups: [g], groupSettings: {}, groupChats: { g9: [{ role: "user", ts: 500 }] },
    groupOfflines: { g9: [{ startTs: 400, msgs: [{ role: "user", ts: 600 }] }] }, offlines: { c1: [] } };
  assert.equal(C.latestUserSharedTs("c1", data), 0);
  assert.equal(C.latestUserSharedWhere("c1", data).ts, 0);
  data.groupSettings = { g9: { memoryInterop: true } };
  assert.equal(C.latestUserSharedTs("c1", data), 600);
  assert.equal(C.latestUserSharedWhere("c1", data).kind, "groupOffline");
});
