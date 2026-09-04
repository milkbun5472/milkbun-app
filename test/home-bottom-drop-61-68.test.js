// v61.68 底部落点（她 9/3：「原来是可以放下面的但是现在死活不行。而且还是会跑」）
// 病根1：重排后只发内容行、尾部空格没了，页面下半没有落点；病根2：大组件落在最后一行会越出 6 行被溢去下一页。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
global.window = {};
const m = src.match(/function homePlaceDenseXY[\s\S]*?\nif \(typeof window !== "undefined"\) \{ window\.homeRepackResize/);
eval(m[0].replace(/\nif \(typeof window[\s\S]*$/, ""));
const spanW = k => /^sp_/.test(k) ? [1,1] : (k === "wid" ? [2,2] : [1,1]);
const cellCount = (arr, spanFn) => arr.reduce((s,k)=>{const sp=spanFn(k);return s+(sp?sp[0]*sp[1]:0);},0);

test("重排结果永远铺满整 6 行（24 格）——底部随时有落点", () => {
  const arr = ["wid","a","b","c"];
  const out = homeRepackResize(arr, "wid", spanW, [2,2]);
  assert.equal(cellCount(out, spanW), 24);
  const out2 = homeRepackMove(arr, arr, "a", "c", spanW);
  assert.equal(cellCount(out2.to, spanW), 24);
});

test("2x2 组件拖到最后一行：clamp 回第 5 行，不越出 6 行、不消失", () => {
  // 造一页 24 格：wid 在顶部，底部全空格
  let arr = ["wid","a","b","c"];
  arr = homeRepackResize(arr, "wid", spanW, [2,2]); // 铺满 24
  const bottom = arr[arr.length - 1]; // 最后一格的空格 (5,3)
  assert.ok(/^sp_/.test(bottom));
  const r = homeRepackMove(arr, arr, "wid", bottom, spanW);
  const pos = homePlaceDenseXY(r.to, spanW).pos;
  const at = {}; r.to.forEach((k,i)=>{ if(!/^sp_/.test(k)) at[k]=pos[i]; });
  assert.deepEqual([at.wid.r, at.wid.c], [4,2], "clamp 到 (4,2)：最后两行右下角");
  assert.ok(at.a && at.b && at.c, "没有人被溢出这一页");
});
