// 她 2026-11-02 截图：线下正文段落间印着字面的 \n\n。单人和群线下解析都过 offlineUnescapeNl。
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8");
const a = eng.indexOf("function offlineUnescapeNl");
const f = new Function(eng.slice(a, eng.indexOf("\n}\n", a) + 2) + ";return offlineUnescapeNl;")();
test("字面 \\n 换回真换行", () => {
  assert.equal(f("上。\\n\\n我脖子"), "上。\n\n我脖子");
  assert.equal(f("真换行\n不动"), "真换行\n不动");
});
test("单人和群线下都接上", () => {
  assert.match(eng, /const draftScene = offlineUnescapeNl\(/);
  assert.match(eng, /const scene = offlineUnescapeNl\(String\(b\.scene/);
});
