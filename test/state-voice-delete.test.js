const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const app = R("app.js"), comp = R("components.js");

test("状态卡：旧心声一条条删、清空、此刻那条也能删", () => {
  const i = comp.indexOf("function StateCard("), card = comp.slice(i, comp.indexOf("async function readOfflineStyleDocument(", i));
  assert.match(card, /onDelThought\(i\)/);
  assert.match(card, /onDelThought\("all"\)/);
  assert.match(card, /onDelThought\("now"\)/);
  assert.match(card, /requestAppConfirm\("清空"/, "清空要走 app 自己的确认框");
});

test("app：删此刻那条时旧的里同一句也拿掉，主线和小房间各存各的", () => {
  const i = app.indexOf("const delThought = "), fn = app.slice(i, app.indexOf("const setRoomThought = ", i));
  assert.match(fn, /const nx = \{ \.\.\.cur, thought: null \}; delete nx\.thoughtUpdatedAt;/);
  assert.match(fn, /hist\.filter\(x => x && x\.thought !== gone\)/);
  assert.match(fn, /room \? "x_roomStateHist" : "x_stateHist"/);
  assert.match(app, /onDelThought: what => delThought\(!!roomCard, roomCard \? stateCardRoomKey : scc\.id, what\)/);
});
