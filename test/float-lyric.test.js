const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("浮窗歌词：解析只有一份、挂在 app 根上、点得穿（群友 2026-10-26）", () => {
  assert.equal((ui.match(/\[\.\.\.ln\.matchAll\(/g) || []).length, 1, "歌词解析只有一份");
  assert.match(ui, /const parseLrc = listenParseLrc;/);
  assert.match(ui, /"data-wk": "floatlyric", "aria-hidden": "true"/);
  assert.match(ui, /position: "fixed", left: 16, right: 16, zIndex: 9000, pointerEvents: editing \? "auto" : "none"/);
  assert.match(app, /h\(window\.FloatLyric, \{ player: player, song: resolveSong\(player\.songId\), read: musicRequest, ready: musicReady \}\)/);
  const parse = new Function(ui.slice(ui.indexOf("function listenParseLrc"), ui.indexOf("// ── 浮窗歌词")) + ";return listenParseLrc;")();
  assert.deepEqual(parse("[00:01.50]一\n[00:03]二").map(l => l.t), [1.5, 3]);
});
