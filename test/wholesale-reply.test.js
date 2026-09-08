const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const GB = require("./_group-bans.js");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

// 她 2026-08-25 把同一句「打雷了／好吵」发给三个人，三份回复是同一套三拍：
//   ① 窗户关紧了没  ② 嫌吵就把降噪耳机戴上（两人一字不差）  ③ 等我，马上过去
// 「这怎么是批发市场啊」。

// 聊天收尾后交回复看结果；两条线路都保留避重和双语层。
const taskV2 = app.slice(app.indexOf("const _normalTaskV2 = ("), app.indexOf("const _roomHint")).trim();
const endsWithClosing = () => {
  assert.match(taskV2, /\+ _turnClosing \+ _gazeNudgeHint\)\.replace\(\/用户\/g, uName\);$/, "聊天收尾后应交回复看结果");
  assert.doesNotMatch(taskV2, /crossSamenessHint/, "不再比较其他聊天");
  assert.match(taskV2, /_biTurnLine/, "双语那一层掉了");
};

test("三件套要被点名，而且给一把可判定的尺子", () => {
  const i = engine.indexOf("const STOCK_REPLY_BAN");
  assert.ok(i > 0);
  const rule = engine.slice(i, engine.indexOf("`;", i));
  // 点名她截图里那三拍
  assert.match(rule, /窗户关了没／吃饭了没/);
  assert.match(rule, /戴降噪耳机／多穿点／早点睡/);
  assert.match(rule, /等我二十分钟/);
  assert.match(rule, /她随口说话不等于要求解决问题/);
  // 禁的是模板不是关心——别把本来就会照顾人的角色一起阉掉。
  // ⚠️这一条原来是拿三个具体例子（爱操心／爱指挥／爱做饭盯着她吃完）说明「什么可以写」，
  //   她 2026-09-02：「这句会把所有人都变成这个样吧」。整段都在禁模板，
  //   只有这一处给了正面样子，于是它成了段里唯一可复制的东西
  //   （施工规则/prompt-no-content-samples.md：「写得越好的例子，被抄得越狠」）。
  //   所以这里冻的是【它给的是判据不是样子】，不是那三个词。
  // ⚠️v64.84 那句「禁的是【模板】不是关心：你人设里本来就有的那一面，该怎么关心还怎么关心」
  //   整句删了。她 2026-09-06：「有些人设也确实不会关心吧」——那句预设了每个人都有
  //   关心的那一面；而且我一开始是在它后面补了一句「不过冷淡的除外」，
  //   她当场指出：「在规则里说 yes unless 是最容易被模型忽略的，该删就删，
  //   不是在一句错误的话后面写上一堆除非」。所以现在是一句正面说完的话。
  assert.match(rule, /这条禁令只管【别机械套用三拍】，一个字都不管【你该多热情】/);
  assert.ok(!/爱操心|爱做饭|爱指挥/.test(rule), "不许再举「可以写成什么样」的例子");
  assert.ok(!/该怎么关心还怎么关心/.test(rule), "预设人人都有关心那一面的那句又回来了");
  assert.ok(!/除非|——但\*\*|⚠️反过来/.test(rule), "又在错句子后面贴创可贴了");
  assert.match(rule, /普通的附和、短答和常见表达可以自然出现/);
  // 判定必须可执行
  assert.doesNotMatch(rule, /原样发给|只有你会说/);
});

test("这条刀四处都挂上了", () => {
  // 单聊线上 + 单聊线下都走 buildBundle
  // 冻先后、不冻紧挨着：v60.45 情欲反八股插进了这两条中间（该加的一层）。
  const rp = engine.slice(engine.indexOf("} else {", engine.indexOf("if (ctx.notRoleplay)")),
                          engine.indexOf("// 用户通过 OOC 立下的长期行为准则"));
  assert.ok(rp.indexOf("parts.push(CONDESCENDING_TONE_BAN);") > 0);
  assert.ok(rp.indexOf("parts.push(STOCK_REPLY_BAN);") > rp.indexOf("parts.push(CONDESCENDING_TONE_BAN);"));
  // v60.39 起三处群共用 groupBans：别再 grep「这个常量拼在那一行的哪个位置」，
  // 对着【它到底吐出哪几层】问（改拼法不该红，掉一层才该红）。
  assert.ok(GB.allGroupsHave("STOCK_REPLY_BAN"), "三处群都要有");
  const codeOnly = src => src.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");

  // v60.27 起【通话】是第五处（她 2026-09-02：「语音视频没喂八股禁令进去」）——
  // 那之前这一层在通话里一处都没有，见 施工规则/four-surfaces-same-context.md。
  assert.equal((codeOnly(engine).match(/STOCK_REPLY_BAN/g) || []).length +
               (codeOnly(app).match(/STOCK_REPLY_BAN/g) || []).length, 3,
    "1 处定义 + buildBundle + groupBans（三处群共用；注释不算）");
});

test("提示词封的是那个位置，不是某个词", () => {
  assert.match(app, /心声可以没有结尾/);
  assert.match(app, /不管那句是狠话还是甜话/, "甜话也算——否则封了收拾就换成捏脸");
  assert.match(app, /收拾她／捏她脸／亲她一下／买点什么回去/, "把换过的那几个说法都点出来当例子");
  assert.match(app, /那个【位置】本身就是旁白在结案/);
});
