// 群里 2026-10-19：TA手机通讯录里「她」那一行的备注，变成了TA刚给自己改的那个（她手机里TA的备注）。
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
test("刷微信回来：userContact.remark 跟她给TA的备注一模一样就留回原来那个", () => {
  const i = app.indexOf("const herForTa = String(c0.remark");
  assert.ok(i > 0);
  const seg = app.slice(i, i + 700);
  assert.match(seg, /String\(d\.userContact\.remark \|\| ""\)\.trim\(\) === herForTa/);
  assert.match(seg, /remark: was && String\(was\)\.trim\(\) !== herForTa \? was/);
});
