// 论坛里她自己的粉丝数（群友 2026-10-16）：能自己改，大号发帖会涨
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "../js/screens.js"), "utf8");
test("编辑资料里能填粉丝数", () => {
  assert.match(scr, /"data-wk": "forumfans"/);
  assert.match(scr, /followers: Math\.max\(0, parseInt\(emFans, 10\) \|\| 0\)/);
});
test("大号发帖涨一点粉，匿名吧和面具帖不算", () => {
  assert.match(app, /if \(!anonB && !maskB\) \{ const f0 = Math\.max\(0, Number\(forumMe\.followers\) \|\| 0\); editForumMe\(\{ followers:/);
});
