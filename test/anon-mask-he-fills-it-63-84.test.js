// v63.84 她 2026-09-05：「或者应该是如果是他在这种匿名网站，他会怎么写自己的名字
// 和签名，而不一定要具体的事」
// 这是【站位】问题，不是料的问题：前面几版都在让模型【从人设里提炼一句话】——
// 提炼过头是工牌，加工过头是一句谁都能挂的漂亮话。两头都不对，因为这件事根本不是提炼。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const RULE = eng.slice(eng.indexOf("const ANON_MASK_RULE"), eng.indexOf("function anonMaskNames"));

test("换站位：他本人坐在那儿注册这个号", () => {
  assert.match(RULE, /这一栏不是「给他设计一个马甲」，是他自己在填/);
  assert.match(RULE, /他本人坐在那儿，注册这个号，要填一个名字和一句签名。他会填什么？/);
  // 点破前面两版都错在哪儿，免得下次又荡回去
  assert.match(RULE, /提炼过头就是工牌，加工过头就是\n一句谁都能挂的漂亮话/);
  // 混人称的桥：规矩里全是「他」，可现在读它的人就是他
  assert.match(RULE, /下面这些话里的「他」说的就是你自己/);
});

test("态度就是他是谁——不必靠内容表明身份", () => {
  assert.match(RULE, /一个嫌麻烦的人和一个非要起个好名字的人，交出来的东西\n\s*天差地别/);
  for (const q of ["认真挑，还是随手打几个字", "想让人多看一眼", "故意起个跟真实的自己反着来的", "有多少耐心填完"]) {
    assert.ok(RULE.includes(q), "少了这一问：" + q);
  }
});

test("不必非得是一件具体的事", () => {
  assert.match(RULE, /\*\*不必非得是一件具体的事。\*\*/);
  assert.match(RULE, /一个声音、一个手感、一个他\n\s*懒得解释的词、一串没意义的字符都行/);
  // 判据：这是他会填的那种东西，不是这句话说清了他是谁
  assert.match(RULE, /重要的是【这是他会填的那种东西】，不是【这句话说清了他是谁】/);
});

test("三枪都换成他本人在打字（voice），不再走分析师那一路", () => {
  // runProbe 默认的开场白是「你是角色状态推演引擎，不要扮演角色，冷静推演」——
  // 分析师交上来的必然是【关于他的一句提炼】。跟解梦馆那次一模一样的形状。
  const seg = app.slice(app.indexOf("const openAnon = async char"), app.indexOf("const anonAsk") > 0 ? app.indexOf("const anonAsk") : app.indexOf("const openAnon = async char") + 9000);
  assert.equal((seg.match(/voice: true,/g) || []).length, 3, "第一次生成 / 撞名字补发 / 刷新马甲，三枪都要换");
  assert.match(app, /你现在在一个匿名树洞 App 上注册一个号/);
  assert.match(app, /刚填的那个网名跟别人重了，页面让你换一个/);
  assert.match(app, /你想把这个匿名树洞的号【重新捯饬一下】/);
  // 旧的第三人称任务句一句都不许剩
  assert.doesNotMatch(app, /设计 Ta 在匿名社交\/树洞 App 上的马甲/);
  assert.doesNotMatch(app, /重新为「" \+ char\.name \+ "」设计/);
  // ⚠️这一枪照旧不发最近对话（v63.74 那道代码闸）
  assert.match(app, /recentChat: "" \}/);
});
