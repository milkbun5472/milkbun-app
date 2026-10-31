// 查手机每一页都知道TA现在的钱（群友 2026-10-31：穷学生收了 200 万还在哭穷；有钱人破产也得看得出来）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const pick = name => { const i = src.indexOf("function " + name + "("); const j = src.indexOf("\n}\n", i); return src.slice(i, j + 2); };
const ctx = {}; vm.createContext(ctx);
vm.runInContext('const PHONE_MONEY_KEYS = ["shopping", "takeout"];\n' + pick("phoneMoneyNowBlock"), ctx);
const f = vm.runInContext("phoneMoneyNowBlock", ctx);
test("微信这类页带上现在的钱，暴富、透支都写得出来", () => {
  assert.match(f("wechat", { balance: 2000000, monthlyIncome: 800 }), /手头（可动用）约 2000000；每月进账约 800。人设写的是TA原本的底子/);
  assert.match(f("notes", { balance: -3000 }), /约 -3000（已经透支）/);
});
test("购物外卖钱包不重复带；没钱包数据不带", () => {
  assert.equal(f("shopping", { balance: 1 }), "");
  assert.equal(f("wallet", { balance: 1 }), "");
  assert.equal(f("wechat", null), "");
  assert.match(src, /\+ phoneMoneyBlock\(key, money\) \+ phoneMoneyNowBlock\(key, money\) \+/);
});
