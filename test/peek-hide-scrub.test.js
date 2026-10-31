// 查手机：藏起来的人别处也拦，藏的选择记住、偷偷翻也认（群友 2026-10-31）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const R = f => fs.readFileSync(require.resolve("../js/" + f), "utf8");
const app = R("app.js"), cmp = R("components.js");
test("出口按藏起来的名字整行拦，钱包购物外卖不擦", () => {
  assert.match(app, /const KEEP_TRACE = \/\^【\(她的钱包流水\|购物 app\|外卖 app\)\//);
  assert.match(app, /if \(hidNames\.length && !KEEP_TRACE\.test\(b\)\) b = scrub\(b, hidTrace\);/);
});
test("藏了谁记进 x_peekHide；偷偷翻和下次递手机都照它", () => {
  assert.match(app, /saveJSON\("x_peekHide", Object\.assign\(\{\}, _h, \{ \[charId\]: \(hideIds \|\| \[\]\)\.map\(String\) \}\)\)/);
  assert.match(app, /handPhoneTo\(charId, PEEK_PHONE_SECTIONS\.map\(s => s\[0\]\), \(\(loadJSON\("x_peekHide", \{\}\) \|\| \{\}\)\[charId\] \|\| \[\]\), true\)/);
  assert.match(cmp, /useState\(\(\) => \{ try \{ return \(\(loadJSON\("x_peekHide", \{\}\) \|\| \{\}\)\[character && character\.id\]/);
});
