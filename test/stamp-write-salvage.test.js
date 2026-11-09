// 写卡那份 JSON 截断或中间一张坏了：好的照收，坏的那张留空位、别让后面的错位（她 2026-11-05）
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
const i = src.indexOf("  const stampLooseJSON = ");
const body = src.slice(i, src.indexOf("\n  };", i) + 4);
const f = new Function(body + ";return stampLooseJSON;")();
test("截断：前面完整的照收", () => {
  const d = f('{"cards":[{"name":"一","narration":"甲","before":{"narration":"a"}},{"name":"二","narration":"乙"},{"name":"三","narration":"写到一半');
  assert.equal(d.cards[0].name, "一"); assert.equal(d.cards[1].name, "二"); assert.equal(d.cards[2], null);
});
test("中间一张坏了：留空位，后面的不错位", () => {
  const d = f('{"cards":[{"name":"一","narration":"甲"},{"name":"二","narration":坏},{"name":"三","narration":"丙"}]}');
  assert.equal(d.cards[0].name, "一"); assert.equal(d.cards[1], null); assert.equal(d.cards[2].name, "三");
});
