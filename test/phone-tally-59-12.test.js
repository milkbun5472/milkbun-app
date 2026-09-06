// 她 2026-08-31：「查手机那块账本，如果我和她不是恋人（她自己有 cp）这块写的
// 还是我和她的账本而且会有点恋爱倾向的写法怎么改呢？」
//
// 两处病，都是【没说的那一半】：
//   ① 账本那一栏的提示词把「这本账」钉成了他和用户之间那一本——他跟别人的账没地方写；
//   ② buildBundle 里只有【是恋人/待定】才会说一句，不是恋人时一个字都不说，
//      空白由那一栏自带的恋爱腔补上（跟群聊王爷变霸总同一个形状）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const ph = R("phone.js"), app = R("app.js");
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };
// ⚠️核【拼出来的那份提示词】，不是源码里的字符串——源码里一句话常被 + 断成好几段，
// 照源码写断言既难写又冻长相。
const P = require("../js/phone.js");
const BOND = "\n\n【他跟谁有账】\n· 用户「Lisa」：不是恋人。现在是：合租室友\n· 沈砚（对象）";
const mk = (bond) => P.phoneProbeSpec("tally", { name: "苏晚" }, ["沈砚"], "", [], {}, null, false, bond);
const spec = mk(BOND).instruction;

test("账本不再钉死成「他和用户之间」那一本", () => {
  assert.match(spec, /这不是「他和用户之间」那一本，是他自己的那一本/, "还钉在用户身上");
  assert.match(spec, /每一条都要写清楚这笔账是【跟谁】的（who）/, "没要求写清跟谁");
  // 五栏的 schema 每一栏都得有 who，少一栏那一栏就退回旧样子
  const sh = mk(BOND).schemaHint;
  ["debts", "policies", "statements", "treasures", "appraisals"].forEach(k => {
    const seg = cut(sh, '"' + k + '":[{', "}]");
    assert.ok(seg.indexOf('"who"') > 0, k + " 那一栏的 schema 里没有 who");
  });
  // 界面上那句说明也不能再说「他和你之间」
  assert.ok(ph.indexOf("记的是他和你之间还没结清的东西") < 0, "界面说明还写着「他和你之间」");
  // 「跟谁的都有，你只是其中一个」那句 v59.65 从界面上撤了（她说挡住了）。
  // 这件事现在由每一条上的 who 牌自己说——下面那条测试盯着它。
  assert.ok(ph.indexOf("他还没给你们记账") < 0, "空态还写着「你们」");
});

test("腔调不预设成恋爱", () => {
  assert.match(spec, /腔调从关系里长出来，别预设是哪一种/, "没说腔调跟着关系走");
  assert.match(spec, /把每一条都写成情账是这一栏最容易犯的错/, "没挡住一律写成情账");
  assert.match(spec, /跟他不是那种关系的人，写出来却字字含情，那就是写坏了/, "没给判据");
  // bond 那一段只发给账本这一栏，别处不发（她按次计费）
  assert.ok(mk(BOND).instruction.indexOf("合租室友") > 0, "账本没收到「他跟谁有账」那一段");
  assert.ok(P.phoneProbeSpec("notes", { name: "苏晚" }, [], "", [], {}, null, false, BOND)
    .instruction.indexOf("合租室友") < 0, "便签也收到了这一段，白花钱");
  // 兜底那一栏原来整段都是情话腔，得挑明它不是
  assert.match(spec, /兜底不等于情话/, "兜底那一栏还默认是情话");
});

test("「他跟谁有账」这一段真的发出去了", () => {
  // ① app 那端建得出来
  const blk = cut(app, "  const phoneBondBlock = char => {", "\n  };");
  assert.match(blk, /恋人，在一起约/, "是恋人那一档没写");
  assert.match(blk, /不是恋人。现在是：/, "⚠️不是恋人那一档没写——空着就是让恋爱腔来填");
  assert.match(blk, /不是恋人，也还没长成什么特别的关系/, "连关系标签都没有的那一档没兜住");
  // ⚠️用户在 rels 里的键是 "me"，写成 "user" 永远取不到标签（查不出来，只会静静地空着）
  assert.match(blk, /rels\[char\.id \+ "->me"\] \|\| rels\["me->" \+ char\.id\]/, "用户在 rels 里的键取错了");
  assert.match(blk, /这本账不是只记用户那一本/, "没说清用户只占其中一份");
  assert.match(blk, /用户占多大篇幅，由上面这一行的真实关系决定/, "没把篇幅跟关系挂上");
  // ② 两个 callsite 都得传（一处传一处不传＝手动刷和自动刷两个样）
  assert.equal((app.match(/phoneBondBlock\(char\)\)/g) || []).length, 2, "两处 phoneProbeSpec 没都传 bond");
  // ③ phone 那端收得到、并且真拼进了 instruction
  assert.match(ph, /function phoneProbeSpec\(key, char, rel, actualWechat, avoidLines, known, money, weekly, bond\)/, "签名没收 bond");
  assert.match(ph, /const bondBlock = \(key === "tally" && bond\) \? bond : "";/, "bond 没按栏取用");
  // ⚠️别冻「它前后紧挨着谁」——v64.36 中间插进了 OWN_ONLY。要验的是【拼进去了】。
  assert.match(ph, /const _full = spec\.instruction \+ [^\n]*\bbondBlock\b/, "bondBlock 没拼进最终 instruction");
});

test("界面上看得出这笔是跟谁的", () => {
  const view = cut(ph, "function TallyView({", "\n}\n");
  assert.match(view, /const whoPill = x => S\(x && x\.who\)/, "没有 who 那块小牌");
  // 旧数据没有 who：不显示，别硬填一个「你」——那正是要撤掉的假设
  assert.ok(!/whoPill[\s\S]{0,200}\|\| "你"/.test(view), "旧数据被硬填成「你」了");
  // 五栏里除了自问（多半是他自己）都要挂出来。
  // ⚠️别把参数名冻死：v59.63 改成翻面卡之后每一栏的那个变量叫 e 了，
  // 要验的是【几栏挂出来了】，不是它写成什么样。
  assert.ok((view.match(/whoPill\([a-z]\w*\)/g) || []).length >= 4, "挂出来的栏数不够");
});
