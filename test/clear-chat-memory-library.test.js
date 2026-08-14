const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const clearChat = app.match(/const clearChat = \(charId, wipeMem\) => \{[\s\S]*?\n  \};/)?.[0] || "";

test("clear chat and memory removes locked character memories but preserves other owners", () => {
  assert.match(clearChat, /setMemFor\(charId, ""\)/);
  assert.doesNotMatch(clearChat, /if \(e\.locked\) return e/);
  assert.match(clearChat, /const rest = e\.charIds\.filter\(id => id !== charId\)/);
  assert.match(clearChat, /return rest\.length \? \{ \.\.\.e, charIds: rest \} : null/);
  assert.match(clearChat, /saveMemLib\(next\)/);
});
