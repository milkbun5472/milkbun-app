const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8"), cmp = fs.readFileSync("js/components.js", "utf8");
const f = new Function(eng.slice(eng.indexOf("function groupNoticeBlock"), eng.indexOf("function directivesBlock")) + ";return groupNoticeBlock;")();
test("公告块：空的不发，有字带上", () => {
  assert.equal(f(null), ""); assert.equal(f({ text: "  " }), "");
  assert.match(f({ text: "周六聚餐", by: "沈屿白", ts: Date.now() }), /【群公告】.*沈屿白 发的[\s\S]*周六聚餐/);
});
test("群线上、群线下、群通话都读同一份 gs.notice", () => {
  assert.match(app, /const gNoticeHint = groupNoticeBlock\(gsFor\(groupId\)\.notice\)/);
  assert.match(app, /rgOpts\.rerollAvoid\) \+ gNoticeHint \+ gDirHint/);
  assert.match(app, /groupNotice: gsFor\(group\.id\)\.notice \|\| null/);
  assert.match(eng, /groupNoticeBlock\(ctx\.groupNotice\) \+/);
  assert.match(app, /cur\.groupId \? groupNoticeBlock\(gsFor\(cur\.groupId\)\.notice\)/);
});
test("写入方和界面", () => {
  assert.match(app, /saveGroupSettings\(g0\.id, \{ notice: t \? \{ text: t\.slice\(0, 2000\), ts: Date\.now\(\), by \} : null \}\)/);
  assert.match(cmp, /"data-wk": "gnoticebar"/);
  assert.match(cmp, /onSetNotice: onSetNotice,/);
});
