const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
test("参考照真的发出去：attemptWith 先拷一份再清（传进来的就是 refBlobs 本身）", () => {
  const fn = eng.slice(eng.indexOf("const attemptWith = async"), eng.indexOf("const attempt = async"));
  assert.ok(/use = Array\.from\(blobs \|\| \[\]\)/.test(fn) && /use\.forEach\(b => refBlobs\.push\(b\)\)/.test(fn));
  assert.ok(!/refBlobs\.length = 0; blobs\.forEach/.test(fn), "别又退回先清空再从同一个数组抄");
  // 行为：照这段的写法，传进去同一个数组也不会丢
  const refBlobs = ["a", "b"]; const blobs = refBlobs;
  const saved = refBlobs.slice(), use = Array.from(blobs || []); refBlobs.length = 0; use.forEach(b => refBlobs.push(b));
  assert.deepStrictEqual(refBlobs, ["a", "b"]); assert.deepStrictEqual(saved, ["a", "b"]);
});
test("MiniMax 原生出图：/v1/image_generation、参考照走 subject_reference、失败不再串到别的接口", () => {
  assert.ok(/mRoot \+ "\/v1\/image_generation"/.test(eng));
  assert.ok(/body\.subject_reference = \[\{ type: "character", image_file: await toDataUrl\(refBlobs\[0\]\) \}\]/.test(eng));
  assert.ok(/if \(isMinimax\) r = await minimaxFetch\(\);/.test(eng));
  assert.ok(/if \(!isMinimax && !chatFirst && a\.apiFormat !== "images" && !r\.ok\)/.test(eng), "一张图一次请求");
  assert.ok(/value: "minimax" \}, "MiniMax 原生/.test(scr));
});
