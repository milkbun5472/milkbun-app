// 群里断档按最后一条真有人说的话算：拉人进群的系统行不清零间隔（群里 2026-11-04：隔了半天拉新人，成员还停在中午）
const test = require("node:test");
const assert = require("node:assert/strict");
const a = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("算 _glast 时跳过系统行", () => {
  const seg = a.slice(a.indexOf("let _glast = 0;"), a.indexOf("const _ggap ="));
  assert.match(seg, /if \(mm\.role === "system"\) continue;/);
  assert.ok(seg.indexOf('mm.role === "system"') < seg.indexOf("seenOld = true"));
});
