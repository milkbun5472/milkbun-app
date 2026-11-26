// 群友 2026-11-25：聊天设置里设了「朋友圈 24 小时里最多发几条」，点勾回来又是「不限」——页面交了 momMax，存的那份白名单漏了它
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("朋友圈上限存得下来", () => {
  assert.match(cs, /momMax: Number\(momMax\) > 0/);
  assert.match(ap, /momMax: Math\.max\(0, Math\.floor\(Number\(s\.momMax\) \|\| 0\)\)/);
});
