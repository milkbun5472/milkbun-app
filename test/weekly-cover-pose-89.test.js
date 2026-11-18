// 她 2026-11-18 周刊封面：「这个姿势能多加几个吗还有挡住脸了 衣服也都是黑的」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const pl = R("js/poster-layout.js"), app = R("js/app.js");
test("姿态掷一根、杂志脸在刊名底下、衣服颜色照各人自己的", () => {
  assert.match(pl, /"，身体" \+ pk\(\["有人坐着、有人站着"/);
  assert.match(pl, /画面里每个人的整张脸（连额头、帽子）都在最上面那六分之一底下/);
  assert.match(app, /每个人身上的颜色照自己衣柜和平时的样子来，各是各的颜色/);
});
