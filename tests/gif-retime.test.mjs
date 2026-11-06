import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const G = require("../js/gif-codec.js");
const frame = v => { const a = new Uint8ClampedArray(4 * 4 * 4); for (let i = 0; i < a.length; i += 4) { a[i] = v; a[i + 1] = v; a[i + 2] = v; a[i + 3] = 255; } return a; };
const bytes = G.encode({ width: 4, height: 4, frames: [{ rgba: frame(10), delay: 120 }, { rgba: frame(200), delay: 500 }] });
test("只抬太快的：慢的不动，画面不变", () => {
  const g = G.decode(G.retime(bytes, 160)), g0 = G.decode(bytes);
  assert.deepEqual(g.frames.map(f => f.delay), [160, 500]);
  assert.deepEqual(Array.from(g.frames[0].rgba), Array.from(g0.frames[0].rgba));
});
test("拉条用的 exact：每帧都改成这个数", () => {
  assert.deepEqual(G.decode(G.retime(bytes, 200, true)).frames.map(f => f.delay), [200, 200]);
});
test("出图入口按拉条定速，帧数 16；拉条松手把存着的动图一起改", () => {
  const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../js/screens-ui.js", import.meta.url), "utf8");
  assert.match(eng, /const GIF_FRAMES = 16;/);
  assert.match(eng, /GifCodec\.retime\(new Uint8Array\(await out\.blob\.arrayBuffer\(\)\), gifMsNow\(\), true\)/);
  assert.match(eng, /async function retimeStoredGifs\(ms\)/);
  assert.match(ui, /const n = await retimeStoredGifs\(ms\);/);
  assert.doesNotMatch(readFileSync(new URL("../js/app.js", import.meta.url), "utf8"), /gifFrames: (8|12),/);
});
