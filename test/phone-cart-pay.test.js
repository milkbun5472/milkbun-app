// 查TA手机 → 购物 → 购物车里那件，能替TA付了送给TA（群友 2026-10-02）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const a = read("app.js"), p = read("phone.js");

test("购物车每件有「替TA付」，点两下才付；付了的那件不再出现", () => {
  assert.match(p, /const cart = A\(data\.cart\)\.filter\(it => !paidT\.includes\(String\(it\.title \|\| ""\)\)\);/);
  assert.match(p, /if \(st !== "ask"\) \{ setSt\("ask"\); return; \}/);
  assert.match(p, /"替TA付了，送给TA"/);
});

test("付款从她钱包扣、钱不够不付，付了变成一份寄给TA的礼物", () => {
  assert.match(a, /window\.__phoneCart = \{/);
  assert.match(a, /if \(total > wallet\) \{ toast\("钱包不够付这一件"\); return false; \}/);
  assert.match(a, /changeWallet\(-total, "替 "/);
  assert.match(a, /sendGiftToChar\(char\.id, title \+ "（" \+ why \+ "）", null\)/);
});

test("一直没下手的、反复看过的也能替TA付；礼物上分清是哪一种", () => {
  assert.match(p, /h\(CartPayBtn, \{ char, it, pay: PC\.pay, kind: "wish" \}\)/);
  assert.match(p, /h\(CartPayBtn, \{ char, it: v, pay: PC\.pay, kind: "viewed" \}\)/);
  assert.match(a, /wish: "她翻你手机时看到你一直想买、迟迟没下手的这件，替你买了"/);
  assert.match(a, /viewed: "她翻你手机时看到你反复点开看、一直没买的这件，替你买了"/);
});
