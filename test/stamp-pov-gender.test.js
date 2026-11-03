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
  assert.match(src, /他穿什么以这一条为准，分镜里写的那身衣服不算/);
  assert.match(src, /分镜（shot）里写的那一身要照这一条/);
});
test("限时池（节日）不换他的身份", () => {
  assert.match(src, /\(card\.limited \? "" : "主题跟你自己的世界本来就是同一种/);
});
test("限时池照开池那天的写法写", () => {
  // 开池那天的组成：早返回带节日时刻与分镜那一身（她 2026-11-02：少了 themeLook 卡就不像万圣节）
  assert.match(src, /if \(card\.limited\) return pastLine \+ \(card\.timeAt \? stampTimeLine\(card\) : ""\)/);
  assert.match(src, /if \(card\.limited\) return[^;]*themeLook/s);
});
test("重写时不把这张自己的旧版本给他看", () => {
  assert.match(src, /stampPrev\(char\.id, list\.map\(c => c\.id\)\)/);
  assert.match(src, /stampPrev\(char\.id, \[c\.id\]\)/);
});
test("前面的卡只给写了什么事，不给卡名（免得卡名一个模子）", () => {
  assert.match(src, /"\\n你已经有的卡（写的是什么、卡上那句）：\\n"/);
});
test("册子里正在重写的卡有标记", () => {
  const ui = fs.readFileSync(__dirname + "/../js/stamps.js", "utf8");
  assert.match(ui, /"data-wk": "stamprewriting"/);
});
test("限时池卡名看得出是这一期", () => { assert.match(src, /"卡名一看就知道是「" \+ card\.theme \+ "」这一期的卡。"/); });
test("限时池分镜里的衣服看得出在过节", () => { assert.match(src, /shot 里的 outfit 写你过这个节穿的那一身/); });
test("限时池画卡面时，衣服那一格写死要过节的那一身", () => {
  assert.ok((src.match(/"这一张不穿平时的衣服：穿过「"/g) || []).length >= 2);
});
test("锁了衣服的那张，人设和参考照里的衣服不算", () => {
  const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  assert.match(eng, /这一张的衣服只看后面的服装锁：人设、外貌里写的常穿衣物和参考照里那身衣服都不算/);
});
