// 论坛私信写给网友看时两边标清是谁（她 2026-10-16：加微信的简介把她的话安到了对方头上）
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
test("私信记录：她那边是「对方「网名」」，网友那边是「你「网名」」；不再用一个「我」", () => {
  assert.match(app, /m\.from === "me" \? "对方「" \+ her \+ "」" : "你「" \+ th\.npcName \+ "」"/);
  assert.ok(!/m\.from === "me" \? "我" : th\.npcName/.test(app));
  assert.equal((app.match(/const convo = pmConvo\(th, /g) || []).length, 2);
});
test("加微信写简介：写的是网友自己；她的事不许安到他头上；谁先私信照记录", () => {
  assert.match(app, /记录里「对方」说的她自己的事（她是什么样的人、她的习惯）是她的，不许写成你的/);
  assert.match(app, /const firstBy = \(asked\[0\] \|\| \{\}\)\.from === "me" \? "对方先私信的你" : "是你先私信的对方";/);
});
