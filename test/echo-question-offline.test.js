const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const theater = fs.readFileSync(path.join(root, "js/theater.js"), "utf8");

// 她 2026-08-24：「线下也在反问句！完全压不住」。
// 查下来线下【两道防线一道都没有】：
//   · stripEchoQuestion 是按【气泡】切的，线下是一整段连续正文，它根本没机会跑；
//   · 禁令只写在 ONLINE_CHAT_RULE_V2 里，线下压根不注入。
// 所以补两样：禁令进 OFFLINE_NARRATIVE_RUNTIME（线下/小剧场/同人文一起吃），
// 再加一把正文层的刀。

// v55.70 起判据抽成共用的 isEchoOfUser（线上线下同一套），抠函数时要连它一起带上
const strip = (() => {
  const g = n => { const i = engine.indexOf(n); return engine.slice(i, engine.indexOf("\n}\n", i) + 2); };
  const consts = engine.slice(engine.indexOf("const ECHO_TAIL ="), engine.indexOf("function echoCore("));
  return new Function(consts + g("function echoCore(") + g("function isEchoOfSaid(") + g("function echoOpening(")
    + g("function stripEchoQuestionScene(") + "\nreturn stripEchoQuestionScene;")();
})();

test("合并进同一句台词的回声：只削开头那一声", () => {
  assert.equal(strip("「自拍？行，别后悔。」他把手机递过来。", "看看自拍"),
    "「行，别后悔。」他把手机递过来。");
});

test("单独成句的回声：整段引号删掉，旁白接得上", () => {
  assert.equal(strip("「自拍？」他挑眉，「行，别后悔。」", "看看自拍"),
    "他挑眉，「行，别后悔。」");
  // 接缝处并出来的重复标点要收拾干净
  assert.equal(strip("他抬眼，「自拍？」，顿了顿，「行。」", "看看自拍"),
    "他抬眼，顿了顿，「行。」");
});

test("删了就没人说话的，宁可留着", () => {
  assert.equal(strip("「自拍？」他挑眉。", "看看自拍"), "「自拍？」他挑眉。");
});

test("连问是情绪，整串不动", () => {
  assert.equal(strip("「自拍？现在？」他笑了，「行。」", "看看自拍"),
    "「自拍？现在？」他笑了，「行。」");
});

test("她没说过那个词＝真反问，不许碰", () => {
  assert.equal(strip("「疼吗？」他皱眉，「我看看。」", "我摔了一下"),
    "「疼吗？」他皱眉，「我看看。」");
});

test("本来就没有回声的正文，一个字不动", () => {
  const s = "「行，别后悔。」他把手机递过来。";
  assert.equal(strip(s, "看看自拍"), s);
  assert.equal(strip("他没说话，只是把手机递过来。", "看看自拍"), "他没说话，只是把手机递过来。");
});

test("只看第一段引号，后面的反问一律不碰", () => {
  const s = "他把手机递过来。「行。」她愣住。「自拍？」他挑眉。";
  assert.equal(strip(s, "看看自拍"), s);
});

test("没有上一句用户发言时不许乱削", () => {
  assert.equal(strip("「自拍？」他挑眉，「行。」", ""), "「自拍？」他挑眉，「行。」");
  assert.equal(strip("", "看看自拍"), "");
});

test("禁令只留一份，线上线下共用", () => {
  assert.equal((engine.match(/const ECHO_QUESTION_BAN = `/g) || []).length, 1);
  assert.equal((engine.match(/这种回声式开场不是反应，是复述/g) || []).length, 1, "不许在两处各活一份");
  assert.equal((engine.match(/\$\{ECHO_QUESTION_BAN\}/g) || []).length, 2, "线上一处、线下叙事准则一处");
  assert.match(engine, /v52\.48 那次「重写 prompt 顺手丢掉标点和霸总禁令」就是这么来的/, "为什么要合成一份");
});

test("线上那段提示词一个字没被我改坏", () => {
  const g = n => { const i = engine.indexOf("const " + n + " = `"); return engine.slice(i, engine.indexOf("`;", i) + 2); };
  const out = new Function(g("ECHO_QUESTION_BAN") + "\n" + g("ONLINE_CHAT_RULE_V2") + "\nreturn ONLINE_CHAT_RULE_V2;")();
  assert.ok(out.indexOf("这种回声式开场不是反应，是复述") > 0);
  assert.ok(out.indexOf("把开头那个反问删掉——句子照样成立") > 0);
  assert.ok(out.indexOf("把它和后半句挤进同一条消息里也一样是回声") > 0, "堵合并那条口子的话不许丢");
});

test("线下叙事准则里要点名正文形态那种写法", () => {
  const i = engine.indexOf("const OFFLINE_NARRATIVE_RUNTIME = `");
  const block = engine.slice(i, engine.indexOf("`;", i));
  assert.match(block, /【别拿对方刚说的词开口反问】/);
  assert.match(block, /他挑眉/, "写成有动作有节奏的样子最容易蒙混过去，得点名");
  assert.match(block, /在【线下正文】里同样生效/);
});

test("三处都真的挂上了刀", () => {
  // v55.76：改成整轮（lastUserTurnText），不再只看最后一条
  assert.match(engine, /if \(lastSaid\) scene = stripEchoQuestionScene\(scene, lastSaid\)/, "单人线下");
  assert.match(engine, /out\[firstChar\]\.scene = stripEchoQuestionScene\(out\[firstChar\]\.scene, gLastSaid\)/, "群线下");
  assert.match(theater, /p\.scene = stripEchoQuestionScene\(p\.scene, text\)/, "小剧场");
});

test("群线下只削第一个角色 beat——后面是别人在接话", () => {
  assert.match(engine, /const firstChar = out\.findIndex\(b => b\.role === "char"\)/);
  assert.match(engine, /那些反问不是冲着她刚说的那句来的/, "为什么只削第一个，写在代码里");
});

test("言秋那条专线不碰", () => {
  const i = engine.indexOf("  if (!isDigital) {\n    const lastSaid");
  assert.ok(i > 0, "单人线下的刀必须包在 !isDigital 里");
  assert.match(engine, /isDigital 是言秋那条专线，不碰/);
});
