const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const components = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const clearChat = app.match(/const clearChat = \(charId, wipeMem\) => \{[\s\S]*?\n  \};/)?.[0] || "";

test("clear chat deletes direct offline sessions without summarizing or touching group offline", () => {
  assert.match(clearChat, /pChat\(charId, \(\) => \[\]\)/);
  assert.match(clearChat, /pOffline\(charId, \(\) => \[\]\)/);
  assert.match(clearChat, /offlineTsRef\.current = \{ \.\.\.offlineTsRef\.current, \[charId\]: 0 \}/);
  assert.doesNotMatch(clearChat, /summarizeOffline|pGOffline|groupOfflines/);
  assert.match(clearChat, /已清除线上与线下记录/);
  assert.match(components, /线上私聊与全部单人线下记录/);
  assert.match(components, /群线下是共享记录，不会从这里删除/);
  const version = app.match(/APP_VERSION = "v([^"]+)"/)?.[1];
  assert.match(index, new RegExp(`js/components\\.js\\?v=${version.replace(/\./g, "\\.")}`));
});

test("clear chat starts without the character's old realtime mood or state", () => {
  assert.match(clearChat, /setMoods\(p => \{ const n = \{ \.\.\.p \}; delete n\[charId\]; saveJSON\("x_moods", n\)/);
  assert.match(clearChat, /delete n\[charId\]; statesRef\.current = n; saveJSON\("x_states", n\)/);
  assert.match(clearChat, /delete n\[charId\]; stateHistRef\.current = n; saveJSON\("x_stateHist", n\)/);
});
