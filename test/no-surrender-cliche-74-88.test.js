// 她 2026-10-06：「骨头都软了/酥了 命都给你这种八股怎么禁啊」
//   照「二十分钟」那次的教训：给判据，不把原句写进提示词（写进去就是在教它说）
const test = require("node:test");
const assert = require("node:assert/strict");
const eng = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
const block = name => { const i = eng.indexOf("const " + name + " = `"); return eng.slice(i, eng.indexOf("`;", i)); };
test("身体投降／交出性命那一族并进已有的反模板，用判据认，不点原句", () => {
  const b = block("INTIMATE_CHAT_ANTI_CLICHE");
  assert.match(b, /【拿身体投降或交出性命来量心动】/);
  assert.match(b, /这句话里有没有她刚才做的那件具体的事/);
  assert.match(b, /禁的是模子，不是尺度/);
  for (const w of ["骨头", "酥", "命都给", "腿一软"]) {
    assert.ok(!b.includes(w), "线上反模板里写进了原句：" + w);
    assert.ok(!block("INTIMATE_ANTI_CLICHE_LEGACY_V1").includes(w), "线下反模板里写进了原句：" + w);
  }
});
