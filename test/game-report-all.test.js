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

test("战报也能发到群：她在的群、旁观群不算，落一张 gameshare 卡", () => {
  assert.match(g, /"data-wk": "gamereportgroup"/);
  assert.match(g, /host\.sendGameReportGroup\(g\.id, rep\)/);
  assert.match(a, /reportGroups: \(groups \|\| \[\]\)\.filter\(g => g && imInGroup\(g\)/);
  assert.match(a, /pushGroupRich\(gid, \{ role: "user", kind: "gameshare"/);
});

test("真心话大冒险的战报不分输赢", () => {
  assert.match(g, /key: "tod", zh: "真心话大冒险", ids: realCharIds\(players\), wins: \[\],\s*meWin: null,/);
});
