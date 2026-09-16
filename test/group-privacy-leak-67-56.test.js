// 她 2026-09-12（两张截图）：「我和顾暮单独没说过合照就跟顾朝说过，
//   然后我在群里也没说合照，顾暮就直接说了」。
//
// 围栏不是没写：那条隐私边界铁律又长又狠，一直在发。病根是**群聊一枪写完所有人的台词**——
// 模型写顾暮那几句的时候，顾朝那一段就摊在眼前。所以那条铁律【只能降概率】。
// 这一版按她自己立的那条办：**规则只降概率，代码才保证**——
//   ① 同处一室那一层补上缺的半句（人在一起 ≠ 看得见她手机上跟谁说了什么）
//   ② 回复拿回来之后本地对字查漏，漏了就指着错处重打一次（她：「没事重 roll 就行」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const G = require("../js/group-identity-guard.js");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

// 她那一轮的真形状：只跟顾朝说过合照，群里一个字没提
const SEGS = {
  顾朝: "Lisa: 阿暮那边好像还刚好留了什么合照之类的耶\nLisa: 不知道咋回事呢～\n顾朝: 哪来的什么合照，社团大合影还是毕业班级照啊",
  顾暮: "Lisa: 晚上吃什么\n顾暮: 随便，你定"
};
const PUB = "【近期群聊】\nLisa：怎么办呢\n【成员】顾朝：念美术的\n顾暮：他哥，画室那边的事他清楚";

test("顾暮说出了只跟顾朝说过的那两个字——抓得住", () => {
  const hits = G.privacyScan([{ name: "顾暮", text: "他大学那点破事还用得着合照" }], SEGS, PUB);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].name, "顾暮");
  assert.ok(hits[0].words.includes("合照"), "没抓到「合照」：" + JSON.stringify(hits[0].words));
});

test("顾朝自己说同样的话不算漏——那本来就是他知道的事", () => {
  assert.deepEqual(G.privacyScan([{ name: "顾朝", text: "哪来的什么合照" }], SEGS, PUB), []);
});

test("群里公开说过的、人设里有的，一律不算漏", () => {
  const pub = PUB + "\nLisa：你们那张合照呢";     // 她在群里说过了＝全群都知道
  assert.deepEqual(G.privacyScan([{ name: "顾暮", text: "还用得着合照" }], SEGS, pub), []);
  // 人设里写着的东西也是公开的（memberDesc 每个人都看得见）
  assert.deepEqual(G.privacyScan([{ name: "顾暮", text: "画室那边的事我清楚" }], SEGS, PUB), []);
});

test("心声也要查——没说出口不等于可以知道", () => {
  const hits = G.privacyScan([{ name: "顾暮", text: "嗯", thought: "合照那事他还想瞒着" }], SEGS, PUB);
  assert.ok(hits.length === 1 && hits[0].words.includes("合照"));
});

test("只有一个人有私密段的时候不查——没人可漏，别白误伤", () => {
  assert.deepEqual(G.privacyScan([{ name: "顾朝", text: "合照" }], { 顾朝: SEGS.顾朝 }, PUB), []);
  assert.deepEqual(G.privacyScan([{ name: "顾暮", text: "合照" }], {}, PUB), []);
  // 名单里没有的人（NPC、串名的）一律不查
  assert.deepEqual(G.privacyScan([{ name: "路人甲", text: "合照" }], SEGS, PUB), []);
});

test("只报最长的那一段，不把它拆成一串碎字", () => {
  assert.deepEqual(G.leakedWords("还用得着合照", "留了什么合照之类的", ""), ["合照"]);
  // ⚠️这一条要拿【长的和短的都成立】的料来验：只拿「合照」验的话，
  //   把「吃掉已占位」那几行删掉照样绿（变异测试里它活过一次）。
  assert.deepEqual(G.leakedWords("毕业班级照", "还是毕业班级照啊", ""), ["毕业班级照"],
    "拆成了一串碎字：短的那几段本来都在长的里面");
  // 跨标点拼出来的不算词
  assert.deepEqual(G.leakedWords("说完，照", "他说完，照片就没了", "说完 照"), [],
    "「完，照」这种跨着标点拼出来的也算词了");
});

test("抓到之后那一句是【指着错处说一次】，不是又一条常驻禁令", () => {
  const note = G.leakRetryNote(G.privacyScan([{ name: "顾暮", text: "还用得着合照" }], SEGS, PUB));
  assert.match(note, /「顾暮」说出了「合照」/, "没点名是谁、漏了哪几个字，模型改不动");
  assert.match(note, /一个都不许出现，也不许换个说法把同一件事说出来/, "只封字面的话，它换个词照样说");
  assert.match(note, /别的成员照常说话，这一轮的内容和走向不用跟着改/, "会把整轮都改掉");
  assert.equal(G.leakRetryNote([]), "", "没漏的时候一个字都不许发——那就成常驻禁令了");
});

// ⚠️v69.03：app 侧那一整块接线撤掉了（她 2026-09-16：「直接不要重写了宝宝」）。
// 理由是它【误报太多，而每次误报都要她多付一次钱】：判据两个字起就算命中，
// 可中文里「昨天」「晚上」「一起」满地都是，只要碰巧只出现在别人那段私密记录里就算泄密。
// 下面这些纯函数留着（它们本身是对的、也还有测试），只是 app 不再调用它们。
test("app 侧不再有「查漏后重打一枪」那一套", () => {
  const live = app.split("\n").map(l => l.split("//")[0]).join("\n");
  assert.ok(live.indexOf("privacyScan") < 0, "又接回来了");
  assert.ok(live.indexOf("leakRetryNote") < 0);
  assert.ok(live.indexOf("privSegs") < 0 && live.indexOf("privBlob") < 0, "收集代码也要一起撤干净");
  // 撤的只是「事后重打」；铁律和身份串线那道闸照旧
  assert.match(app, /隐私边界铁律/);
  assert.match(app, /window\.GroupIdentityGuard\.sanitize\(arr, members, userName\(profile\)\)/);
});

test("同处一室那一层补上了缺的半句：人在一起≠看得见她手机上的事", () => {
  const fn = eng.slice(eng.indexOf("function samePlacePresence(uName, group)"), eng.indexOf("\n}", eng.indexOf("function samePlacePresence(uName, group)")));
  assert.match(fn, /【在一起≠看得见她手机上的事】/);
  assert.match(fn, /别人和她的私聊、别处的对话，你一个字都没看见/);
  assert.match(fn, /看得见她在回消息，看不见内容/, "只说「看不见」不够：得说清看得见的是哪一半");
  // 原来那几层一条都没动
  assert.match(fn, /【同处一室·此刻真的面对面】/);
  assert.match(fn, /【地点以「在一起」为准】/);
  assert.match(fn, /【动作写屋里的事】/);
});
