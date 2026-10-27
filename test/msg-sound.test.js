const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const r = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
test("新消息提示音：几种自带的、能传自己的、在 bumpUnread 那一处响（群友 2026-10-26）", () => {
  const c = r("components.js"), app = r("app.js"), ui = r("screens-ui.js");
  const n = (c.match(/\{ id: "[a-z]+", zh: "[^"]+", (notes|sweep):/g) || []).length;
  assert.ok(n >= 6, "自带的不够几种：" + n);
  assert.match(c, /if \(id === "custom"\) \{\s*const src = loadJSON\("x_msgSoundFile", null\);/);
  const i = app.indexOf("const bumpUnread = (id, k, roomId) => {");
  assert.ok(app.slice(i, i + 500).includes("playMsgSound(_ps.msgSound, _ps.msgSoundVol)"));
  assert.match(ui, /h\(MsgSoundPick, \{ p, save, toast \}\)/);
  assert.match(ui, /f\.size > 400 \* 1024/);
  assert.match(ui, /type: "range", "data-wk": "msgsoundvol", min: 0\.1, max: 3/);
  assert.match(c, /const v = Math\.max\(0\.1, Math\.min\(3, vol == null \? 1 : Number\(vol\)\)\);/);
  assert.match(c, /createDynamicsCompressor\(\)/);
});

test("切后台回来声道会再叫醒（她 2026-10-27：主动消息没响）", () => {
  const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  assert.ok(!/removeEventListener\("pointerdown", _unlock/.test(c), "又变回只开一次了");
  assert.match(c, /visibilitychange[^\n]*_msgAudioCtx\.resume\(\)/);
});
