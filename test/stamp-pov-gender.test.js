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
  assert.match(src, /stampPrev\(char\.id, list\.map\(c => c\.id\), ser && ser\.series\)/);
  assert.match(src, /stampPrev\(char\.id, \[c\.id\], ser && ser\.series\)/);
});
test("前面的卡只给写了什么事，不给卡名（免得卡名一个模子）", () => {
  assert.match(src, /"\\n你已经有的" \+ \(theme \? "「" \+ theme \+ "」" : ""\) \+ "卡（写的是什么、卡上那句）：\\n"/);
});
test("册子里正在重写的卡有标记", () => {
  const ui = fs.readFileSync(__dirname + "/../js/stamps.js", "utf8");
  assert.match(ui, /"data-wk": "stamprewriting"/);
});
test("限时池卡名从那件事里起，看得出是这一期的", () => { assert.match(src, /"卡名从这张写的那件事里起，看得出是「" \+ card\.theme \+ "」这一期的/); });
test("限时池分镜里的衣服合这一期", () => { assert.match(src, /shot 里的 outfit 写你在这一期里穿的那一身/); });
test("限时池画卡面时，衣服那一格写死要过节的那一身", () => {
  assert.match(src, /const stampLimFit = card => "这一张不穿平时的衣服：穿合「"/);
  assert.match(src, /const stampDayFit = \(card, who\) => card\.limited \? stampLimFit\(card\) : STAMP_DAY_KINDS\[card\.kind\]/);
  assert.match(src, /const limFit = stampDayFit\(card, "他"\);/);
  assert.match(src, /photoOutfit: stampDayFit\(card, "他"\) \}\);/);
  assert.match(src, /不是平时那身衣服上加一个头饰、一件小配件；参考照里他穿的那件外套和上衣这张都不出现/);
});
test("限时池去重只跟同一期比，不一样指事不一样、节照过；主题排在写卡先后最前", () => {
  const body = src.slice(src.indexOf("const stampPrev = "), src.indexOf("const stampVoice"));
  const ctx = { StampsCoreSafe: () => ({ cards: [
    { id: "a", charId: "x", series: "halloween", text: { gist: "南瓜灯" } },
    { id: "b", charId: "x", text: { gist: "修机器" } }] }) };
  const f = new Function("StampsCoreSafe", body + "return { stampPrev, stampPrevLine, stampSeriesOf };")(ctx.StampsCoreSafe);
  assert.deepEqual(f.stampPrev("x", [], "halloween").length, 1);
  assert.equal(f.stampPrev("x", []).length, 2);
  assert.match(f.stampPrevLine(["- 南瓜灯"], "万圣夜"), /同样的节日元素可以再出现/);
  assert.ok(!/节日元素/.test(f.stampPrevLine(["- x"])));
  assert.deepEqual(f.stampSeriesOf([{ limited: "halloween26", series: "halloween", theme: "万圣夜" }]), { series: "halloween", theme: "万圣夜" });
  assert.equal(f.stampSeriesOf([{ limited: "h", series: "h" }, { kind: "if" }]), null);
  assert.match(src, /是硬条件，排在写卡先后的最前面/);
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
test("限时池写卡：分镜的 outfit 是整套过节的，季节常服和小配件不算", () => {
  assert.match(src, /这一身是从外套、上衣到下装整套为这一期换的；平时那身加一个头饰、一件小配件不算。人设里按季节、按场合写的常穿衣服这张都不用。/);
});
test("变装只属于万圣夜；限时卡写这一期才有的那一刻", () => {
  const core = fs.readFileSync(__dirname + "/../js/stamps-core.js", "utf8");
  assert.match(core, /look: "这一身是扮成一个具体的角色或怪物/);
  assert.ok(!/扮成一个具体的角色或怪物/.test(src), "公共那段不再要求变装");
  assert.match(src, /写的是只有在「" \+ card\.theme \+ "」这一期才会发生的那一刻/);
});
test("生日、她的生日、纪念日卡：画图走服装锁，她那身也锁；写卡时季节常服不算", () => {
  const body = src.slice(src.indexOf("const STAMP_DAY_KINDS"), src.indexOf("const StampsCoreSafe"));
  const f = new Function("stampLimFit", body + "return stampDayFit;")(() => "LIM");
  assert.equal(f({ limited: "h" }), "LIM");
  assert.match(f({ kind: "bday" }, "他"), /为「他的生日」这一天特意准备的那一身[\s\S]*参考照里他穿的那件外套和上衣这张都不出现/);
  assert.match(f({ kind: "anniv", annivName: "在一起一周年" }, "她"), /为「在一起一周年」这一天[\s\S]*参考照里她穿/);
  assert.equal(f({ kind: "daily" }), "");
  assert.equal((src.match(/outfit: card\.kind === "mybday" \|\| card\.kind === "anniv" \? stampDayFit\(card, "她"\) : ""/g) || []).length, 2);
  assert.match(src, /人设里按季节、按场合写的常穿衣服这张都不用；shot 里的 outfit 写的是为这一天特意准备的整套/);
});
test("卡名不挂这一期的前缀；已经挂了的存的时候、开机时摘掉", () => {
  assert.match(src, /但不把「" \+ card\.theme \+ "」几个字挂在名字前面当前缀/);
  assert.ok(!/卡名一看就知道是「/.test(src));
  const i = src.indexOf("  const stampNameTidy"), j = src.indexOf("  // 已经起成", i);
  const f = new Function(src.slice(i, j) + "return stampNameTidy;")();
  assert.equal(f({ theme: "万圣夜", text: { name: "万圣夜·判官笔" } }).text.name, "判官笔");
  assert.equal(f({ theme: "万圣夜", text: { name: "夜市分糖" } }).text.name, "夜市分糖");
  assert.match(src, /stampNameTidy\(typeof patch === "function" \? patch\(c\) : \{ \.\.\.c, \.\.\.patch \}\)/);
});
test("写卡 JSON 里正文带了英文引号也救得回来", () => {
  const m = src.match(/const stampLooseJSON = \(raw, noSplit\) => \{[\s\S]*?\n  \};/)[0];
  const f = new Function(m + ";return stampLooseJSON;")();
  const got = f('{"cards":[{"name":"狼爪","narration":"他说"别动"\n笑了"}]}');
  assert.strictEqual(got.cards[0].narration, '他说"别动"\n笑了');
  assert.ok((src.match(/salvage: stampLooseJSON/g) || []).length >= 2);
});
