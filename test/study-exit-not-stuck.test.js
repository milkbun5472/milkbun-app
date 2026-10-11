// 群里 2026-10-11：结课题答对了、老师也说过了，系统还卡着不让过
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const s = fs.readFileSync(path.join(__dirname, "..", "js", "study.js"), "utf8");
test("结课题独立答对、只剩几个要点没练到：照样过，没练到的标进待复习", () => {
  assert.match(s, /if \(!gate\.passed && gate\.exitPassed && gate\.missing\.length\) \{\s*cp\.review_queue = Array\.from\(new Set\(\(cp\.review_queue \|\| \[\]\)\.concat\(gate\.missing\)\)\);\s*gate\.passed = true;/);
});
