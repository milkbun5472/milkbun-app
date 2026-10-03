// 群友 2026-10-03：「新建站点，在第二个站点那里点测试生图，它好像是用第一个站点设置的模型来测试的」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("generateSelfieImage 认 opts.api，测试键把正在编辑的那一站递进去", () => {
  assert.match(P("js/engine.js"), /const a = \(opts && opts\.api\) \? Object\.assign\(\{\}, IMG_API_DEFAULTS, opts\.api\) : loadImgApi\(\);/);
  assert.match(P("js/screens.js"), /api: Object\.assign\(\{\}, c, \{ enabled: true \}/);
});
