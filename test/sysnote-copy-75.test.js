// 出戏回话能复制（群友 2026-10-15）：SysNote 加 copyable，三处 OOC · 回都开
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(__dirname + "/../js/components.js", "utf8");
test("SysNote copyable：复制键走公共 copyText，字可选", () => {
  const fn = src.slice(src.indexOf("function SysNote("), src.indexOf("\n}\n", src.indexOf("function SysNote(")));
  assert.match(fn, /copyText\(text\)\.then/);
  assert.match(fn, /userSelect: "text", WebkitUserSelect: "text"/);
});
test("单聊、群聊、线下三处 OOC · 回都可复制", () => {
  assert.equal((src.match(/"OOC · 回", text: m\.content, copyable: m\.role !== "user"/g) || []).length, 3);
});
