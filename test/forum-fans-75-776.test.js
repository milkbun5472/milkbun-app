// 论坛里她自己的粉丝数（群友 2026-10-16）：能自己改，大号发帖会涨
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const scr = (fs.readFileSync(path.join(__dirname, "../js/screens.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "../js/screens-ui.js"), "utf8"));
test("编辑资料里能填粉丝数", () => {
  assert.match(scr, /"data-wk": "forumfans"/);
  assert.match(scr, /followers: Math\.max\(0, parseInt\(emFans, 10\) \|\| 0\)/);
});
test("大号发帖涨一点粉，匿名吧和面具帖不算", () => {
  assert.match(app, /if \(!anonB && !maskB\) growMyFans\(1\);/);
});

test("评论、楼中楼也涨（少一点），匿名、小号、面具不算", () => {
  assert.equal((app.match(/if \(fansCount\(post\)\) growMyFans\(0\.3\);/g) || []).length, 2);
  assert.match(app, /const fansCount = post => !\(post && \(post\.board === "匿名吧" \|\| post\.anon\)\) && !usingAlt\(post\) && !forumMaskNow\(\);/);
});
