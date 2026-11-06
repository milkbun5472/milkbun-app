import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const G = require("../js/gif-codec.js");
const frame = v => { const a = new Uint8ClampedArray(4 * 4 * 4); for (let i = 0; i < a.length; i += 4) { a[i] = v; a[i + 1] = v; a[i + 2] = v; a[i + 3] = 255; } return a; };
test("放慢：太快的帧抬到最小停留，慢的不动，画面不变", () => {
  const bytes = G.encode({ width: 4, height: 4, frames: [{ rgba: frame(10), delay: 120 }, { rgba: frame(200), delay: 500 }] });
  const out = G.retime(bytes, 160), g = G.decode(out), g0 = G.decode(bytes);
  assert.deepEqual(g.frames.map(f => f.delay), [160, 500]);
  assert.deepEqual(Array.from(g.frames[0].rgba), Array.from(g0.frames[0].rgba));
});
test("出图入口统一放慢", () => {
  const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
  assert.match(eng, /GifCodec\.retime\(new Uint8Array\(await out\.blob\.arrayBuffer\(\)\), GIF_MIN_MS\)/);
});
