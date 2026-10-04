// 「跟随参考图」锁不住脸时别猜成真人照片（她 2026-10-05，芸：白毛紫瞳被画成黑发黑眼）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8");
const RE = new Function(src.slice(src.indexOf("const ANIME_HINT"), src.indexOf("\n", src.indexOf("const ANIME_HINT"))) + "; return ANIME_HINT;")();
test("只有明说画风才算二次元：银发、紫瞳、兽耳不推断画风（真人也有人这么设定）", () => {
  assert.ok(RE.test("二次元少年")); assert.ok(RE.test("日系动漫立绘风"));
  assert.ok(!RE.test("白色长发，紫色眼睛")); assert.ok(!RE.test("银发兽耳的真人")); assert.ok(!RE.test("金发碧眼的英国人"));
});
test("少见的发色瞳色兽耳，不管什么画风都照设定画，不许拉回黑发黑眼", () => {
  assert.match(src, /if \(soloLook && RARE_LOOK\.test\(char\.appearance\)\)/);
});
test("只在「跟随参考图」那一路加，单人照的外貌提到画风后面第一句", () => {
  const seg = src.slice(src.indexOf('} else if (photoStyle === "reference") {'), src.indexOf("【手脚必须解剖正确】"));
  assert.match(seg, /ANIME_HINT\.test/);
  assert.match(seg, /if \(soloLook\) parts\.push/, "外貌没挪到前面");
  assert.doesNotMatch(src, /外貌特征（务必贴合）/, "单人照外貌还在后面又写了一遍");
});
