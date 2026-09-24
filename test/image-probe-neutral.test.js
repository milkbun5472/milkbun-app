// 她 2026-09-24：测试生图带参考图那一枪「不要限定男的」
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "screens.js"), "utf8");
test("参考图探针的那段话不预设照片里是男是女", () => {
  const i = src.indexOf("const runTest = async"), j = src.indexOf("generateSelfieImage(prompt, testRef", i);
  assert.ok(i > 0 && j > i, "抠不出 runTest");
  const blk = src.slice(i, j).split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(blk, /\b(?:man|woman|him|his|her|she|he)\b/i);
  assert.match(blk, /Keep the person in the photo/);
});
