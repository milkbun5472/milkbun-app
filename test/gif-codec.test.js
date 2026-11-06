// GIF 拆帧、拼帧（她 2026-11-06：动图九宫格切开、动图印字）
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../js/gif-codec.js");
const frame = (w, h, f) => { const a = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, on = ((x + f * 7) >> 3) % 2 === (y >> 3) % 2;
  a[o] = on ? 200 : 255; a[o + 1] = on ? 40 : 255; a[o + 2] = on ? 60 : 255; a[o + 3] = 255; } return a; };
test("拼了再拆回来，帧数、时长、颜色都对得上", () => {
  const W = 96, H = 64, frames = [0, 1, 2, 3].map(f => ({ rgba: frame(W, H, f), delay: 140 }));
  const bytes = G.encode({ width: W, height: H, frames });
  assert.equal(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]), "GIF89a");
  const g = G.decode(bytes);
  assert.equal(g.frames.length, 4); assert.equal(g.width, W); assert.equal(g.frames[2].delay, 140);
  for (let f = 0; f < 4; f++) for (let i = 0; i < W * H * 4; i += 37) assert.ok(Math.abs(g.frames[f].rgba[i] - frames[f].rgba[i]) <= 4, "f" + f + " @" + i);
});
test("大图、花色多（LZW 表满了要清表）也拆得回来", () => {
  const W = 300, H = 300, a = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { a[i * 4] = (i * 37) % 256; a[i * 4 + 1] = (i * 91) % 256; a[i * 4 + 2] = (i * 13) % 256; a[i * 4 + 3] = 255; }
  const g = G.decode(G.encode({ width: W, height: H, frames: [{ rgba: a, delay: 100 }] }));
  assert.equal(g.frames.length, 1); assert.equal(g.frames[0].rgba.length, W * H * 4);
});
