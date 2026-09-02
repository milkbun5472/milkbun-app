const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("boot hydrates every saved room instead of only each character's main chat", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(source, /ChatRooms\.hydrateChats\(c, loadJSON\)/);
});
