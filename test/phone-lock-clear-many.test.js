const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const s = fs.readFileSync(__dirname + "/../js/phone-ui.js", "utf8");
test("锁屏通知多过 200 条也清得掉（她 2026-10-27）", () => {
  assert.match(s, /const next = \[\.\.\.new Set\(\[\.\.\.ids\.map\(String\), \.\.\.\(all\[char\.id\] \|\| \[\]\)\]\)\]\.slice\(0, 2000\);/);
  const ids = Array.from({ length: 359 }, (_, i) => "n" + i);
  const next = [...new Set([...ids, ...Array.from({ length: 300 }, (_, i) => "o" + i)])].slice(0, 2000);
  assert.ok(ids.slice(0, 5).every(id => next.includes(id)));
});
