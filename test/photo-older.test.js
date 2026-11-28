const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const s = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const f = new Function(s.slice(s.indexOf("const PHOTO_OLDER_MARK"), s.indexOf("// 合照得是画面里真有两个人")) + ";return photoOlderOf;")();
test("认得出以后的样子（她 2026-11-28）", () => {
  assert.equal(f("十年后的他在办公室加班", 18).age, 28);
  assert.equal(f("三十年后，四十八岁的他在院子里浇花", 18).band, "mid");
  assert.equal(f("五十年后的样子，坐在摇椅上", 18).band, "old");
  assert.equal(f("老了以后在公园下棋").band, "old");
  assert.equal(f("人到中年在厨房做饭").band, "mid");
});
test("现在的照片、小时候的不算", () => {
  for (const x of ["咖啡店里看书", "24岁的他在海边", "小时候在外婆家"]) assert.equal(f(x, 24), null, x);
  assert.equal(f("二十五岁的她在海边", 24), null);
});
test("提示词换一套、编辑接口不要求原样保脸、说法男女通用", () => {
  assert.match(s, /parts\.push\(PHOTO_OLDER_MARK \+ "画面里"/);
  assert.match(s, /if \(!younger && !older && \(multi \|\| kind === "duo" \|\| char\.refPhoto\)\)/);
  assert.match(s, /indexOf\(PHOTO_OLDER_MARK\) >= 0\)/);
  const seg = s.slice(s.indexOf("const _yKid"), s.indexOf("const _oWho"));
  assert.ok(!/少年|少女|他的|她的/.test(seg.replace(/\/\/.*$/mg, "").replace(/const isBoy = [^\n]*/, "")), "说法要男女都适用");
});
