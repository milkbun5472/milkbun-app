// 朋友圈评论按发帖人认的面具署名（群友 2026-10-11：朋友圈回复只能按主面具的名字吗）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const cmp = fs.readFileSync(require.resolve("../js/components.js"), "utf8");
test("在TA的朋友圈下面用TA认的那张面具；自己发的仍是主面具；她的评论打 mine", () => {
  assert.match(app, /const momentMeName = mom => \{/);
  assert.match(app, /return \(a && \(profileFor\(a\.id\) \|\| \{\}\)\.name\) \|\| profile\.name \|\| "我";/);
  assert.equal((app.match(/const meName0 = momentMeName\(/g) || []).length, 3);
  assert.match(app, /author: meName0,\n\s*mine: true,/);
  assert.match(app, /c\.mine \|\| c\.author === meName0/);
  assert.match(cmp, /!cm\.mine && cm\.author !== me/);
});
