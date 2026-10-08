const fs = require("fs"), assert = require("assert");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
assert.ok(c.indexOf("function NarrLine(") > 0, "公共旁白行存在");
// 只许一份旁白行：data-wk "narrink" 只在 NarrLine 里出现
assert.strictEqual(c.split('"data-wk": "narrink"').length - 1, 1, "旁白行只有一份");
assert.ok((c.match(/return h\(NarrLine, \{/g) || []).length >= 2, "单聊和群聊都走 NarrLine");
const a = c.indexOf("function NarrLine("), b = c.indexOf("function SysNote(", a);
assert.ok(a > 0 && b > a);
assert.ok(c.slice(a, b).includes("fontSize: 12.5"), "按单聊的字号");
console.log("narr-line shared ok");
