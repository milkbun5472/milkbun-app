const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
  // 禁的是模板不是关心——别把爱操心的人一起阉掉
  assert.match(rule, /禁的是【模板】不是关心/);
  assert.match(rule, /爱做饭盯着她吃完，那都照写/);
  // 判定必须可执行
  assert.match(rule, /原样发给她手机里【另一个人】，一个字都不用改也成立/);
});

test("这条刀四处都挂上了", () => {
  // 单聊线上 + 单聊线下都走 buildBundle
  assert.match(engine, /parts\.push\(CONDESCENDING_TONE_BAN\);\n\s*parts\.push\(STOCK_REPLY_BAN\);/);
  assert.match(app, /groupOnlineRuntime \+ "\\n\\n" \+ STOCK_REPLY_BAN/, "群线上");
  assert.match(engine, /MOOD_TURN_RULE \+\n\s*"\\n\\n" \+ STOCK_REPLY_BAN/, "群线下");
  const codeOnly = src => src.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  assert.equal((codeOnly(engine).match(/STOCK_REPLY_BAN/g) || []).length +
               (codeOnly(app).match(/STOCK_REPLY_BAN/g) || []).length, 4,
    "1 处定义 + buildBundle + 群线上 + 群线下（注释不算）");
});

// 规则降概率，代码才保证——这一整轮反复验证过的。
// 单聊是几次互不知情的独立调用，谁也不知道刚才别处已经这么答过了；
// 群聊是一次调用写完所有人，模型天然看得见彼此，不需要这一层。
test("禁用词表：把别的角色刚说过的短句收集起来当模板证据", () => {
  const i = app.indexOf("const CROSS_SAMENESS_WINDOW_MS");
  const j = app.indexOf("  const ctxFor = (char, ctxOpts) =>");
  assert.ok(i > 0 && j > i);
  const body = app.slice(i, j);
  const mk = ctx => new Function("chatsRef", "characters", body + "\nreturn {crossSamenessHint, crossSamenessBlocklist};")(ctx, []);
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
  assert.match(app, /MOOD_TURN_RULE \+ crossSamenessHint\(charId\)\)\.replace/, "v2 每轮任务");
  assert.match(app, /MOOD_TURN_RULE \+ crossSamenessHint\(charId\) \+ "\\n【输出】/, "旧全量任务串");
  // 群聊不该有这一层，理由要写在代码里
  const why = app.slice(app.indexOf("const CROSS_SAMENESS_WINDOW_MS") - 700, app.indexOf("const CROSS_SAMENESS_WINDOW_MS"));
  assert.match(why, /群聊没有这个问题/);
  assert.match(why, /一次调用写完所有人/);
});
