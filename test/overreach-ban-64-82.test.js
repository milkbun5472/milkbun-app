// 「为什么所有人我说考试不会他们都要 offer 来帮忙看？？就算不会也要来」
// （她 2026-09-06）。
// 两件事：① 所有人出同一手（跨角色同质）；② 就算不会也要来（能力越界）。
// STOCK_REPLY_BAN 挡不住——那条把触发限定在「没什么信息量的话」，
// 「我这门考试不会」信息量很足，于是整族漏过去。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const fic = fs.readFileSync(__dirname + "/../js/fanfic.js", "utf8");

test("温度由人设定，不由禁令定", () => {
  // 三件套那条也补了对称的一句：它原来只说「该怎么关心还怎么关心」，
  // 默认了每个人都有关心的那一面
  assert.match(eng, /这条禁令只管【别机械套用三拍】，一个字都不管【你该多热情】/, "三件套那条还在默认人人都会关心");
  // 原来那句「你人设里本来就有的那一面，该怎么关心还怎么关心」预设了人人都有关心的那一面：
  // 该删的就删掉，不是在后面补一句「不过冷淡的除外」
  assert.ok(eng.indexOf("该怎么关心还怎么关心") < 0, "错的那句还留着，只是后面补了个除非");
});

test("第一道闸问的是【你真的会吗】", () => {
  const i = eng.indexOf("const OVERREACH_BAN = ");
  assert.ok(i > 0, "没有这一条");
  const rule = eng.slice(i, eng.indexOf("`;", i));
  assert.match(rule, /第一道：你真的会吗/, "没先问会不会——那就还是只在管措辞");
  assert.match(rule, /不会还揽，不是体贴，是出戏/, "没说清为什么不许揽");
  // 第二道：她那句话未必是在求助
  assert.match(rule, /第二道：她这句话是在求助吗/, "少了这一问");
  // 不许一刀切成「不许帮忙」——真会的人当然可以帮
  assert.match(rule, /判据是【他这个人碰上这种事会是什么反应】/, "切成「不许关心」了");
  assert.match(rule, /依据你确实具备的能力、对方的需要和当下关系/);
  // ⚠️她 2026-09-06 的第二问：「有些人设也确实不会关心吧，我们提示明晃晃告诉他
  //   要关心是不是也是 ooc」——是的。原来那一条摆的是一桌【热的】选项
  //   （问她卡在哪／陪着熬／逗她一句），冷淡的人照着做就是另一种出戏。
  assert.match(rule, /冷淡的、正忙的、觉得这不关自己事的就那样回/, "没给「不接」这条路——冷淡的人被逼着关心");
  assert.match(rule, /为了显得体贴而长出人设里没有的那一面/, "没挡住「凭空变热」");
  // ⚠️她 2026-09-06 第三问：「在规则里说 yes unless 是最容易被模型忽略的，
  //   你应该该删就删而不是在一句错误的话后面写上一堆除非」。所以这几条里
  //   不许再出现「先说一句错的、再拿但是/除非/反过来说往回拉」的形状。
  assert.ok(!/——但\*\*|⚠️反过来|除非/.test(rule), "又在错句子后面贴创可贴了");
  // 判据而不是内容示范（prompt-no-content-samples）
  assert.doesNotMatch(rule, /原样发给|只有你会用/);
});

test("跟三件套同进同出——漏一处整族就回来", () => {
  // 群那三处走 groupBans
  assert.match(eng, /P\.push\(STOCK_REPLY_BAN\);\n\s*P\.push\(OVERREACH_BAN\);/, "群那一摞没跟上");
  // 单聊/线下/通话/probe 走 buildBundle
  assert.match(eng, /parts\.push\(STOCK_REPLY_BAN\);\n\s*parts\.push\(OVERREACH_BAN\);/, "buildBundle 那一处没跟上");
  // 同人文自己 push 那一串
  assert.match(fic, /if \(typeof OVERREACH_BAN !== "undefined"\) parts\.push\(OVERREACH_BAN\);/, "同人文没跟上");
});
