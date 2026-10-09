// 她 2026-09-29：「App 其他还有这种样子的也搞兜底吧」（接着陪伴戳一下那条）。
// runProbe 里四十来处生成只要几个平铺字段；没解析出来时按字段名从原文里切出来，不为格式再花一枪。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const a = src.indexOf("function flatSchemaKeys("), b = src.indexOf("// 生成失败广播：");
assert.ok(a > 0 && b > a, "抠不出捡救那两个函数");
const F = new Function(src.slice(a, b) + "\nreturn { flatSchemaSalvage, flatSchemaKeys };")();
const H = '{"title":"一行小标题","body":"正文"}';

test("正文里带没转义的引号和换行：照样切得出每一栏", () => {
  const r = F.flatSchemaSalvage('{"title":"他说"等我"","body":"第一行\n第二行 "引号" 结束"}', H);
  assert.equal(r.title, '他说"等我"');
  assert.equal(r.body, '第一行\n第二行 "引号" 结束');
});
test("被截断、包在代码块里：捡回已经写出来的", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(F.flatSchemaSalvage('```json\n{"title": "雨夜",\n "body": "半截没收尾', H))), { title: "雨夜", body: "半截没收尾" });
});
test("数字、真假照原样还原", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(F.flatSchemaSalvage('{"affinity": 3, "ok": true, "note": "好"}', '{"affinity":数字,"ok":true,"note":"一句"}'))), { affinity: 3, ok: true, note: "好" });
});
test("不像的不硬捡：完全不是 JSON、捡不到一半的栏、带列表／嵌套的格式", () => {
  assert.equal(F.flatSchemaSalvage("完全不是json", H), null);
  assert.equal(F.flatSchemaSalvage('{"title":"只有一栏"}', '{"a":"","b":"","title":""}'), null);
  assert.equal(F.flatSchemaKeys('{"items":[{"a":1}]}'), null);
  assert.equal(F.flatSchemaKeys('{"cover":{"shop":""},"x":""}'), null);
});
test("runProbe 解析不出来先捡救，捡不回来就报错，不再补打第二枪；自带捡救的（陪伴）不走这一道", () => {
  const i = src.indexOf("async function runProbeInner(");
  const body = src.slice(i, src.indexOf("\n}\n", i));
  assert.ok(body.indexOf("flatSchemaSalvage(") > 0);
  assert.doesNotMatch(body, /上一次的输出没能解析/, "失败了不许再试第二次（她 2026-10-09）");
  assert.match(body, /if \(!parsed && typeof probe\.salvage !== "function"\) \{/);
});
