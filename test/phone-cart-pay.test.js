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
  assert.match(a, /sendGiftToChar\(char\.id, title \+ "（她翻你手机时看到你购物车里一直没舍得付，替你付了）", null\)/);
});
