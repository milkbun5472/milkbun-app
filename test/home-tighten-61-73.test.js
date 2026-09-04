// v61.73 收紧按钮：当前页真项按视觉顺序贴紧到顶，洞清掉；只动当前页
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("tightenPage 存在：按 (r,c) 排序真项、去空格、只写当前页", () => {
  const seg = src.slice(src.indexOf("function tightenPage"), src.indexOf("function placeDrop"));
  assert.match(seg, /a\.r - b\.r \|\| a\.c - b\.c/);
  assert.match(seg, /!SP_RE\.test\(k\)/);
  assert.match(seg, /L\[page\] = reals\.map/);
});
test("编辑态顶栏有收紧按钮", () => {
  assert.match(src, /"⇱ 收紧"/);
  assert.match(src, /onClick: tightenPage/);
});
