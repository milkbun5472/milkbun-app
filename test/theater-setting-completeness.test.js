const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const theater = fs.readFileSync(path.join(__dirname, "..", "js/theater.js"), "utf8");

// 她 2026-08-18 报的「生成失败:设定生成不完整」。真凶不是模型不会写，是正文被 max_tokens
// 截断——JSON 尾部的键先死，而必填的 goal 恰好排在最后一个。
test("必填字段必须排在最长的 opening 之前，截断先砍掉的是可选内容", () => {
  const shapes = theater.match(/只输出 JSON:\{[^}]*\}/g) || [];
  assert.ok(shapes.length >= 3, "至少三处设定/开局的输出形状");
  shapes.forEach(shape => {
    const o = shape.indexOf('\\"opening\\"'), g = shape.indexOf('\\"goal\\"');
    if (o < 0 || g < 0) return;
    assert.ok(g < o, "goal 必须排在 opening 前面，否则一截断就先没了：" + shape.slice(0, 60));
  });
});

test("截断后拿已付费的半份去补缺键，不整局重来", () => {
  assert.match(theater, /const completeSetting = async \(partial, raw, need, hint\)/);
  assert.match(theater, /const lack = need\.filter\(k => !String\(\(partial && partial\[k\]\) \|\| ""\)\.trim\(\)\)/);
  assert.match(theater, /if \(!lack\.length\) return partial;/, "字段齐了就不该多花一次调用");
  // 补写失败必须静默退回原件，绝不能把一次生成失败升级成抛错
  assert.match(theater, /\} catch \(e\) \{ return partial; \}/);
  assert.match(theater, /if \(!fix\) return partial;/);
});

test("报错要说清缺了哪个字段，别只甩一句「不完整」", () => {
  const thrown = (theater.match(/throw new Error\("[^"]*"\)/g) || []).join("\n");
  assert.doesNotMatch(thrown, /设定生成不完整/);
  assert.doesNotMatch(thrown, /开局生成不完整/);
  assert.match(theater, /设定缺了「" \+ lack\.join\("、"\) \+ "」/);
  assert.match(theater, /开局缺了「本轮目标」/);
  assert.match(theater, /模型没吐出 JSON/, "彻底没 JSON 和缺字段是两种毛病，要分得开");
});

test("设定与开局的输出额度要够写完九个字段", () => {
  assert.match(theater, /maxTokens: 4800, timeout: 150000/, "if 线设定");
  assert.match(theater, /maxTokens: 4000, timeout: 150000/, "基线开局");
});
