// 一张动图表情（她 2026-11-04：gpt-image-2.6 能出 GIF）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const e = R("engine.js"), a = R("app.js"), u = R("screens-ui.js");
test("出图：动图只走出图接口、不带参考照，请求里带 output_format gif", () => {
  assert.match(e, /if \(opts && opts\.gif\) \{\n\s*if \(a\.apiFormat === "chat"/);
  assert.match(e, /refPhotoDataUrl = null;/);
  assert.match(e, /body\.output_format = "gif"; body\.frame_count = /);
  assert.match(e, /!\(opts && opts\.gif\)\) \{   \/\/ 动图不退聊天接口/);
  assert.match(e, /webp\|gif\)\/i\);/);
});
test("回的不是 GIF 就说清楚，不存成静图", () => {
  assert.match(a, /if \(blob\.type && blob\.type !== "image\/gif"\) throw new Error\("这个站回的是一张静图/);
  assert.match(a, /onMakeGif: makeEmoteGif/);
});
test("表情包页能切到「一张动图」", () => {
  assert.match(u, /\[\[false, "九宫格（锁脸）"\], \[true, "一张动图"\]\]/);
  assert.match(u, /if \(setGif\) onMakeGif\(c\.id\); else onMakeSet/);
  assert.match(R("theme-studio.js"), /"emosetkind"/);
});
