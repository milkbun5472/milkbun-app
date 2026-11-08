const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
// 群里 2026-11-08：「动图有时候眼珠子会有很诡异的滑动轨迹」——所有动图都从 generateSelfieImageRaw 出，眼睛那一句挂在那一处
test("出动图时提示词末尾带上眼睛那一句，只带一次；静图不带", () => {
  const src = eng.slice(eng.indexOf("const GIF_EYES"), eng.indexOf("async function generateSelfieImageRaw("));
  const { GIF_EYES, withGifEyes } = new Function(src + "; return { GIF_EYES, withGifEyes };")();
  assert.equal(withGifEyes("画一个小人", { gif: true }), "画一个小人" + GIF_EYES);
  assert.equal(withGifEyes("画一个小人" + GIF_EYES, { gif: true }), "画一个小人" + GIF_EYES);
  assert.equal(withGifEyes("画一个小人", {}), "画一个小人");
  assert.match(eng, /async function generateSelfieImageRaw\(prompt, refPhotoDataUrl, opts\) \{\n  if \(opts && opts\.gif\) \{ prompt = withGifEyes\(prompt, opts\);/);
});
