"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const Clock = require("../js/interaction-clock.js");
const fs = require("node:fs");
const path = require("node:path");
const groups = [{ id: "g1", memberIds: ["a", "b"] }];
test("用户在群聊和群线下出现，刷新所有在场角色的共同互动时间", () => {
  const data = { groups, groupChats: { g1: [{ role: "user", ts: 100 }] }, groupOfflines: { g1: [{ startTs: 110, msgs: [{ role: "user", ts: 120 }] }] } };
  assert.equal(Clock.latestSharedTs("a", data), 120);
  assert.equal(Clock.latestSharedTs("b", data), 120);
});
test("别的成员自己说话不冒充 Lisa 在理当前角色", () => {
  const data = { groups, groupChats: { g1: [{ role: "assistant", senderId: "b", ts: 200 }] } };
  assert.equal(Clock.latestSharedTs("a", data), 0);
  assert.equal(Clock.latestSharedTs("b", data), 200);
  assert.equal(Clock.latestUserSharedTs("b", data), 0);
});
test("Lisa 在群聊或群线下开口会刷新成员的用户互动钟", () => {
  const data = { groups, groupChats: { g1: [{ role: "user", ts: 210 }] }, groupOfflines: { g1: [{ msgs: [{ role: "narration", ts: 220 }] }] } };
  assert.equal(Clock.latestUserSharedTs("a", data), 220);
  assert.equal(Clock.latestUserSharedTs("b", data), 220);
  assert.equal(Clock.latestUserSharedTs("z", data), 0);
});
test("单人线下也计入，非成员群完全隔离", () => {
  const data = { groups, offlines: { a: [{ msgs: [{ role: "user", ts: 300 }] }] }, groupChats: { g1: [{ role: "user", ts: 400 }] } };
  assert.equal(Clock.latestSharedTs("a", data), 400);
  assert.equal(Clock.latestSharedTs("z", data), 0);
});
test("正在共同群聊或八小时内未结束的群线下，会硬拦主动私聊", () => {
  assert.equal(Clock.isTogetherNow("a", { groups, activeGroupId: "g1" }, 1000), true);
  assert.equal(Clock.isTogetherNow("a", { groups, groupOfflines: { g1: [{ startTs: 500, endTs: null }] } }, 1000), true);
  assert.equal(Clock.isTogetherNow("a", { groups, groupOfflines: { g1: [{ startTs: 1, endTs: null }] } }, 9 * 60 * 60 * 1000), false);
  assert.equal(Clock.isTogetherNow("z", { groups, activeGroupId: "g1" }, 1000), false);
});
test("页面继续加载未改动的用户跨场景钟缓存指纹", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const clockVersion = html.match(/interaction-clock\.js\?v=([^"]+)/);
  assert.ok(clockVersion);
  assert.equal(clockVersion[1], "51.97", "未改文件不要跟随 App 发布号乱升指纹");
});
