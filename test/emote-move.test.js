const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
test("挑几张能挪到别的版，原样搬、id 不变（群友 2026-10-25）", () => {
  const i = app.indexOf("const moveEmotes = "), body = app.slice(i, app.indexOf("const deleteEmotes", i));
  let saved; const fn = new Function("emotePacksRef", "commitEmotePacks", body + "; return moveEmotes;")({ current: [{ id: "a", emotes: [{ id: 1 }, { id: 2 }] }, { id: "b", emotes: [{ id: 3 }] }] }, n => { saved = n; return true; });
  assert.equal(fn("a", [2], "b"), true);
  assert.deepEqual(saved[0].emotes.map(e => e.id), [1]); assert.deepEqual(saved[1].emotes.map(e => e.id), [3, 2]);
  assert.equal(fn("a", [2], "a"), false);
  assert.match(app, /onMoveEmotes: moveEmotes/); assert.match(ui, /"data-wk": "emomoveto"/);
  assert.match(fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8"), /"emomove"/);
});
