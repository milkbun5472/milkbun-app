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
  // forumKnows：按面具认人（v75.230）。这里测的是小号和匿名，桩照「同一张面具」那一档
  const asMe = new Function("forumKnows", "char", "return (" + asMeSrc.replace(/^const asMe = /, "").replace(/;\s*$/, "") + ")")(() => true, { id: "c1" });
  assert.equal(asMe({ authorType: "me" }), true);
  assert.equal(asMe({ authorType: "me", alt: true, authorName: "一只鱼" }), false, "小号楼不是她");
  assert.equal(asMe({ authorType: "me", authorName: "匿名者" }), false, "匿名楼不是她");
  assert.doesNotMatch(blk, /r\.authorType === "me" \? meName/, "楼中楼也不许直接按是不是她写的就报她的名字");
  assert.doesNotMatch(blk, /if \(f\.authorType === "me"\) myOn\.push/);
});

test("小号房（TA不该认出你）只能空白开始；那几样会带出你本人的开关开着时提醒", () => {
  const comp = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
  assert.match(comp, /const altHideStart = !!\(Kit && draft && Kit\.altHidesMe && Kit\.altHidesMe\(draft\)\);/);
  assert.match(comp, /Kit\.prepareStart\(character\.id, draft, sourceRoom, sourceRows, altHideStart \? "blank" : startMode, startIndex\)/);
  assert.match(comp, /disabled: mode !== "blank" && \(!startChoices\.length \|\| altHideStart\)/);
  assert.match(comp, /if \(altHideStart && startMode !== "blank"\) \{ setStartMode\("blank"\)/);
  assert.match(comp, /\["mainDelta", "主聊天后来发生的"\]/);
});
