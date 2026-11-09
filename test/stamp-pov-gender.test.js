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
test("重写时不把这张自己的旧版本给他看", () => {
  assert.match(src, /stampPrev\(char\.id, list\.map\(c => c\.id\), ser && ser\.series\)/);
  assert.match(src, /stampPrev\(char\.id, \[c\.id\], ser && ser\.series\)/);
});
test("册子里正在重写的卡有标记", () => {
  const ui = fs.readFileSync(__dirname + "/../js/stamps.js", "utf8");
  assert.match(ui, /"data-wk": "stamprewriting"/);
});
test("限时池画卡面时，衣服那一格写死要过节的那一身", () => {
  assert.match(src, /const stampLimFit = card => "这一张不穿平时的衣服：穿合「"/);
  assert.match(src, /const stampDayFit = \(card, who\) => card\.limited \? stampLimFit\(card\) : STAMP_DAY_KINDS\[card\.kind\]/);
  assert.match(src, /const limFit = stampDayFit\(card, "他"\);/);
  assert.match(src, /photoOutfit: stampDayFit\(card, "他"\) \}\);/);
  assert.match(src, /不是平时那身衣服上加一个头饰、一件小配件；参考照里他穿的那件外套和上衣这张都不出现/);
});
test("锁了衣服的那张，人设和参考照里的衣服不算", () => {
  const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  assert.match(eng, /这一张的衣服只看后面的服装锁：人设、外貌里写的常穿衣物和参考照里那身衣服都不算/);
});
test("限时池画卡面时分镜里的衣服拿掉", () => {
  assert.match(src, /card\.limited \? String\(tx\.shot \|\| ""\)\.replace\(\/\(\?:outfit/);
});
test("IF、生日、纪念日写卡不带衣柜那段（会叫他只穿衣柜里的）", () => {
  assert.match(src, /const stampCtx = \(char, cards\) =>/);
  assert.match(src, /\{ carryLog: "" \}/);
  assert.ok(!/stampCtx\(char, \[c\]\)[\s\S]{0,40}const stampInner/.test(src));
});
test("写卡 JSON 里正文带了英文引号也救得回来", () => {
  const m = src.match(/const stampLooseJSON = \(raw, noSplit\) => \{[\s\S]*?\n  \};/)[0];
  const f = new Function(m + ";return stampLooseJSON;")();
  const got = f('{"cards":[{"name":"狼爪","narration":"他说"别动"\n笑了"}]}');
  assert.strictEqual(got.cards[0].narration, '他说"别动"\n笑了');
  assert.ok((src.match(/salvage: stampLooseJSON/g) || []).length >= 2);
});
test("限定卡在册子和卡页上都有限定标记", () => {
  const ui = fs.readFileSync(__dirname + "/../js/stamps.js", "utf8");
  assert.match(ui, /function LimMark\(\{ card, big \}\)/);
  assert.ok(!/" 限定"/.test(ui), "不要「限定」那条");
  assert.match(ui, /const DAY = \{ bday: /);
  assert.match(ui, /h\(LimMark, \{ card, big: true \}\)/);
  assert.match(ui, /back \? null : h\(LimMark, \{ card \}\)/);
});
test("IF 卡发型跟着主题走，发色五官照旧锁", () => {
  const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  assert.match(eng, /if \(opts && opts\.hairFree\) parts\.push\("【这一张的发型】/);
  assert.strictEqual((src.match(/hairFree: card\.kind === "if"/g) || []).length, 2);
  assert.ok(!/发色、发型、瞳色、五官和身材都不变/.test(src));
});
test("卡面图能收起不显示，图不删", () => {
  const ui = fs.readFileSync(__dirname + "/../js/stamps.js", "utf8");
  assert.match(ui, /"data-wk": "stamphideface"/);
  assert.match(ui, /const shownImg = k => k && !\(card\.hiddenImgs \|\| \[\]\)\.includes\(k\)/);
});
test("番外播放时背景能挑这张卡画过的任何一面", () => {
  const ui = fs.readFileSync(__dirname + "/../js/stamps.js", "utf8");
  assert.match(ui, /bgKey: "exBg_" \+ x\.id/);
  assert.match(ui, /\["ex", "这段番外", x\.img\], \["main", "第一面", card\.face\]/);
});
test("小剧场新版能自己换目标、开下一幕、谢幕", () => {
  const th = fs.readFileSync(__dirname + "/../js/theater.js", "utf8");
  assert.match(th, /"data-wk": "thrvnact"/);
  assert.match(th, /"谢幕收线", "写一场终场戏/);
});
// 2026-11-10 写卡提示词整理（她：「不要这样打补丁加提示词」）：一类事一句，能用代码办的不写进提示词
test("写卡提示词：衣服一句管所有特别卡", () => {
  assert.match(src, /const stampOutfit = what => "shot 里的 outfit 是为" \+ what \+ "整套换的一身/);
  assert.ok((src.match(/stampOutfit\(/g) || []).length >= 3, "IF、限时、生日纪念日都走这一句");
  assert.ok(!/人设里按季节、按场合写的常穿衣服这张都不用；shot 里的 outfit/.test(src), "旧的那几句补丁拿掉了");
});
test("写卡提示词：限时池主题排最前、写这一期才有的那一刻、不换身份、卡名不挂前缀；照这一期现在的说明", () => {
  const i = src.indexOf("if (card.limited) return"), j = src.indexOf("// 角色池主题跟他自己的世界", i), lim = src.slice(i, j);
  assert.match(lim, /是硬条件/); assert.match(lim, /写只有在这一期才会发生的那一刻/); assert.match(lim, /不把「" \+ theme \+ "」挂在前面当前缀/);
  assert.ok(!/走了另一条路/.test(lim));
  assert.match(src, /主题跟你自己的世界本来就是同一种[\s\S]{0,80}走了另一条路/);
  assert.match(src, /const lim = stampLim\(card\)/);
});
test("写卡提示词：同一批同样的要求只说一遍", () => { assert.match(src, /【写法" \+ \(k \+ 1\) \+ "】/); });
test("去重：前面的卡不给卡名、gist 不记在哪；只用来避开重复", () => {
  assert.match(src, /只用来避开重复（里面的地名、人、东西不算你的设定）/);
  assert.ok(!/这些卡名已经用过了/.test(src));
  assert.ok(!/写的是什么事、在哪、怎么收的尾/.test(src));
  assert.match(src, /const stampPrev = \(charId, skip, series\) =>[^\n]*\(!series \|\| c\.series === series\)/);
});
test("卡名重了由代码认：同一个人已有的、这一批前面的", () => {
  const i = src.indexOf("  const stampNameTaken"), j = src.indexOf("\n", src.indexOf("\n", i) + 1);
  const cards = [{ id: "a", charId: "c", text: { name: "马德里夜风" } }];
  const f = new Function("StampsCoreSafe", src.slice(i, j) + "\nreturn stampNameTaken;")(() => ({ cards }));
  assert.ok(f("c", "b", "马德里夜风", [])); assert.ok(!f("c", "a", "马德里夜风", [])); assert.ok(f("c", "b", "新名", ["新名"])); assert.ok(!f("d", "b", "马德里夜风", []));
  assert.match(src, /卡名跟前面那张重了，点一下重写/);
});
test("生日、她的生日、纪念日卡：画图走服装锁", () => {
  const body = src.slice(src.indexOf("const STAMP_DAY_KINDS"), src.indexOf("const StampsCoreSafe"));
  const f = new Function("stampLimFit", body + "return stampDayFit;")(() => "LIM");
  assert.equal(f({ limited: "h" }), "LIM");
  assert.match(f({ kind: "bday" }, "他"), /为「他的生日」这一天特意准备的那一身/);
  assert.equal(f({ kind: "daily" }), "");
});
test("卡名挂了这一期前缀的，存的时候、开机时摘掉", () => {
  const i = src.indexOf("  const stampNameTidy"), j = src.indexOf("  // 已经起成", i);
  const f = new Function(src.slice(i, j) + "return stampNameTidy;")();
  assert.equal(f({ theme: "万圣夜", text: { name: "万圣夜·判官笔" } }).text.name, "判官笔");
});
