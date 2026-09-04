// v62.50 加笔换掉了整个循环（她 2026-09-04：「做吧宝宝」）
// 原来的循环是「引擎写一段 → 停在抉择处 → 玩家自由输入 → 再来一遍」——梦境有、跑团有、
// 小剧场有、如果馆也有，所以骨架和页边怎么改都还是像别的。
// 加笔手里有一样别处都没有的东西：这篇文的原文就在那儿，可玩家从头到尾看不见它。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const fic = fs.readFileSync(__dirname + "/../js/fanfic.js", "utf8");

// 把纯函数抠出来跑（它们不碰 DOM）
function grab(name) {
  const i = fic.indexOf("function " + name + "(");
  const seg = fic.slice(i, fic.indexOf("\n  }", i) + 4);
  return eval("(" + seg.replace("function " + name, "function") + ")");
}

test("原文按段切、按句断——点的是一句话，不是半句", () => {
  const rpParas = grab("rpParas");
  assert.deepStrictEqual(rpParas({ chapters: [{ content: "一段。\n\n二段。" }, { content: "三段。" }] }),
    ["一段。", "二段。", "三段。"]);
  assert.deepStrictEqual(rpParas(null), []);
  const rpSentences = grab("rpSentences");
  assert.deepStrictEqual(rpSentences("他愣了一下。你说什么？她没答，只是把伞挪了挪…"),
    ["他愣了一下。", "你说什么？", "她没答，只是把伞挪了挪…"]);
  // 没有句号的一整段也得回一条，不能回空数组（否则那一段点不着）
  assert.deepStrictEqual(rpSentences("一句没有标点的话"), ["一句没有标点的话"]);
});

test("落点认的是【原样抄回来的原句】，认不出就从第一段起", () => {
  const rpFindPara = grab("rpFindPara");
  assert.equal(rpFindPara(["他推门进来", "她没抬头"], "她没抬头"), 1);
  assert.equal(rpFindPara(["他推门进来", "她没抬头"], "编出来的一句"), 0);
  assert.equal(rpFindPara(["他推门进来"], ""), 0);
  assert.match(fic, /【从原文里原样抄】那个地方开头的 8-14 个字/);
});

test("原稿剩余＝还剩几成是她写的，不是模型拍的一个数", () => {
  const rpLeftPct = grab("rpLeftPct");
  assert.equal(rpLeftPct({ voided: [] }, ["a", "b", "c", "d"]), 100);
  assert.equal(rpLeftPct({ voided: [1] }, ["a", "b", "c", "d"]), 75);
  assert.equal(rpLeftPct({}, []), 100, "没有原文时不许除出 NaN");
});

test("存档只留下标，不复制整篇原文", () => {
  assert.match(fic, /paraIdx: window\.Fanfic\.rpFindPara\(window\.Fanfic\.rpParas\(newFic\), landing\.quote\), voided: \[\]/);
  assert.match(fic, /还没读到的部分一个字都不存/);
  // 引擎不写开场了——原文本身就是开场
  assert.match(fic, /⚠️这一次【不要写任何正文】：玩家会直接读原著的字/);
  assert.match(fic, /ss\.transcript = paras\[i0\] \? \[\{ who: "src", i: i0, text: paras\[i0\] \}\] : \[\]/);
});

test("从一句起动笔：那一段作废，引擎写顶替它的那一段", () => {
  assert.match(fic, /玩家在原文上动了笔/);
  assert.match(fic, /这一段从此作废，它不会这样发生了/);
  assert.match(fic, /接得上前面那半句——玩家点的是句子中间/);
  assert.match(fic, /用原文的笔调写，别换成另一个人的文风/);
  // 只有还没翻过去的那一段能下笔
  assert.match(fic, /往回改早就翻过去的段落会把整条时间线拧乱/);
  assert.match(fic, /ss\.voided = \(ss\.voided \|\| \[\]\)\.concat\(\[cut\.i\]\)/);
});

test("她把故事接回来，或者连后面几段也不要了", () => {
  // 接回来 = 后面那段原文还接得上；跟着玩 = voidAhead 把后面几段也划掉
  assert.match(fic, /这一拍的收尾就该让上面这段原文【还接得上】/);
  assert.match(fic, /"\\"voidAhead\\":她这一手连后面几段原文也不要了的段数（0-2 的整数/);
  assert.match(fic, /voidAhead: Math\.max\(0, Math\.min\(2, Math\.round\(\+d\.voidAhead \|\| 0\)\)\)/);
  assert.match(fic, /if \(r\.voidAhead > 0\) props\.onUpdate/);
});

test("原文和你改出来的字，不能只靠颜色分开", () => {
  const seg = fic.slice(fic.indexOf("function srcPara("), fic.indexOf("    // 一段叙事正文"));
  // 色弱和阳光下只剩形状可依：留白、行距、左边那道线都不一样
  assert.match(seg, /paddingLeft: 12, borderLeft:/);
  assert.match(seg, /lineHeight: 2\.15/);
  assert.match(seg, /textDecoration: dead \? "line-through" : "none"/);
  // 原文和改出来的文字在模型眼里是同一条故事线
  assert.match(fic, /if \(e\.who === "nar" \|\| e\.who === "src"\)/);
  // 收尾放回书架的那一版＝她的字 + 你改的字，作废的那几段不进
  assert.match(fic, /if \(e\.who === "src"\) return dead\.indexOf\(e\.i\) >= 0 \? "" : String\(e\.text \|\| ""\)\.trim\(\)/);
});

test("往下读一段不花钱，而且读完原文还能接着写", () => {
  assert.match(fic, /一分钱不花：这几段是她本来就写好的字/);
  assert.match(fic, /"▾ 接着读她写的（还剩 " \+ \(paras\.length - s\.paraIdx\) \+ " 段）"/);
  assert.match(fic, /"—— 她写的到这儿就没了 ——"/);
  // 老存档没有 paraIdx：不给读、但照旧写得下去、收得了尾
  assert.match(fic, /const moreSrc = Number\.isFinite\(s\.paraIdx\) \? s\.paraIdx < paras\.length : false;/);
});
