// 群里 2026-10-12：「真心话大冒险战报可以群发」
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const g = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8"), a = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
test("战报能全发：每人一份，不跳进聊天", () => {
  assert.match(g, /"data-wk": "gamereportall"/);
  assert.match(g, /todo\.forEach\(function \(id\) \{ host\.sendGameReport\(id, rep, true\); \}\);/);
  assert.match(a, /sendGameReport: \(charId, rep, noOpen\) =>/);
  assert.match(a, /if \(!noOpen\) openChatById\(charId\);/);
});
