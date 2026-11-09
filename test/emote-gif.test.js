// 一张动图表情（她 2026-11-04：gpt-image-2.6 能出 GIF）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const e = R("engine.js"), a = R("app.js"), u = R("screens-ui.js");
test("出图：动图走出图接口；带参考照先试、接不住退纯文字，两条路都带 output_format gif", () => {
  assert.match(e, /if \(opts && opts\.gif\) \{\n\s*if \(a\.apiFormat === "chat"/);
  assert.match(e, /if \(hasRef && opts && opts\.gif\) \{/);
  assert.match(e, /o2\.degraded = "gif-no-ref";/);
  assert.match(e, /fd\.append\("output_format", "gif"\);/);
  assert.match(e, /body\.output_format = "gif"; body\.frame_count = /);
  assert.match(e, /!\(opts && opts\.gif\)\) \{   \/\/ 动图不退聊天接口/);
  assert.match(e, /webp\|gif\)\/i\);/);
});
test("回的不是 GIF 就说清楚，不存成静图", () => {
  assert.match(a, /if \(blob\.type && blob\.type !== "image\/gif"\) throw new Error\("这个站回的是一张静图/);
  assert.match(a, /onMakeGif: makeEmoteGif/);
});
test("表情包页能切到「一张动图」「九宫格动图」", () => {
  assert.match(u, /\[\["still", "九宫格（锁脸）"\], \["gif", "一张动图"\], \["gifgrid", "九宫格动图"\]\]/);
  assert.match(u, /if \(setGif\) onMakeGif\(c\.id, \{ caption: setCaption \}\); else onMakeSet\(c\.id, \{ caption: setCaption, gif: setKind === "gifgrid" \}\)/);
  assert.match(R("theme-studio.js"), /"emosetkind"/);
});
test("九宫格动图：一份切法，静图动图共用；动图走 GifCodec 一帧帧切、能印字", () => {
  assert.match(a, /const emoteSetCut = async \(blob, items, ownerKey, caption\) => \{/);
  assert.match(a, /if \(blob\.type === "image\/gif"\) \{[^]*?const urls = await gifCells\(blob, GRID9/);   // 中间先过 gridLike（没画成格子不切）
  assert.equal((a.match(/const n = await emoteSetCut\(blob, items, /g) || []).length, 2);
  assert.match(a, /emoteSetPrompt\(char\.name, char\.appearance, items, setOpt && setOpt\.gif\)/);
  assert.match(a, /近景构图：只画到胸口往上/);
  assert.match(R("../index.html"), /js\/gif-codec\.js\?v=/);
});
