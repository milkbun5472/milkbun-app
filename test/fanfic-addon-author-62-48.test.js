// v62.48 加笔的玩法（她 2026-09-04）：
//   「我每改一段就会有作者过来试图把剧情接回来然后再批注」
//   「每次开始前选择改稿节点的时候顺便生成作者小性格，有些会骂骂咧咧改，
//     有些会觉得我改的有意思一起让剧情离谱起来然后继续批注」
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const fic = fs.readFileSync(__dirname + "/../js/fanfic.js", "utf8");

test("作者小性格在【选落点】那一枪就定下来，不是等开场", () => {
  const g = fic.slice(fic.indexOf("async function genLandings("), fic.indexOf("  // 组 RP 对话 messages"));
  assert.match(g, /【同时给这篇文的作者/);
  ["who", "why", "sore", "temper"].forEach(k => assert.ok(g.indexOf('\\"' + k + '\\"') > 0, "输出形状里缺 " + k));
  // 还是同一次调用，别多花她一次钱
  assert.equal((g.match(/await callAI\(/g) || []).length, 1);
  // 老写法直接吐数组、新写法包在 landings 里——两种都得认，否则换个模型就空了
  assert.match(g, /Array\.isArray\(d\) \? d : \(d && Array\.isArray\(d\.landings\)/);
  assert.match(g, /return \{ landings: out, authorCard:/);
  // 落进这一局，并在设定页上先给她看一眼
  assert.match(fic, /setLandings\(r\.landings\); setAuthorCard\(r\.authorCard \|\| null\);/);
  assert.match(fic, /landing: landing, authorCard: authorCard,/);
  assert.match(fic, /"你动她的文，她会："/);
  // 开场那一枪不许把它覆盖掉——覆盖了 temper 就没了
  assert.match(fic, /ss\.authorCard = ss\.authorCard \|\| r\.authorCard \|\| null;/);
});

test("temper 只给维度和判据，不给可以照抄的例句", () => {
  const g = fic.slice(fic.indexOf("async function genLandings("), fic.indexOf("  // 组 RP 对话 messages"));
  const t = g.slice(g.indexOf("· temper"));
  assert.doesNotMatch(t, /如「|比如「|例如「/, "给了例句，每篇文的作者都会长成同一个人");
  assert.match(t, /这一栏要从上面三行长出来/);
});

test("每改一段，作者都在【故事里】动一手，然后才是页边那一句", () => {
  // pull 和 note 是两件事，不许合成一件
  assert.match(fic, /function rpPullBlock\(fic, session\)/);
  const pull = fic.slice(fic.indexOf("function rpPullBlock("), fic.indexOf("  // 一拍的输出契约"));
  assert.match(pull, /不是评论，是真的发生的事/);
  assert.match(pull, /这一手必须【写进正文里】/);
  assert.match(pull, /正文里绝不许提到作者、稿子、写作或任何元信息/);
  assert.match(pull, /不许替玩家做决定/, "作者伸手不能把这一拍写成死局");
  // 三种脾气都要真的改变走向，不是只在批注里表个态
  assert.match(pull, /想把故事拽回她原来那条道的/);
  assert.match(pull, /想跟着玩的：这一手要把故事推得【比玩家还远一点】/);
  assert.match(pull, /先冷着看的：这一手轻，但不许是没有/);
  // 开场那一拍她还没伸手
  assert.match(fic, /const wantPull = !!\(session && session\.transcript && session\.transcript\.length\);/);
  // 批注从每三拍一次改成每拍都有——它现在是那一手的落款
  assert.match(fic, /function wantNote\(\) \{ return true; \}/);
});

test("伸手那一条：存得下、看得见、但不回灌进历史", () => {
  assert.match(fic, /pull: String\(d\.pull \|\| ""\)\.trim\(\)\.slice\(0, 40\)/);
  assert.match(fic, /if \(r\.pull\) add\.push\(\{ who: "pull", text: r\.pull \}\);/);
  // 它已经写在正文里了，再灌一遍等于说两遍
  assert.match(fic, /if \(e\.who === "note" \|\| e\.who === "pull"\) return;/);
  // 不是气泡也不是段落：压在正文和批注之间的一行细字
  assert.match(fic, /"✍ " \+ authorName \+ " 伸手：" \+ e\.text/);
  // 那一拍没读完就不提前露出来
  const seg = fic.slice(fic.indexOf('if (e.who === "pull")'), fic.indexOf('if (e.who === "note") {'));
  assert.match(seg, /if \(i > lastNarIdx && moreToReveal\) return null;/);
});
