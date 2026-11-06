import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const i = app.indexOf("const gridLike = "), j = app.indexOf("\n  };\n", i);
const gridLike = new Function(app.slice(i, j + 5) + "\nreturn gridLike;")();
const img = (W, H, paint) => { const a = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [r, g, b] = paint(x, y); const o = (y * W + x) * 4; a[o] = r; a[o + 1] = g; a[o + 2] = b; a[o + 3] = 255; } return a; };
test("九宫格（格子间有白缝）认得出", () => {
  const W = 300, H = 300;
  const a = img(W, H, (x, y) => { const gx = x % 100, gy = y % 100; return (gx < 4 || gx > 96 || gy < 4 || gy > 96) ? [255, 255, 255] : [30, 30, 30]; });
  assert.equal(gridLike(a, W, H), true);
});
test("一整张大人像（中间没有缝）不切", () => {
  const W = 300, H = 300;
  const a = img(W, H, (x, y) => (Math.hypot(x - 150, y - 160) < 130 ? [20, 20, 20] : [255, 255, 255]));
  assert.equal(gridLike(a, W, H), false);
});
test("静图、动图两条路都先过这一道", () => {
  assert.equal((app.match(/return emoteSetWhole\(/g) || []).length, 2);
});
const k = app.indexOf("const gifSegments = "), e = app.indexOf("\n  };\n", k);
const gifSegments = new Function(app.slice(k, e + 5) + "\nreturn gifSegments;")();
test("每帧整张一个表情轮流放：按画面变化分段，每段取中间那帧", () => {
  const W = 40, H = 40, solid = v => { const a = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < a.length; i += 4) { a[i] = v; a[i + 1] = v; a[i + 2] = v; a[i + 3] = 255; } return a; };
  const frames = [0, 0, 0, 200, 200, 90, 90, 90].map(v => ({ rgba: solid(v), delay: 100 }));
  assert.deepEqual(gifSegments({ width: W, height: H, frames }), [1, 4, 6]);
});
test("动图提示词把「每帧同时画着九格」放在最前面", () => {
  assert.match(app, /\? "【最要紧：这是一张九宫格动图，不是九个表情轮流放】/);
});
