// 群里 2026-10-20：发了图再说「老公帮我换上呀」，他嘴上说设好了，锁屏没动——那句没点名壁纸，锁屏那一格没递给他。
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
test("「换上／设成」+ 最近几条里有她发的图，也递锁屏那一格", () => {
  const i = app.indexOf("const _askSwap"), seg = app.slice(i, i + 400);
  assert.match(seg, /换上\|换成\|设成/);
  assert.match(seg, /all\.slice\(-8\)\.some\(m => m && m\.role === "user" && m\.imageRef\)/);
  assert.match(app.slice(i, i + 600), /if \(lastU && _askSwap\)/);
});
