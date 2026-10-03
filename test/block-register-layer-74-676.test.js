// 拉黑那条链也要吃到「线上语域」整层（她 2026-10-03 拿戳人偶做的对照）
//
// 她贴的两张：同一个 claude 人设，OOC 里认得清清楚楚——
//   「温柔、软、哄着你、求着你、委屈、慌、带哭腔」——正式回复里却是
//   「手机没电了」「车里有充电器」「算了懒得动了」。
// 她一句话定的案：「戳人偶说的话是贴的」。同一个角色、同一份人设，
//   戳人偶那条链出来的是对的，拉黑这条链出来的像换了个人。
//
// 查下来三处，都长在拉黑这条自己拼 system 的链上：
//   ① 它只抄了 ONLINE_CHAT_RULE_V2，并排的 REGISTER_FOLLOWS_SCENE（「你对她本来就是软的，
//      那软就是对的」）和 PERSONA_REGISTER_ANCHOR 一条都没跟上。
//      ——four-surfaces-same-context 那个老形状：一层靠调用点一条条 push，换个入口就整条消失。
//      现在合成 onlineRegisterLayer() 一处（one-public-mechanism），两个调用点都改成拼它。
//   ② BLOCK_AXES 的 heat 整条写的是「这会儿的火气」，四个选项全是生气的变体——
//      一个求她的人没有「火气」这一项，轴却逼他挑一种生气（bans-make-it-dumber：掷的是答案）。
//   ③ 「往前挪一步」给的四个出口全是【走开】，于是「一直求」这种人设被整条堵死，
//      只剩下报状态。往前走≠退场。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const eng = fs.readFileSync("js/engine.js", "utf8");

// 注释里引的旧措辞会被整段 grep 命中，先剥掉（本仓库栽过三次）
const code = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const appCode = code(app), engCode = code(eng);

const blockFn = (() => {
  const i = appCode.indexOf("const blockedReaction = async");
  const j = appCode.indexOf("const respondUnblockFromChar", i);
  assert.ok(i > 0 && j > i, "抠不出 blockedReaction");
  return appCode.slice(i, j);
})();

test("① 线上语域合成一处，拉黑和单聊拼的是同一个", () => {
  assert.ok(/function onlineRegisterLayer\(\)/.test(engCode), "engine 里没有这个公共件");
  const body = engCode.slice(engCode.indexOf("function onlineRegisterLayer()"));
  ["ONLINE_CHAT_RULE_V2", "REGISTER_FOLLOWS_SCENE", "PERSONA_REGISTER_ANCHOR"].forEach(k =>
    assert.ok(body.slice(0, 300).includes(k), "这一层少了 " + k));
  assert.ok(blockFn.includes("onlineRegisterLayer()"), "拉黑这条链没拼这一层");
  assert.equal((appCode.match(/onlineRegisterLayer\(\)/g) || []).length, 2,
    "应该正好两个调用点（单聊线上 + 拉黑）；多出来的那个也得走公共件");
  // 提出公共件就不许再有人手抄三条（one-public-mechanism：新增共用层要把旧的一起迁过来）
  assert.ok(!/ONLINE_CHAT_RULE_V2 \+ "\\n\\n" \+ REGISTER_FOLLOWS_SCENE/.test(appCode),
    "还有调用点在手抄这三条，没迁到 onlineRegisterLayer()");
});

test("② 轴不许替他定此刻是什么情绪", () => {
  const axes = blockFn.slice(blockFn.indexOf("const BLOCK_AXES"), blockFn.indexOf("const _blkRolled"));
  assert.ok(!/这会儿的火气/.test(axes), "heat 这条又回到预设生气了");
  assert.ok(!/还在气头上/.test(axes) && !/气过了/.test(axes),
    "四个选项全是生气的变体＝替一个在求她的人定了答案");
  assert.ok(/心里最满的是哪一样/.test(axes), "heat 应该只问心里最满的是什么，不预设是哪一种");
  ["怕", "急", "累", "空"].forEach(w =>
    assert.ok(axes.includes('"' + w + '"'), "这一轴少了非愤怒的一面：" + w));
  assert.ok(!/决定先放着不管了/.test(axes), "move 里不许留劝退选项，那是第三处病的同一个模子");
});

test("③ 往前走不等于走开：同一件事上更深一层也算", () => {
  assert.ok(/往前走不等于走开/.test(blockFn), "没给出【更深一层】这条出口");
  assert.ok(/只剩一句求你/.test(blockFn), "要明写「一直求」也是往前走——她那位就栽在这儿");
  assert.ok(/这一轮比上一轮多了点什么/.test(blockFn), "判据要落在「多了点什么」，不是「换了个话题」");
  // 出口还在，但不许只剩走开那一类
  assert.ok(/你决定不说了/.test(blockFn), "原来那几条出口也得留着，由他自己挑");
});

test("④ 反复读那条禁令本身还在，别改着改着把它删了", () => {
  assert.ok(/同一件事、同一个意思/.test(blockFn), "防复读那条没了，拉黑又要开始车轱辘");
});
