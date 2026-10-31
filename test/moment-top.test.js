const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("朋友圈置顶：只认自己发的，排最前（群友 2026-10-26）", () => {
  const f = new Function(c.slice(c.indexOf("function momTopFirst"), c.indexOf("function MomentsFeed({")) + ";return momTopFirst;")();
  const out = f([{ id: 1, mine: true }, { id: 2, characterId: "a", top: true }, { id: 3, mine: true, top: true }]);
  assert.deepEqual(out.map(m => m.id), [3, 1, 2]);
  assert.match(c, /momTopFirst\(moments\)(?:\.filter\([^\n]*?\))?\.map\(m =>/);
  assert.match(c, /onTop && isMine && h\("button", \{\s*onClick: \(\) => onTop\(m\.id\), "data-wk": "momtop"/);
  assert.match(app, /const topMoment = id => pMom\(p => p\.map\(m => m\.id === id \? \{ \.\.\.m, top: !m\.top \} : m\)\);/);
  assert.equal((app.match(/onTopMoment: topMoment,/g) || []).length, 2);
});
