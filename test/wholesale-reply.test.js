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

test("三件套要被点名，而且给一把可判定的尺子", () => {
  const i = engine.indexOf("const STOCK_REPLY_BAN");
  assert.ok(i > 0);
  const rule = engine.slice(i, engine.indexOf("`;", i));
  // 点名她截图里那三拍
  assert.match(rule, /窗户关了没／吃饭了没/);
  assert.match(rule, /戴降噪耳机／多穿点／早点睡/);
  assert.match(rule, /等我二十分钟/);
  assert.match(rule, /她那句话不是一道题/);
  // 禁的是模板不是关心——别把本来就会照顾人的角色一起阉掉。
  // ⚠️这一条原来是拿三个具体例子（爱操心／爱指挥／爱做饭盯着她吃完）说明「什么可以写」，
  //   她 2026-09-02：「这句会把所有人都变成这个样吧」。整段都在禁模板，
  //   只有这一处给了正面样子，于是它成了段里唯一可复制的东西
  //   （.claude/rules/prompt-no-content-samples.md：「写得越好的例子，被抄得越狠」）。
  //   所以这里冻的是【它给的是判据不是样子】，不是那三个词。
  assert.match(rule, /禁的是【模板】不是关心/);
  assert.ok(!/爱操心|爱做饭|爱指挥/.test(rule), "不许再举「可以写成什么样」的例子");
  assert.match(rule, /一百个人有一百种|只有你会用的那一种/, "换成维度和判据");
  // 判定必须可执行
  assert.match(rule, /原样发给她手机里【另一个人】，一个字都不用改也成立/);
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
  // 那之前这一层在通话里一处都没有，见 .claude/rules/four-surfaces-same-context.md。
  assert.equal((codeOnly(engine).match(/STOCK_REPLY_BAN/g) || []).length +
               (codeOnly(app).match(/STOCK_REPLY_BAN/g) || []).length, 3,
    "1 处定义 + buildBundle + groupBans（三处群共用；注释不算）");
});

// 规则降概率，代码才保证——这一整轮反复验证过的。
// 单聊是几次互不知情的独立调用，谁也不知道刚才别处已经这么答过了；
// 群聊是一次调用写完所有人，模型天然看得见彼此，不需要这一层。
test("禁用词表：把别的角色刚说过的短句收集起来当模板证据", () => {
  const i = app.indexOf("const CROSS_SAMENESS_WINDOW_MS");
  const j = app.indexOf("  const ctxFor = (char, ctxOpts) =>");
  assert.ok(i > 0 && j > i);
  const body = app.slice(i, j);
  const mk = (ctx, hist) => new Function("chatsRef", "characters", "stateHistRef", body
    + "\nreturn {crossSamenessHint, crossSamenessBlocklist, crossThoughtBlocklist};")(ctx, [], hist || { current: {} });
  const now = Date.now();
  const ctx = { current: {
    shen: [
      { role: "assistant", content: "窗户关紧了吗？阳台的门也顺便拉上，省得雨飘进去", ts: now - 4 * 60000 },
      { role: "user", content: "好吵", ts: now - 5 * 60000 },
      { role: "assistant", content: "超过半小时的老话不该进来", ts: now - 90 * 60000 }
    ],
    lu: [
      { role: "assistant", content: "嫌吵就把降噪耳机戴上，或者把卧室门带上", ts: now - 2 * 60000 },
      { role: "assistant", content: "撤回的不该进来", ts: now - 2 * 60000, recalled: true },
      { role: "assistant", content: "太短", ts: now - 60000 }
    ]
  } };
  const f = mk(ctx);
  const list = f.crossSamenessBlocklist("v");
  assert.ok(list.some(t => /降噪耳机/.test(t)), "别人刚说的要收进来");
  assert.ok(list.some(t => /窗户关紧了吗/.test(t)));
  assert.ok(!list.some(t => /老话/.test(t)), "超过半小时的不算刚才");
  assert.ok(!list.some(t => /撤回/.test(t)), "撤回的不算说过");
  assert.ok(!list.includes("太短"), "太短的没有信息量");
  // 自己说过的话绝不进自己的禁用单，否则等于禁止自己保持连贯
  assert.ok(!f.crossSamenessBlocklist("shen").some(t => /窗户关紧了吗/.test(t)));
  // 没有别人说过话时是空串＝零成本、零干扰
  assert.equal(mk({ current: {} }).crossSamenessHint("x"), "");
});

