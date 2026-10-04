// 「跟随参考图」锁不住脸时别猜成真人照片（她 2026-10-05，芸：白毛紫瞳被画成黑发黑眼）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8");
const RE = new Function(src.slice(src.indexOf("const ANIME_HINT"), src.indexOf("\n", src.indexOf("const ANIME_HINT"))) + "; return ANIME_HINT;")();
test("设定里看得出是二次元才提示，真人也有的发色瞳色不算", () => {
  assert.ok(RE.test("白色长发，紫色眼睛")); assert.ok(RE.test("银发")); assert.ok(RE.test("二次元少年")); assert.ok(RE.test("异色瞳"));
  assert.ok(!RE.test("金发碧眼的英国人")); assert.ok(!RE.test("满头白发的老爷爷")); assert.ok(!RE.test("黑色短发，绿眼睛"));
});
test("只在「跟随参考图」那一路加，单人照的外貌提到画风后面第一句", () => {
  const seg = src.slice(src.indexOf('} else if (photoStyle === "reference") {'), src.indexOf("【手脚必须解剖正确】"));
  assert.match(seg, /ANIME_HINT\.test/);
  assert.match(seg, /if \(soloLook\) parts\.push/, "外貌没挪到前面");
  assert.doesNotMatch(src, /外貌特征（务必贴合）/, "单人照外貌还在后面又写了一遍");
});
