const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("邮票剧情旁白里角色的代词跟档案性别走", () => {
  assert.match(src, /const stampPov = \(char, t\) =>/);
  assert.match(src, /const STAMP_NARR_POV = char => stampPov\(char,/);
  assert.ok(!/STAMP_NARR_POV \+/.test(src), "每处都要带 char");
  src.split("\n").filter(l => l.includes("你是「他」")).forEach(l => assert.ok(l.includes("stampPov(char"), l.slice(0, 80)));
});
test("发给他看带的是卡页上正开着的那一面", () => {
  const ui = fs.readFileSync(__dirname + "/../js/stamps.js", "utf8");
  assert.match(ui, /onSend\(Object\.assign\(\{\}, card, \{ sendFace:/);
  assert.match(src, /face: card\.sendFace \|\| card\.face \|\| card\.faceAlt/);
});
test("册子多选重写：挑写好的卡，R/SR 每十张一次调用", () => {
  const ui = fs.readFileSync(__dirname + "/../js/stamps.js", "utf8");
  assert.match(ui, /"data-wk": "stampremode"/);
  assert.match(ui, /Math\.ceil\(by\[k\] \/ 10\)/);
  assert.match(ui, /onWrite\(picked\)/);
});
