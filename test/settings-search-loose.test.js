const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
const i = c.indexOf("function settingsHit");
const hit = new Function(c.slice(i, c.indexOf("\n}", i) + 2) + ";return settingsHit")();
test("设置搜索不认空格大小写、换个说法也搜得到（她 2026-10-26）", () => {
  assert.equal(hit("重 Roll 留着旧的", "重roll"), 2);
  assert.equal(hit("重 Roll 留着旧的", "保留重roll"), 1);
  assert.equal(hit("时间感知", "朋友圈"), 0);
  assert.match(c, /const _hit = settingsHit\(txt, q\); if \(!_hit\) return;/);
  assert.match(ui, /const _hit = settingsHit\(plain, q\); if \(!_hit\) return;/);
});
