const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const src = fs.readFileSync(require("node:path").join(__dirname, "../js/engine.js"), "utf8");

test("开机补 WAL：先放进镜像，IDB 补不进去也不退回旧的", () => {
  const i = src.indexOf("durableWalKeys");
  const seg = src.slice(i, i + 1600);
  assert.ok(seg.indexOf("mir.set(k, s);") < seg.indexOf("await idbTxtPut(k, s)"), "mir.set 要在补写 IDB 之前");
});

test("保存收尾只删同一版的 WAL", () => {
  assert.match(src, /function walDelIf\(key, str\)/);
  assert.match(src, /rq\.result\.v === str\) st\.delete\(key\)/);
  assert.match(src, /walDelIf\(k, s\)\.catch/);
});
