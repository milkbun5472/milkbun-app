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
test("写新卡时不把前面的卡名给他看，卡名跟着那件事走", () => {
  assert.match(src, /卡名不给你看，免得照着起/);
  assert.strictEqual((src.match(/长短、说法跟着这张卡里那件事走/g) || []).length, 2);
});
test("站子只回图片链接时，邮票卡面也试着把图拿下来", () => {
  assert.match(src, /^async function imgOutBlob\(out\)/m);
  assert.ok((src.match(/await imgOutBlob\(out\)/g) || []).length >= 2);
  assert.ok(!/if \(!\(out && out\.blob\)\) throw/.test(src));
});
test("R 卡心里那句摆在时刻回廊下面，不塞进「那一刻」", () => {
  const ui = fs.readFileSync(__dirname + "/../js/stamps.js", "utf8");
  assert.match(ui, /card\.rarity === "R" \? card\.text\.thought/);
  assert.match(ui, /zh: "那一刻", lv: 1, body: h\("div", null, para\(tx\.narration \|\| ""\)\)/);
});
test("限时池卡照这一期现在的主题说明写和画，分镜里的常服会被换掉", () => {
  assert.match(src, /const stampLim = card =>/);
  assert.ok(!/[^(]card\.themeLook/.test(src.replace(/const stampLim[^\n]*/, "")));
  assert.match(src, /他穿什么以这一条为准，分镜里写的那身衣服不算/);
  assert.match(src, /分镜（shot）里写的那一身要照这一条/);
});
