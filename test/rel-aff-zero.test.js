// 关系标签：情侣各种叫法按 80；「从零开始」「重新开始」清零（她 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("情侣、男朋友、老婆这些都按恋人 80 算；从零开始是 0 且改上那一刻清零", () => {
  const m = app.match(/const REL_AFF = (\{[^\n]+\});/); const T = eval("(" + m[1] + ")");
  ["情侣", "男朋友", "女朋友", "老公", "老婆", "夫妻", "未婚夫", "未婚妻"].forEach(k => assert.equal(T[k], 80, k));
  assert.equal(T["从零开始"], 0); assert.equal(T["重新开始"], 0);
  assert.match(app, /if \(_zero\(n\) && !_zero\(p\)\) \{ const _b = loadJSON\("x_affBase", \{\}\); _b\[cid\] = after; saveJSON\("x_affBase", _b\); setAff\(cid, 0\); return n; \}/);
});
test("关系编辑：预设多一个「从零开始」，标签下面照起点表说一句对好感的影响", () => {
  const ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
  assert.match(ui, /"青梅竹马", "从零开始"\];/);
  const i = ui.indexOf("function relAffHint"), j = ui.indexOf("\n}\n", i) + 2;
  const win = { __relAff: { table: { 恋人: 80, 情侣: 80, 挚爱: 82, 从零开始: 0 }, zero: /从零开始|重新开始/ } };
  const f = new Function("window", ui.slice(i, j) + "return relAffHint;")(win);
  assert.match(f("秘密情侣"), /好感起点 80/);
  assert.match(f("从零开始"), /清成 0/);
  assert.match(f("网友"), /不在起点表里/);
  assert.match(app, /window\.__relAff = \{ table: REL_AFF, zero: REL_AFF_ZERO \}/);
  assert.match(ui, /\(c\.tab === "me" \|\| \(c\.pair \|\| \[\]\)\.includes\("me"\)\) && relAffHint\(c\.label\)/, "「我和角色」那一栏认 tab，不认 pair");
});
