// 她 2026-09-17 说「堆吧」，收的是那份世界书里剩下的两族：
//   投降式敷衍（行行行／服了你了）和现成的腻歪称呼（小祖宗／小妖精）。
//
// ⚠️**合成一条，不是两条。** 本来打算各写一条，写到判据那一步才发现它俩同根：
//   都是【拿一个通用手势顶掉你本来该说的那句话】，共用这个库里那句老判据——
//   「换个角色还照样成立的，就是写坏了」。同一个判据管两族，写一条就够；
//   写两条等于把同一句话说两遍，两遍都变淡（施工规则/bans-make-it-dumber.md）。
//   这一摞两天里已经加了三层（空话／假装看穿／捏造身体），能并的就得并。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => path.join(__dirname, "..", f);
const eng = fs.readFileSync(P("js/engine.js"), "utf8");
const fic = fs.readFileSync(P("js/fanfic.js"), "utf8");
const BAN = (eng.match(new RegExp("const CANNED_PHRASE_BAN = `([\\s\\S]*?)`;")) || [])[1] || "";

test("两族都点了名", () => {
  assert.ok(BAN, "常量没了");
  ["行行行", "好好好", "行了吧", "可以了吧", "满意了吧", "服了你了", "随你"]
    .forEach(q => assert.ok(BAN.includes(q), "敷衍那族少了：" + q));
  ["小祖宗", "小妖精", "小野猫", "小磨人精", "小东西"]
    .forEach(q => assert.ok(BAN.includes(q), "称呼那族少了：" + q));
});

test("是一条不是两条——同判据的东西不许拆开说两遍", () => {
  assert.ok(!/const SURRENDER_BAN|const PET_NAME_BAN|const NICKNAME_BAN/.test(eng), "又拆成两条了");
  // 判据只有一句，而且明说它跟库里别处那句是同一条
  assert.match(BAN, /换一个人，这句话照样能原样说出口吗？/);
  assert.match(BAN, /跟这个库里别处那句是同一条/);
});

test("敷衍那族说清了它到底在干什么——不然只是一张词表", () => {
  // 病根不是这几个字难听，是它在【收摊】：一句话掐掉对话，还顺手递过去两层意思
  assert.match(BAN, /不是在回答，是在\*\*收摊\*\*/);
  assert.match(BAN, /把「你不讲理」和「我懒得跟你说」一起递过去/);
  // 给出口：真烦了怎么说
  assert.match(BAN, /真烦了就说清是什么让你烦/);
});

test("称呼那族给的是【从哪儿长出来】，不是「不许起昵称」", () => {
  assert.match(BAN, /不是你给她起的，是「这种关系该怎么叫她」倒出来的/);
  assert.match(BAN, /从她名字里的字、她做过的一件蠢事、只有你知道的某个习惯/);
  assert.match(BAN, /怎么腻都行/, "得说清这条不管你叫得多亲");
});

test("禁的是模子不是尺度", () => {
  assert.match(BAN, /本来就爱怼、爱冷、懒得解释、爱叫她一堆乱七八糟的名字，那全部照写/);
  ["删掉重说", "立刻销毁", "禁止出现", "自检", "逐条核对"].forEach(x =>
    assert.ok(!BAN.includes(x), "判决式／自检清单那一套：" + x));
});

test("跟 USER_BODY_BAN 划清界限：同名不同病", () => {
  // 「小矮子」「小短腿」是【捏造她的身体】，归那一条；这儿只收【称呼现成】
  assert.ok(!BAN.includes("小矮子") && !BAN.includes("小短腿"), "把捏造身体那族混进来了");
  const body = (eng.match(new RegExp("const USER_BODY_BAN = `([\\s\\S]*?)`;")) || [])[1] || "";
  assert.ok(body.includes("小矮子"), "那一族不该从 USER_BODY_BAN 里跑掉");
  assert.match(eng, /同名不同病，别混/, "这个分界得写在代码里，不然下次有人合并它俩");
});

test("三个分发点都接上，跟那一族贴着；言秋不发", () => {
  const gb = eng.slice(eng.indexOf("function groupBans(opts)"), eng.indexOf("const GROUP_USER_IS_PRESENT"));
  assert.match(gb, /P\.push\(CANNED_PHRASE_BAN\);/);
  assert.ok(gb.indexOf("P.push(USER_BODY_BAN)") < gb.indexOf("P.push(CANNED_PHRASE_BAN)"));
  const bb = eng.slice(eng.indexOf("parts.push(ANTI_CLICHE);"), eng.indexOf("parts.push(CHARCARD_RULE);"));
  assert.match(bb, /parts\.push\(CANNED_PHRASE_BAN\);/);
  assert.match(fic, /if \(typeof CANNED_PHRASE_BAN !== "undefined"\) parts\.push\(CANNED_PHRASE_BAN\);/);
  const seg = eng.slice(eng.indexOf("    if (ctx.notRoleplay) {"), eng.indexOf("parts.push(CHARCARD_RULE);"));
  assert.ok(!seg.slice(0, seg.indexOf("} else {")).includes("CANNED_PHRASE_BAN"), "混进言秋那支了");
});
