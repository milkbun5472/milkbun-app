// 她 2026-10-10：「我不行了为什么大家都在 我看你到时候xxx 八股啊」——禁令里引的原话被全员照抄
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const grab = n => (eng.match(new RegExp("const " + n + " = `([\\s\\S]*?)`;")) || [])[1] || "";

test("发给模型的禁令里不再有「到时候……」「等下……」这种能照抄的原句", () => {
  const SEE = grab("SEE_THROUGH_BAN"), STOCK = grab("STOCK_REPLY_BAN");
  assert.ok(SEE && STOCK);
  [SEE, STOCK].forEach(b => {
    assert.doesNotMatch(b, /到时候/);
    assert.doesNotMatch(b, /别等下|等下……|半边身子/);
  });
  assert.match(SEE, /替她预言以后/);
  assert.match(STOCK, /骨架没换就还是模板/, "判据留着");
});
