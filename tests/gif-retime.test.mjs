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
  assert.match(eng, /GifCodec\.retime\(u8, gifMsNow\(\), true\)/);
  assert.match(eng, /GifCodec\.trimUncovered\(u8\)/);
  assert.match(eng, /async function retimeStoredGifs\(ms\)/);
  assert.match(ui, /const n = await retimeStoredGifs\(ms\);/);
  assert.doesNotMatch(readFileSync(new URL("../js/app.js", import.meta.url), "utf8"), /gifFrames: (8|12),/);
});
test("要动图就在提示词后面接【动图规矩】，一处说法", () => {
  const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
  assert.match(eng, /if \(opts && opts\.gif && typeof prompt === "string" && prompt\.indexOf\("【动图规矩】"\) < 0\) prompt = GIF_WORLD_HEAD \+ prompt \+ GIF_MOTION_RULE;/);
  assert.equal((eng.match(/【动图规矩】这是/g) || []).length, 1);
});
test("结构认不全（截断的 GIF）就原样返回，不改一个字节", () => {
  const cut = bytes.slice(0, bytes.length - 20);
  assert.deepEqual(Array.from(G.retime(cut, 300, true)), Array.from(cut));
});
test("有一帧底下没画满：所有帧裁到都画到的那块；都画满就不动", () => {
  const W = 20, H = 20, f = v => { const a = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < a.length; i += 4) { a[i] = v; a[i + 1] = v; a[i + 2] = v; a[i + 3] = 255; } return a; };
  const full = G.encode({ width: W, height: H, frames: [{ rgba: f(10), delay: 100 }, { rgba: f(200), delay: 100 }] });
  assert.equal(G.trimUncovered(full), null);
  // 把第二帧的图像描述里的高改成 18：底下两行没画到
  const b = full.slice(); let seen = 0;
  for (let i = 0; i < b.length - 10; i++) if (b[i] === 0x2C && b[i + 1] === 0 && b[i + 2] === 0 && b[i + 3] === 0 && b[i + 4] === 0 && b[i + 5] === W && b[i + 7] === H) { if (++seen === 2) { b[i + 7] = 18; break; } }
  const out = G.trimUncovered(b);
  assert.ok(out, "该裁没裁");
  const g = G.decode(out);
  assert.equal(g.width, 20); assert.equal(g.height, 18);
});
test("动图提示词最前面先守住世界和发型（不点任何时代题材）", () => {
  const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
  assert.match(eng, /prompt = GIF_WORLD_HEAD \+ prompt \+ GIF_MOTION_RULE;/);
  const head = eng.slice(eng.indexOf("const GIF_WORLD_HEAD"), eng.indexOf("const GIF_MOTION_RULE"));
  assert.doesNotMatch(head, /古代|现代|古风|仙侠|科幻/);
});
test("动图规矩：先规划完整动作、身体真的动、不靠眨眼抖动凑帧、参考照只认人、能循环；不再要求幅度小", () => {
  const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
  const r = eng.slice(eng.indexOf("const GIF_MOTION_RULE"), eng.indexOf("⑦ 不变形") + 80);
  for (const k of ["开始、发展、做到位、收回", "不许只靠眨眼", "不夸张、不表演", "整段最多眨一次眼", "起步和收尾慢", "参考照只认人", "回到起始的姿势"]) assert.ok(r.includes(k), k);
  assert.ok(!r.includes("幅度小一点"));
});
