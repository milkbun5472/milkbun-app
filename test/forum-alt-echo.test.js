// 论坛小号（群友 2026-10-08：「我都开小号了 char 还能认出我来」）：
// TA 平时聊天带的那段「论坛近况」里，她用小号／匿名写的楼不许报成她本人
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");

test("论坛近况：小号和匿名写的楼按陌生网名算，不算成她", () => {
  const blk = app.slice(app.indexOf("forumEcho: (() => {"), app.indexOf("// 她自己公开发的帖（只给公开的；匿名吧和小号一个字都不许漏）"));
  assert.ok(blk.length > 200);
  const asMeSrc = blk.match(/const asMe = x => [^\n]+/)[0];
  const asMe = new Function("return (" + asMeSrc.replace(/^const asMe = /, "").replace(/;\s*$/, "") + ")")();
  assert.equal(asMe({ authorType: "me" }), true);
  assert.equal(asMe({ authorType: "me", alt: true, authorName: "一只鱼" }), false, "小号楼不是她");
  assert.equal(asMe({ authorType: "me", authorName: "匿名者" }), false, "匿名楼不是她");
  assert.doesNotMatch(blk, /r\.authorType === "me" \? meName/, "楼中楼也不许直接按是不是她写的就报她的名字");
  assert.doesNotMatch(blk, /if \(f\.authorType === "me"\) myOn\.push/);
});