test("禁用词表只给句子，不给是谁说的——这不是把 A 的私聊漏给 B", () => {
  const i = app.indexOf("const crossSamenessHint");
  const fn = app.slice(i, i + 900);
  assert.match(fn, /谁说的不重要，别去猜、更别提起/);
  assert.doesNotMatch(fn, /c\.name|char\.name|senderName/, "一个名字都不许拼进去");
  assert.match(fn, /不许照搬，也不许换个说法说同一件事/);
});

test("单聊两条路径都要吃到禁用词表（漏一条换线路又变批发）", () => {
  assert.match(app, /MOOD_TURN_RULE \+ crossSamenessHint\(charId\) \+ _biTurnLine \+ _turnClosing\)\.replace/, "v2 每轮任务");
  assert.match(app, /MOOD_TURN_RULE \+ crossSamenessHint\(charId\) \+ "\\n【输出】/, "旧全量任务串");
  // 群聊不该有这一层，理由要写在代码里
  const why = app.slice(app.indexOf("const CROSS_SAMENESS_WINDOW_MS") - 700, app.indexOf("const CROSS_SAMENESS_WINDOW_MS"));
  assert.match(why, /群聊没有这个问题/);
  assert.match(why, /一次调用写完所有人/);
});

// 她 2026-08-27：「自从不能回去收拾我之后，大家都在回去要捏我脸了」。
// 封词封不住——封掉一个说法，模型换个词照填那个位置。所以：
//   ① 心声也要进那张「别处已经出现过」的表（以前只收气泡，心声一层没管）
//   ② 提示词封的是【那个位置】，不是某个词
test("心声也进禁用表：几个人心里冒出同一个套路要被抓住", () => {
  const i = app.indexOf("const CROSS_SAMENESS_WINDOW_MS");
  const j = app.indexOf("  const ctxFor = (char, ctxOpts) =>");
  const body = app.slice(i, j);
  const mk = (ctx, hist) => new Function("chatsRef", "characters", "stateHistRef", body
    + "\nreturn {crossSamenessHint, crossThoughtBlocklist};")(ctx, [], hist);
  const now = Date.now();
  const hist = { current: {
    shen: [{ thought: "待会儿买完菜回去要捏她脸", ts: now - 3 * 60000 }],
    pei: [{ thought: "回头非得捏一下她的脸不可", ts: now - 6 * 60000 }],
    old: [{ thought: "这句太久了不该再算数", ts: now - 90 * 60000 }],
    me: [{ thought: "本人自己的心声不该进自己的表", ts: now - 2 * 60000 }]
  } };
  const api = mk({ current: {} }, hist);
  const got = api.crossThoughtBlocklist("me");
  assert.ok(got.includes("待会儿买完菜回去要捏她脸"));
  assert.ok(got.includes("回头非得捏一下她的脸不可"));
  assert.ok(!got.some(x => /太久了/.test(x)), "半小时以外的不算");
  assert.ok(!got.some(x => /本人自己/.test(x)), "自己的心声不进自己的表");
  const hint = api.crossSamenessHint("me");
  assert.match(hint, /【心声也别和别处重样】/);
  assert.match(hint, /换个说法说同一件事也算重样/);
});

test("提示词封的是那个位置，不是某个词", () => {
  assert.match(app, /心声可以没有结尾/);
  assert.match(app, /不管那句是狠话还是甜话/, "甜话也算——否则封了收拾就换成捏脸");
  assert.match(app, /收拾她／捏她脸／亲她一下／买点什么回去/, "把换过的那几个说法都点出来当例子");
  assert.match(app, /那个【位置】本身就是旁白在结案/);
});
