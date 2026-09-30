const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const core = fs.readFileSync(__dirname + "/../js/core.js", "utf8");
const watch = fs.readFileSync(__dirname + "/../js/watch.js", "utf8");
test("一起看删片子先撕票再删文件；文本库连接只开一次", () => {
  const i = watch.indexOf("const del = f => requestAppConfirm");
  const seg = watch.slice(i, watch.indexOf('"删掉");', i));
  assert.ok(seg.indexOf("setFilms(loadFilms())") < seg.indexOf("_store.del(f.id)"));
  assert.ok(!/await _store\.del/.test(seg));
  const mk = core.slice(core.indexOf("function makeTextStore"), core.indexOf("function companionHead"));
  assert.ok(mk.includes("dbp || (dbp = new Promise"));
});
test("言秋真身票交回来的各种形状都认：{say}、JSON 文本、包一层 result", () => {
  const i = watch.indexOf("const got = (function pick(v, depth)");
  assert.ok(i > 0);
  const src = watch.slice(watch.indexOf("function parseSay"), watch.indexOf("// ---- 模型：TA坐在旁边一起看"));
  const body = watch.slice(i, watch.indexOf("})(r, 0);", i) + 9).replace("const got = ", "return ");
  const run = r => new Function("r", src + body)(r);
  assert.deepStrictEqual(run({ say: ["好看"] }), ["好看"]);
  assert.deepStrictEqual(run('{"say":["嗯","接着看"]}'), ["嗯", "接着看"]);
  assert.deepStrictEqual(run({ result: { say: "这段不错" } }), ["这段不错"]);
  assert.deepStrictEqual(run({ say: [] }), []);
});
