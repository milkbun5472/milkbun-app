// 把手机递给TA看（她 2026-10-01）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const a = src("app.js"), c = src("components.js");

test("能翻的几样是一张表，记账（现实的钱）不在里面", () => {
  const m = a.match(/const PEEK_PHONE_SECTIONS = (\[[\s\S]*?\]\]);/);
  assert.ok(m);
  const list = new Function("return " + m[1])();
  assert.deepStrictEqual(list.map(x => x[0]), ["chats", "forum", "money", "shop", "music", "memo", "journal", "pics"]);
  assert.ok(!list.some(x => /记账/.test(x[1])));
});

test("聊天加号里有「给TA看手机」，单子能把几样藏起来再递", () => {
  assert.match(c, /\["peekphone", "给TA看手机", "mobile"\]/);
  assert.match(c, /onHandPhone\(peekAllow\)/);
  assert.match(c, /mobile: \[R\(/);
  assert.match(a, /onHandPhone: allow => handPhoneTo\(activeChar\.id, allow\)/);
});

test("递过去：只摆她手机上真有的、藏了什么；主动开关和防连发闸都不拦", () => {
  assert.match(a, /const peekHint = opts\.peekPhone \?/);
  assert.match(a, /const dongnianHint = peekHint \+ \(/, "递手机那段喂进这一轮");
  assert.match(a, /if \(_peekTurn\) opts = \{ \.\.\.opts, proactive: false \};/);
  assert.match(a, /if \(_peekTurn\) opts = \{ \.\.\.opts, proactive: true \};/);
  assert.ok(a.indexOf("proactive: false };") < a.indexOf("!opts.phoneAs && history.length") && a.indexOf("!opts.phoneAs && history.length") < a.indexOf("if (_peekTurn) opts = { ...opts, proactive: true };"), "摘掉→过闸→挂回 的顺序");
});
