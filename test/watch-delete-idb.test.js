const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const core = fs.readFileSync(__dirname + "/../js/core.js", "utf8");
const watch = (fs.readFileSync(__dirname + "/../js/watch-core.js", "utf8") + "\n" + fs.readFileSync(__dirname + "/../js/watch.js", "utf8"));
test("一起看删片子先撕票再删文件；文本库连接只开一次", () => {
  const i = watch.indexOf("const del = f => requestAppConfirm");
  const seg = watch.slice(i, watch.indexOf('"删掉");', i));
  assert.ok(seg.indexOf("setFilms(loadFilms())") < seg.indexOf("_store.del(f.id)"));
  assert.ok(!/await _store\.del/.test(seg));
  // 2026-11-08 改：原来这里钉的是 makeTextStore 自己家里那句 dbp 缓存。「连接只开一次」
  //   这条道理对每个库都成立，已经搬去公共的 idbKeep / idbWith 了（施工规则/one-public-mechanism.md），
  //   所以这里改钉公共那一层的名字（施工规则/anchor-on-code.md：钉函数名，别钉实现那一行）。
  const mk = core.slice(core.indexOf("function makeTextStore"), core.indexOf("function companionHead"));
  assert.ok(/idbWith\(dbName, 1,/.test(mk), "文本库没走公共那一层");
  assert.ok(!/indexedDB\.open/.test(mk), "文本库自己又开了一条连接");
  assert.match(core, /function idbKeep\(name, ver, upgrade\)/, "公共那一层不见了");
  assert.match(core, /_idbPool\[k\] = db/, "公共那一层没把连接存起来复用");
});
test("言秋真身票交回来的各种形状都认：{say}、JSON 文本、包一层 result", () => {
  const i = watch.indexOf("const got = (function pick(v, depth)");
  assert.ok(i > 0);
  const src = watch.slice(watch.indexOf("function parseSay"), watch.indexOf("// 给测试用：纯函数")   /* 2026-10-18 起 parseSay 在 watch-core.js */);
  const body = watch.slice(i, watch.indexOf("})(r, 0);", i) + 9).replace("const got = ", "return ");
  const run = r => new Function("r", src + body)(r);
  assert.deepStrictEqual(run({ say: ["好看"] }), ["好看"]);
  assert.deepStrictEqual(run('{"say":["嗯","接着看"]}'), ["嗯", "接着看"]);
  assert.deepStrictEqual(run({ result: { say: "这段不错" } }), ["这段不错"]);
  assert.deepStrictEqual(run({ say: [] }), []);
});
