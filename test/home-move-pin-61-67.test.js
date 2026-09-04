// v61.67 拖拽钉格：大组件挪位不再让全页流式重排（她 9/3：「65还是会流式移动」）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
global.window = {};
const m1 = src.match(/function homePlaceDenseXY[\s\S]*?\nif \(typeof window !== "undefined"\) \{ window\.homeRepackResize/);
assert.ok(m1);
eval(m1[0].replace(/\nif \(typeof window[\s\S]*$/, ""));

const spanW = k => /^sp_/.test(k) ? [1,1] : (k === "wid" ? [2,2] : [1,1]);
const place = (arr) => {
  const pos = homePlaceDenseXY(arr, spanW).pos;
  const at = {}; arr.forEach((k,i)=>{ if(!/^sp_/.test(k)) at[k]=pos[i]; });
  return at;
};

test("同页：1x1 图标拖进空格，其他人一格不动", () => {
  const arr = ["a","b","sp_1","c","d","e","f","g"];
  const r = homeRepackMove(arr, arr, "b", "sp_1", spanW);
  const at = place(r.to);
  assert.deepEqual([at.b.r, at.b.c], [0,2]);
  assert.deepEqual([at.a.r, at.a.c], [0,0]);
  assert.deepEqual([at.c.r, at.c.c], [0,3]);
  assert.deepEqual([at.d.r, at.d.c], [1,0]);
});

test("同页：2x2 组件挪到别处，没被压到的图标全部原地", () => {
  // wid(0,0-1,1) a(0,2) b(0,3) c(1,2) d(1,3) e(2,0) f(2,1) g(2,2)
  const arr = ["wid","a","b","c","d","e","f","g"];
  const r = homeRepackMove(arr, arr, "wid", "e", spanW); // 挪去 (2,0)
  const at = place(r.to);
  assert.deepEqual([at.wid.r, at.wid.c], [2,0]);
  for (const [k, rc] of [["a",[0,2]],["b",[0,3]],["c",[1,2]],["d",[1,3]],["g",[2,2]]])
    assert.deepEqual([at[k].r, at[k].c], rc, k);
  // e f 被脚印压到，先试 wid 旧锚点 (0,0)：e 应回 (0,0)
  assert.deepEqual([at.e.r, at.e.c], [0,0]);
  assert.ok(at.f, "f 还在页上");
});

test("跨页：原页留洞，目标页只压到落点那几个", () => {
  const from = ["a","wid","b","c"];
  const to = ["x","y","z","sp_9"];
  const r = homeRepackMove(from, to, "wid", "sp_9", spanW);
  const atF = place(r.from), atT = place(r.to);
  assert.ok(!atF.wid && atT.wid);
  assert.deepEqual([atF.a.r, atF.a.c], [0,0]);
  assert.deepEqual([atF.b.r, atF.b.c], [0,3], "b 原地不回流");
  assert.deepEqual([atT.x.r, atT.x.c], [0,0]);
});
