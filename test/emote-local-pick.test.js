const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const src = f => fs.readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");

test("表情库能从相册选图：存进本机图库，关键词取文件名", () => {
  const s = src("screens.js");
  assert.match(s, /onAddImages/);
  assert.match(s, /multiple: true, onChange: pickImages/);
  assert.match(s, /imgToVault/);
  assert.match(s, /stickerSrc\(em\.url\)/);
});

test("表情渲染会先解析 iv_ 引用", () => {
  const c = src("components.js");
  const i = c.indexOf("function EmoteBubble(");
  assert.ok(i > 0);
  assert.match(c.slice(i, i + 600), /stickerSrc\(raw\)/);
  assert.match(c, /multiple: !!multiple/);
});

test("app 把 onAddImages 接到表情库", () => {
  const a = src("app.js");
  assert.match(a, /const addEmoteImages = /);
  assert.match(a, /onAddImages: addEmoteImages/);
});

test("选完先填关键词再贴；已贴的点一下能改关键词", () => {
  const s = src("screens.js");
  assert.match(s, /setStaged\(s => \[\.\.\.s, \.\.\.items\]\)/);
  assert.match(s, /stagedReady/);
  assert.match(s, /onRenameEmote\(pack\.id, em\.id, k\)/);
  const a = src("app.js");
  assert.match(a, /onRenameEmote: renameEmote/);
});
