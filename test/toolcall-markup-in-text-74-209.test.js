// 她 2026-09-28 转来的截图：气泡里一行行冒出
//   </invoke>  <invoke name="affinityDelta">  <parameter name="affinityDelta">1</parameter>
//   <invoke name="mood">  <parameter name="label">嘴硬</parameter>  </ ||DSML|| calls>
// 模型偶尔改用【它自己那套函数调用语法】交 mood/affinityDelta 这几栏，我们照 JSON 读读不到，
// 整串标记就跟着 word 数组变成了一条条气泡。和 [photo: …] 那次同一个形状，修法也照那次。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

const a = src.indexOf("const TOOLCALL_LINE"), b = src.indexOf("function pullPhotoMarker(");
assert.ok(a > 0 && b > a, "抠不出 pullToolCallMarkup");
const pull = new Function(src.slice(a, b) + "; return pullToolCallMarkup;")();

test("她截图里那一串：正文只剩真正的话", () => {
  const r = pull(["你少管我。", "</invoke>", '<invoke name="affinityDelta">',
    '<parameter name="affinityDelta">1</parameter>', "</invoke>", '<invoke name="mood">',
    '<parameter name="label">嘴硬</parameter>', "</invoke>", "</ ||DSML|| calls>"]);
  assert.deepEqual(r.words, ["你少管我。"]);
});

test("能还原的字段捞回来", () => {
  const r = pull(['<invoke name="mood">', '<parameter name="label">嘴硬</parameter>', "</invoke>",
    '<invoke name="affinityDelta">', '<parameter name="affinityDelta">1</parameter>', "</invoke>"]);
  assert.equal(r.fields["mood.label"], "嘴硬");
  assert.equal(r.fields.affinityDelta, "1");
});

test("正常那轮一个字都不许动（别误伤尖括号）", () => {
  const words = ["今天好冷", "这个 <b>加粗</b> 不算", "1 < 2 而且 3 > 2", "他说「invoke」这个词"];
  const r = pull(words);
  assert.deepEqual(r.words, words);
  assert.equal(r.fields, null, "没命中就不该返回 fields，免得下游以为救过");
});

test("接在调用点上，而且只补本来空着的那几栏", () => {
  const i = app.indexOf("if (typeof pullToolCallMarkup === \"function\") {");
  assert.ok(i > 0, "调用点没接上");
  const seg = app.slice(i, i + 1200);
  assert.match(seg, /parsed\.affinityDelta == null && _f\.affinityDelta/);
  assert.match(seg, /parsed\.mood == null && _mood/);
  assert.ok(seg.indexOf("pullPhotoMarker") > 0, "和照片那一刀放在同一处，别散到两个地方");
});

test("修的是代码不是提示词（别再往里加禁令）", () => {
  const seg = src.slice(a - 900, a);
  assert.match(seg, /规则降概率，代码才保证/);
  const code = src.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(!/不许输出工具调用|禁止使用函数调用/.test(code), "这一族不该靠禁令");
});
