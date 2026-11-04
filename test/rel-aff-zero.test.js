// 关系标签：情侣各种叫法按 80；「从零开始」「重新开始」清零（她 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("情侣、男朋友、老婆这些都按恋人 80 算；从零开始是 0 且改上那一刻清零", () => {
  const m = app.match(/const REL_AFF = (\{[^\n]+\});/); const T = eval("(" + m[1] + ")");
  ["情侣", "男朋友", "女朋友", "老公", "老婆", "夫妻", "未婚夫", "未婚妻"].forEach(k => assert.equal(T[k], 80, k));
  assert.equal(T["从零开始"], 0); assert.equal(T["重新开始"], 0);
  assert.match(app, /if \(_zero\(n\) && !_zero\(p\)\) \{ const _b = loadJSON\("x_affBase", \{\}\); _b\[cid\] = after; saveJSON\("x_affBase", _b\); setAff\(cid, 0\); return n; \}/);
});
