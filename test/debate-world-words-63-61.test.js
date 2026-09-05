// v63.61 她 2026-09-05 看擂台截图：「你看这是一个王爷一个大小姐，是不是怪怪的。
// 还有台下为什么都在回复我不讨论其他人的观点」
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const d = fs.readFileSync(__dirname + "/../js/debate.js", "utf8");

test("各人只能用自己那个世界里有的东西讲道理", () => {
  // 截图里古代王爷和现代大小姐一起开口就是基因、受精卵、遗传物质、神经网络。
  // 人设一直是给足的——可人设说的是「他是谁」，从没说过「他不可能懂什么」。
  assert.match(d, /const WORLD_WORDS =/);
  assert.match(d, /这个词、这件事，他这辈子有没有可能听说过？/);
  assert.match(d, /不是「少用」，是他根本没有这个词/);
  assert.match(d, /不许全场一起现代化/);
  assert.match(d, /谁也不给谁当翻译/);
  // 对不上本身就是这场好看的地方，不是要抹平的毛病
  assert.match(d, /两边对不上才是这一场好看的地方，别把它抹平/);
  // 只写判据不举例：举了例子每一场的古人都照着那句抄
  const W = d.slice(d.indexOf("const WORLD_WORDS ="), d.indexOf("// ---- 存档"));
  assert.doesNotMatch(W, /如「|比如「|例如「/);
});

test("两枪都要喂：分立场那一枪先跑偏，后面每一轮都跟着跑", () => {
  // 立场那一句就是各人这一场的底稿——它先现代化了，后面拦不住（一层写在两处的老形状）
  const stance = d.slice(d.indexOf("async function assignStances"), d.indexOf("async function genRound"));
  const round = d.slice(d.indexOf("async function genRound"));
  assert.match(stance, /"\\n\\n" \+ WORLD_WORDS/, "分立场那一枪没喂");
  assert.match(stance, /用【这个人自己会说的话】写/);
  assert.match(round, /"\\n\\n" \+ WORLD_WORDS/, "每一轮那一枪没喂");
});

test("台边不是她一个人的嘴替：这一声冲着谁要说清，而且不许都冲着同一个人", () => {
  assert.match(d, /他在看这一场，不是给 " \+ uName \+ " 一个人当嘴替/);
  assert.match(d, /两条不许都冲着同一个人/);
  assert.match(d, /至少有一条是冲着别人的/);
  // 输出形状里得有 at，不然「冲着谁」根本回不来
  assert.match(d, /\\"side\\":\[\{\\"name\\":\\"场边那位的本名\\",\\"at\\":\\"这一声冲着台上谁（本名）\\"/);
  assert.match(d, /at: String\(\(c && c\.at\) \|\| ""\)\.trim\(\)/);
});

test("规则只降概率，代码兜死：两条都冲同一个人时丢掉后一条", () => {
  assert.match(d, /const onStage = \(o\.chars \|\| \[\]\)\.length \+ \(o\.watch \? 0 : 1\);/);
  assert.match(d, /if \(onStage > 1 && side\.length === 2 && side\[0\]\.at && side\[0\]\.at === side\[1\]\.at\) side\.length = 1;/);
  // 台上只有一个人时不许乱丢（旁观局里她不上台，台上就那几位）
  assert.match(d, /宁可这一轮只有一声，也不要台边变成她一个人的嘴替/);
});

test("台边那一行要看得见他在接谁的话", () => {
  const sb = d.slice(d.indexOf("const sideBlock = function"), d.indexOf("const focusCard") > 0 ? d.indexOf("const focusCard") : d.indexOf("const sideBlock = function") + 1800);
  assert.match(sb, /x\.at \? h\("span", \{ style: \{ color: t\.fog \} \}, " → " \+ x\.at\) : null/);
});
