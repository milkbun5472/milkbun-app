const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "study.js"), "utf8");
// 群友 2026-10-06：「第一次生成可以在已经生成好的地方加编辑吗」「第二次生成之前感觉可以的又没有了」
function mergeKeptUnits() {
  const i = src.indexOf("function mergeKeptUnits("), j = src.indexOf("\n  }\n", i);
  assert.ok(i > 0 && j > i);
  return new Function(src.slice(i, j + 4) + "\nreturn mergeKeptUnits;")();
}
test("换一版：留着的那几节原样插回原位，同名新节不要，撞 id 的改名", () => {
  const merge = mergeKeptUnits();
  const kept = [{ u: { id: "a", title: "高频词 A", _keep: true }, i: 0 }, { u: { id: "c", title: "我加的", _keep: true }, i: 2 }];
  const out = merge({ level: "x", units: [{ id: "a", title: "新的一节" }, { id: "z", title: "高频词 A" }, { id: "y", title: "别的" }] }, kept).units;
  assert.deepEqual(out.map(u => u.title), ["高频词 A", "新的一节", "我加的", "别的"]);
  assert.equal(new Set(out.map(u => u.id)).size, out.length, "id 撞了");
});
test("大纲页能改、能留着、能删、能自己加；改过的自动留着；装订前去掉记号", () => {
  assert.match(src, /setUnit\(i, \{ title: e\.target\.value \}\)/);
  assert.match(src, /if \("title" in patch \|\| "objectives" in patch \|\| "grammar" in patch\) patch = Object\.assign\(\{ _keep: true \}, patch\);/);
  assert.match(src, /setUnit\(i, \{ _keep: !u\._keep \}\)/);
  assert.match(src, /const dropUnit = /);
  assert.match(src, /"＋ 自己加一小节"/);
  assert.match(src, /return mergeKeptUnits\(fresh2, kept\);/);
  assert.match(src, /delete v\._keep;/);
});
