// 相册照片编号重了，画一张不再盖掉所有（群友 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/phone.js", "utf8");
test("签名连同标题、日期、描述一起算", () => {
  const i = src.indexOf("function phonePhotoSig"), j = src.indexOf("\n}\n", i) + 2;
  const sig = new Function(src.slice(i, j) + "return phonePhotoSig;")();
  const a = { id: "1", caption: "海边", desc: "浪" }, b = { id: "1", caption: "咖啡", desc: "杯子" };
  assert.notEqual(sig(a), sig(b));
  assert.equal(sig(a), sig({ ...a }));
  assert.notEqual(sig({ caption: "x" }), sig({ caption: "y" }));
});
