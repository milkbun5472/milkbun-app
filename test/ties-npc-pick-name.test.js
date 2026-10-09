// 她 2026-10-09 转群友：添加角色间关系时「配角也能连」那一组全显示问号——配角不在 characters 里
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const s = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
test("选人卡片也到配角表里找名字和头像", () => {
  assert.match(s, /characters\.find\(x => x\.id === id\) \|\| \(npcList \|\| \[\]\)\.find\(x => x\.id === id\)/);
});
