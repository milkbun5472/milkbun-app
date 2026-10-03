// 她 2026-10-03 转群友：「为啥有人的角色给她点了一次外卖会显示两次」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");

test("同一个人六小时内一模一样的外卖只记一单、只扣一次钱", () => {
  const i = app.indexOf("const postCharTakeout = (charId, raw) => {");
  const seg = app.slice(i, app.indexOf("\n  };", i));
  assert.match(seg, /const dup = \(ordersRef\.current \|\| \[\]\)\.concat\(loadJSON\("x_takeoutLog", \[\]\) \|\| \[\]\)\.find\(/, "吃过的那份也得查");
  assert.match(seg, /if \(!dup\) walletSpend\(/);
  assert.match(seg, /if \(!dup\) addOrder\(/);
});
