// 情书：列表、信纸、写信三个滚动框各自一个 key，列表记住滚到哪（她 2026-11-04：点进信不在最上面、退出来位置乱）
const test = require("node:test");
const assert = require("node:assert/strict");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "screens.js"), "utf8");
const seg = s.slice(s.indexOf("function CoupleLetters("), s.indexOf("function", s.indexOf("function CoupleLetters(") + 30) > 0 ? s.length : s.length);
test("三个滚动框都有自己的 key", () => {
  assert.match(seg, /key: "lread:" \+ l\.id, className: "flex-1 min-h-0 overflow-y-auto"/);
  assert.match(seg, /key: "lcompose", className: "flex-1 min-h-0 overflow-y-auto"/);
  assert.match(seg, /key: "llist", ref: keepScroll\("letters:" \+ partner\.id\)/);
});
