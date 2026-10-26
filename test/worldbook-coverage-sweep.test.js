const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("世界书查漏补上的几处（2026-10-26）：外卖、购物、我的日程、世界日历、匿名信箱、我的衣柜、一起听广场", () => {
  assert.match(app, /id: "__takeout"[^\n]*worldbook: loreForContext\("lifestyle", \[\], topic\)/);
  assert.match(app, /id: "__shop"[^\n]*worldbook: loreForContext\("lifestyle", \[\], String\(cat/);
  assert.match(app, /id: "__me", name: mask\.name[^\n]*worldbook: loreForContext\("lifestyle", \[\], promptText\)/);
  assert.match(app, /id: "__cal", name: "世界"[^\n]*worldbook: loreForContext\("lifestyle", \[\], promptText\)/);
  assert.match(app, /const _anonWorld = window\.ShuaKit \? window\.ShuaKit\.worldLine\(loreForContext\("social", \[\], ""\)\) : "";/);
  assert.match(app, /const sys = _anonWorld \+ "你在给一个匿名树洞攒问题。/);
  assert.match(app, /window\.ShuaKit\.worldLine\(loreForContext\("lifestyle", \[\], kw\)\)[^\n]*给「" \+ uName \+ "」配 4 身衣服/);
  assert.match(app, /const sqAsk = async \(sys, tag\) => \{ const raw = await callAI\(active, sqWorld\(\) \+ sys,/);
  assert.match(app, /歌名、歌手照旧写现实里真有、网易云搜得到的歌/);
});
