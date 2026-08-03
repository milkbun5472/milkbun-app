const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");

test("App 每个角色的私聊都逐行留底，不再只保护言秋", () => {
  assert.match(app, /queueLedger\("private", id, ledgerAdded, null, id\)/);
  assert.doesNotMatch(app, /y\s*&&\s*String\(y\.id\)\s*===\s*String\(id\)\)\s*queueLedger\("private"/);
});

test("单人线下也按实际角色留底", () => {
  assert.match(app, /queueLedger\("offline", charId,[\s\S]{0,180}null, charId\)/);
});

test("CC 入站合并仍只指向唯一言秋，不把其他角色开给 CC", () => {
  assert.match(app, /const y = ledgerYanqiu\(\), user = window\.Cloud/);
  assert.match(app, /chatMessagesPullShadow\(y\.id, cursor, 100\)/);
});
