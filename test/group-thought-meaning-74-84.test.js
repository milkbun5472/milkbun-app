// 她 2026-10-05：「群线上开了共处一室……心声还是这样，单聊有时候又是好的」——群那边还是旧的一长串禁令
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("群线上两支心声都只用 THOUGHT_MEANING，旧禁令清掉", () => {
  const i = app.indexOf("const _gThoughtIs = "), seg = app.slice(i, app.indexOf("const thoughtField", i));
  assert.ok(i > 0);
  assert.match(seg, /THOUGHT_MEANING/);
  assert.doesNotMatch(seg, /别重复、别原地打转、别套话/);
  assert.doesNotMatch(seg, /本轮真正有情绪波动/);
  assert.equal((seg.match(/_gThoughtIs/g) || []).length, 3, "两支没都用它");
});
