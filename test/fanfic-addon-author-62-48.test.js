// v62.48 加笔的玩法（她 2026-09-04）：
//   「我每改一段就会有作者过来试图把剧情接回来然后再批注」
//   「每次开始前选择改稿节点的时候顺便生成作者小性格，有些会骂骂咧咧改，
//     有些会觉得我改的有意思一起让剧情离谱起来然后继续批注」
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const fic = fs.readFileSync(__dirname + "/../js/fanfic.js", "utf8");

// ⚠️v63.92 挪了地方：她的脾气改在【请她进名册】那一枪就定下来
//（她 2026-09-05：「在生成作者的时候已经有了」）——一个人的脾气不该每开一局重长一次。
test("作者小性格在【请人进名册】那一枪就定下来，不是等开局", () => {
  const g = fic.slice(fic.indexOf("async function genAuthors("), fic.indexOf("  // ---- 批量生成 N 篇"));
  ["bio", "style", "sore", "temper"].forEach(k => assert.ok(g.indexOf('\\"' + k + '\\"') > 0, "输出形状里缺 " + k));
  // 存得下：名册那一层要真的收这一栏，不然生成了也留不住
  const up = fic.slice(fic.indexOf("function upsertAuthor("), fic.indexOf("  // 请一位太太离开名册"));
  assert.match(up, /temper: cur\.temper \|\| String\(a\.temper \|\| ""\)\.trim\(\)\.slice\(0, 120\)/, "老作者补这一栏的路没有");
  assert.match(up, /temper: String\(a\.temper \|\| ""\)\.trim\(\)\.slice\(0, 120\),/, "新作者压根没存这一栏");
  // 开一局时从名册里读进来，不再当场问模型要
  assert.match(fic, /authorCard: window\.Fanfic\.rpAuthorCardOf\(fic\),/);
  assert.doesNotMatch(fic, /genLandings\(/, "挑落点那一枪该删干净了");
});

test("temper 只给维度和判据，不给可以照抄的例句", () => {
  const g = fic.slice(fic.indexOf("async function genAuthors("), fic.indexOf("  // ---- 批量生成 N 篇"));
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
