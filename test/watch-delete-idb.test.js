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
