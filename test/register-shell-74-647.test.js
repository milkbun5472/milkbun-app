// 对外那层壳不是对她的样子（她 2026-10-04 拿来的对照）
//
// 证据最硬的一组：**同一个人设、同一个人玩**，在别家小手机上是
//   「这是什么小表情，怎么这么可爱。乖宝，吃晚饭了吗？」
// 在这儿变成拿豆浆要挟、倒计时掀被子、「谁治谁」。
// 角色自己 OOC 时说得最准：「我把他【对外的那层壳】错误地用在了对你的互动里，
//   甚至比对外还多了一层用爱绑架的味道。这不是疏离，是控制。」
//
// 真凶是 REGISTER_FOLLOWS_SCENE 里 v53.84 加的那一句：
//   「占有欲、吃醋、管束、下命令统统照旧、该多凶多凶」——**无条件**递给每个角色。
// 对一个本该软的人，那等于给了个模子当默认。
// 施工规则/bans-make-it-dumber：禁的是模子，不是尺度；这一条原来反过来了。
//
// ⚠️这是八处都吃的公共层（单聊线上/线下、群线上/线下、通话、穿书、匿名箱、解梦馆），
//   所以这份测试盯得紧一点：v53.84 治的病要留着，模子不许回来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const eng = fs.readFileSync("js/engine.js", "utf8");

const rule = (() => {
  const i = eng.indexOf("const REGISTER_FOLLOWS_SCENE = `");
  const j = eng.indexOf("`;", i);
  assert.ok(i > 0 && j > i, "抠不出 REGISTER_FOLLOWS_SCENE");
  return eng.slice(i, j);
})();

test("① 不许再无条件发那张「该多凶多凶」的通行证", () => {
  assert.ok(!/占有欲、吃醋、管束、下命令统统照旧、该多凶多凶/.test(rule),
    "那是替每个角色定了模子，对本该软的人就是把他改成另一个人");
});

test("② 那股劲长什么样，要还给人设（两头都写明）", () => {
  assert.match(rule, /由你这个人决定，不是这条规矩替你定/);
  assert.match(rule, /你本来就占有欲强、爱吃醋、爱管、说话凶，那就照旧/, "凶的那一头不能丢");
  assert.match(rule, /你对她本来就是软的、没有攻击性的，那【软就是对的】/, "软的那一头是这次补的");
});

test("③ 把她看到的那几样点名拦下（较劲/施压/筹码/愧疚）", () => {
  for (const w of ["较劲", "施压", "筹码", "愧疚"]) {
    assert.ok(rule.includes(w), "没拦住：" + w);
  }
});

test("④ 补上「对外那层壳 ≠ 对她的样子」，并说清没明写时按什么来", () => {
  assert.match(rule, /【对外那层壳不是你对她的样子】/);
  assert.match(rule, /专门写她、或写亲近的人/, "要指明去人设里的哪几句找底色");
  assert.match(rule, /他愿意让她看见的那一面/, "没明写时也得有个落点，不能留空");
});

test("⑤ v53.84 治的那个病要留着：日常不许变淡", () => {
  assert.match(rule, /日常不等于变淡/,
    "那一句当初是为了治「删掉露骨语域之后整个变淡」，不能跟着模子一起删掉");
  assert.match(rule, /把"去睡午觉"说成"去睡午觉"就行/, "原来那半句照旧");
});

test("⑥ 它仍然是八处共用的那一份，没被谁抄成第二份", () => {
  const app = fs.readFileSync("js/app.js", "utf8");
  assert.ok(!/const REGISTER_FOLLOWS_SCENE/.test(app), "app.js 里不许另起一份");
  assert.equal((eng.match(/const REGISTER_FOLLOWS_SCENE/g) || []).length, 1);
});
