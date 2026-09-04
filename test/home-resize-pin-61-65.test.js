// v61.65 主屏户口制：放大一个组件，邻居原地不动（她 2026-09-03：「原本在b1，放个大组件他就掉到a1」）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
global.window = {};
// 抠出两枚纯函数执行
const m = src.match(/function homePlaceDenseXY[\s\S]*?\nfunction homeRepackResize[\s\S]*?\n}\n/);
assert.ok(m, "helpers exist");
eval(m[0]);

const span1 = k => /^sp_/.test(k) ? [1,1] : (k === "wid" ? [1,1] : [1,1]);

test("放大 1x1→2x2：右边和下面没被压到的图标全部原地不动", () => {
  // 页：wid a b c / d e f g   （4 列）
  const arr = ["wid","a","b","c","d","e","f","g"];
  const out = homeRepackResize(arr, "wid", span1, [2,2]);
  const posAfter = homePlaceDenseXY(out, k => k === "wid" ? [2,2] : [1,1]).pos;
  const at = {}; out.forEach((k,i)=>{ if(!/^sp_/.test(k)) at[k]=posAfter[i]; });
  // wid 锚点还在 (0,0)，占 (0,0)(0,1)(1,0)(1,1)
  assert.deepEqual([at.wid.r, at.wid.c], [0,0]);
  // b(0,2) c(0,3) 原地不动
  assert.deepEqual([at.b.r, at.b.c], [0,2]);
  assert.deepEqual([at.c.r, at.c.c], [0,3]);
  // f(1,2) g(1,3) 原地不动
  assert.deepEqual([at.f.r, at.f.c], [1,2]);
  assert.deepEqual([at.g.r, at.g.c], [1,3]);
  // a(0,1) d(1,0) e(1,1) 被脚印压到 → 挤去后面，但不许消失
  for (const k of ["a","d","e"]) assert.ok(at[k], k + " still on page");
});

test("缩小 2x2→1x1：空出的格子变成洞，别人不回流", () => {
  const arr = ["wid","a","b","c","d"]; // wid 2x2 占四格
  const spanBig = k => k === "wid" ? [2,2] : [1,1];
  const out = homeRepackResize(arr, "wid", spanBig, [1,1]);
  const posAfter = homePlaceDenseXY(out, () => [1,1]).pos;
  const at = {}; out.forEach((k,i)=>{ if(!/^sp_/.test(k)) at[k]=posAfter[i]; });
  // a 原来在 (0,2)，缩小后仍在 (0,2)，不吸进 (0,1) 的洞
  assert.deepEqual([at.a.r, at.a.c], [0,2]);
  assert.deepEqual([at.b.r, at.b.c], [0,3]);
});

test("靠右边放不下就往左顶，不换行", () => {
  const arr = ["a","b","c","wid","d"]; // wid 在 (0,3)
  const out = homeRepackResize(arr, "wid", span1, [2,1]);
  const posAfter = homePlaceDenseXY(out, k => k === "wid" ? [2,1] : [1,1]).pos;
  const at = {}; out.forEach((k,i)=>{ if(!/^sp_/.test(k)) at[k]=posAfter[i]; });
  assert.deepEqual([at.wid.r, at.wid.c], [0,2]); // 左顶一格
  assert.deepEqual([at.a.r, at.a.c], [0,0]);
  assert.deepEqual([at.b.r, at.b.c], [0,1]);
});
