const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const comp = R("components.js"), app = R("app.js"), scr = R("screens.js"), sui = R("screens-ui.js");
const grab = (src, n) => { const i = src.indexOf("function " + n + "("); let d = 0; for (let k = src.indexOf("{", i); k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && !--d) return src.slice(i, k + 1); } };
test("改日子只换日期、几点照旧", () => {
  const f = new Function(grab(comp, "dateTapTs") + "; return dateTapTs;")();
  const o = new Date(2026, 9, 24, 21, 15, 3).getTime();
  const n = new Date(f(o, "2026-11-02"));
  assert.deepStrictEqual([n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), n.getMinutes()], [2026, 10, 2, 21, 15]);
  assert.strictEqual(f(o, "bad"), 0);
});
test("日记和第一次们都接上 DateTap", () => {
  assert.match(sui, /h\(DateTap, \{ ts: entry\.ts, onPick: onSetDate/);
  assert.match(app, /onSetEntryDate: setDiaryEntryDate/);
  assert.match(app, /const setDiaryEntryDate = [\s\S]{0,200}sortDiaryList/);
  assert.match(scr, /h\(DateTap, \{ ts: x\.ts, onPick: onSetAt/);
  assert.match(app, /cp\.firstsAt && cp\.firstsAt\[x\.key\]/);
  assert.match(app, /onSetFirstAt: setCoupleFirstAt/);
});
