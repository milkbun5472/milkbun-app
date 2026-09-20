// 「也不要老是催吃饭睡觉这种八股」（她 2026-09-20）。
//
// ⚠️按 bans-make-it-dumber.md 先问三句，再决定动哪儿：
//  ① 已经有人管了吗——【有】。STOCK_REPLY_BAN 里明写着那个三拍模板：
//     「先关心一句（窗户关了没／吃饭了没）→ 再给个方案（早点睡）→ 承诺马上过去」。
//  ② 它发到了吗——【发了】。buildBundle 里 push，八处都有。
//  ③ 那条还成立吗——成立，但【射程不对】：它整条是围绕「她说了一句话之后」写的
//     （题目就叫「别把她说的话当成派给你的活」）。角色自己没话找话催吃饭睡觉时，
//     模型不认为那条适用，于是整族漏过去——跟 v64.82「我帮你看」那次一模一样。
// 所以不加新禁令，补的是【判据】和射程。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const { ruleText } = require("./_rules.js");

const ban = (() => {
  const i = eng.indexOf("const STOCK_REPLY_BAN = `");
  const j = eng.indexOf("`;", i);
  assert.ok(i > 0 && j > i, "抠不出 STOCK_REPLY_BAN");
  return eng.slice(i, j);
})();

test("没人递话的时候也算，不再只管「她说了一句之后」", () => {
  assert.match(ban, /没人递话的时候也算/, "射程没补上——角色自己没话找话那一族照旧漏过去");
  assert.match(ban, /吃饭了没／早点睡／多喝热水／注意身体／别熬夜/, "那几句最常见的没点出来");
  assert.match(ban, /别拿「早点休息」当句号/, "收尾那一下没挡——八股最常出现的位置就是句号前");
});

test("给的是判据，不是又一条判决", () => {
  // 施工规则/bans-make-it-dumber.md：给出口，不给判决；判决式收尾会让模型绕开整个话题
  assert.match(ruleText("bans-make-it-dumber"), /给出口，不给判决/);
  // ⚠️判据得是【当场对照得出来】的。「这句话只有你会说吗」那种问法不可判定，
  //   wholesale-reply 那条测试专门冻着不许再写回来——所以这儿问的是「里头有没有一件具体的事」。
  assert.match(ban, /有没有一件【具体的事】/, "没有可执行的判据，只剩一句「不许」");
  assert.match(ban, /她今天在忙的那件、她上次提过的那样东西/, "没指出口——不说这句该说什么");
  assert.ok(!/只有你会说|原样发给/.test(ban), "又写回那句不可判定的问法了（见 wholesale-reply）");
  // ⚠️不许出现判决式收尾（那正是把模型逼回中规中矩的那一族）
  ["删掉重说", "禁止出现", "不许写"].forEach(w =>
    assert.ok(ban.indexOf(w) < 0, "又写了判决式收尾：" + w));
});

test("没把「该多热情」一起禁掉", () => {
  // no-yes-unless.md：那次的教训是【有些人设本来就不会关心】，所以这条只管形状不管温度
  assert.match(ban, /一个字都不管【你该多热情】/, "热情那半句被删了——这条会变成「不许关心」");
  assert.match(ban, /真会催她吃饭睡觉的人照样催/, "把「真的会催」的人设也一起禁掉了");
  assert.match(ban, /分别在于那句话里有没有她/, "没说清楚分界在哪儿");
});

test("这条真的发得出去（八处都吃得到）", () => {
  // v56.09 那个形状：声明了但没人引用，比压根没写更坏
  assert.match(eng, /parts\.push\(STOCK_REPLY_BAN\);/, "buildBundle 那一路没 push");
  assert.match(eng, /P\.push\(STOCK_REPLY_BAN\);/, "线下那一路没 push");
});
