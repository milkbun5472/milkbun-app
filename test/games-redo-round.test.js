// 重说这一轮（她 2026-10-11）：卧底描述、狼人杀白天发言 AI 说砸了，投票前能让他们重说
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("node:fs").readFileSync(require.resolve("../js/games.js"), "utf8");

test("卧底：记下入账前多长，重说切回去再跑同一组参数；投票/新一轮/你补句后就不能重说", () => {
  assert.match(g, /setLog\(function \(L\) \{ redo\.logLen = L\.length; return L\.concat\(batch\); \}\);/);
  assert.match(g, /const redoDescribe = function \(\)/);
  assert.match(g, /aiDescribeWith\(r\.args\.plist, r\.args\.prior, r\.args\.rnd, r\.args\.waitUser\);/);
  assert.ok((g.match(/redoRef\.current = null;/g) || []).length >= 4);
});
test("狼人杀：立场纪要和声明台账一起切回，不然重说的人带着上一版的立场", () => {
  assert.match(g, /stance: JSON\.parse\(JSON\.stringify\(stanceRef\.current \|\| \{\}\)\), claims: \(claimsRef\.current \|\| \[\]\)\.slice\(\)/);
  assert.match(g, /stanceRef\.current = r\.stance; claimsRef\.current = r\.claims;/);
  assert.match(g, /aiSpeakSeq\.apply\(null, r\.args\);/);
  assert.ok((g.match(/wolfRedoRef\.current = null;/g) || []).length >= 4);
  assert.equal((g.match(/"data-wk": "gameredo"/g) || []).length, 2);
});
