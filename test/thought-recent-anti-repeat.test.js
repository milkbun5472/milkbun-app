// 她 2026-10-02：心声历史十几条同一个调侃骨架。单聊从没给模型看过以前的心声。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.resolve(__dirname, "..", "js/app.js"), "utf8");

test("单聊心声这一格看得见最近几条", () => {
  const i = app.indexOf("const _recentThoughts");
  assert.ok(i > 0, "_recentThoughts 没了");
  const seg = app.slice(i, app.indexOf("const _biTurnLine", i));
  assert.match(seg, /stateHistRef\.current/, "要从心声历史取");
  assert.match(seg, /_recentThoughts\.map/, "要摆进提示词");
  assert.match(seg, /sideRoom \? \[\]/, "侧房不读主房心声");
});
