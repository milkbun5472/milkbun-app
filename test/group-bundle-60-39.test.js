const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-09-02：「群聊我们不能搞个 bundle 吗，感觉都是拼拼凑凑出来的太乱了」。
// 她说得对，而且这一整轮的 bug 几乎全是这么来的：同一层写在三处，第二第三处没跟上
// （v55.87 / v55.90 / v55.91 / v56.27 / v60.27 通话一条都没有 / v60.34）。
// 每一次都是「拼的时候漏了一项」。

// 把真函数拿出来跑，别 grep 源码：要证的是【它到底吐出哪几层】。
// v60.45 起沙箱收进 test/_group-bans.js 一份共用：原来这儿自己抄了一份、
// 还自己手写一张常量名表，于是 engine 里新加一层就把这个文件整个打崩——
// 上面写的那个病（同一层写在两处、第二处没跟上），这份测试自己也犯了一次。
const GB = require("./_group-bans.js");
const groupBans = GB.layers;

const CORE = ["<ANTI_CLICHE>", "<CB>", "<WORLDBOOK_RULE>", "<CHARCARD_RULE>", "<GROUP_IN_CHARACTER>",
  "<GROUP_USER_IS_PRESENT>", "<CONDESCENDING_TONE_BAN>", "<INTIMATE_CHAT_ANTI_CLICHE>", "<REGISTER_FOLLOWS_SCENE>",
  "<PERSONA_REGISTER_ANCHOR>", "<STOCK_REPLY_BAN>", "<RP>"];

test("三处群共用的那一摞，一层都不许少", () => {
  assert.deepEqual(groupBans({ echo: false }), CORE, "群线上");
  assert.deepEqual(groupBans({ echo: true }), CORE.concat(["<ECHO_QUESTION_BAN>"]), "群通话");
});

test("合法差异是显式传进来的，不是各拼各的", () => {
  const off = groupBans({ narrative: true, mood: true, echo: true, worldbook: true });
  // 线下是叙事正文，另外两条反八股只有它吃得到
  assert.ok(off.indexOf("<INTIMATE_ANTI_CLICHE>") > 0 && off.indexOf("<NARRATIVE_ANTI_CLICHE>") > 0);
  assert.ok(groupBans({ echo: true }).indexOf("<NARRATIVE_ANTI_CLICHE>") < 0, "线上不该吃叙事那两条");
  // 会写心情的那两处才要
  assert.ok(off.indexOf("<MOOD_TURN_RULE>") > 0);
  assert.ok(groupBans({ echo: true }).indexOf("<MOOD_TURN_RULE>") < 0);
  // 没世界书就不发世界书准则（线下原来就是这么门的）
  assert.ok(groupBans({ narrative: true, worldbook: false }).indexOf("<WORLDBOOK_RULE>") < 0);
});

test("三处都真的用了这一份，没有谁还在自己拼", () => {
  assert.match(app, /const system = groupBans\(\{ echo: false \}\) \+ "\\n\\n" \+ groupOnlineRuntime/, "群线上");
  assert.match(app, /const sys = groupBans\(\{ echo: true \}\)\n\s*\+ "\\n\\n这是一个多人"/, "群通话");
  assert.match(eng, /groupBans\(\{ narrative: true, mood: true, echo: true, worldbook: !!\(ctx\.worldbook && ctx\.worldbook\.trim\(\)\) \}\)/, "群线下");
  // 只在群里用的那两条，除了定义就只该出现在 groupBans 里
  const live = s => s.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  ["GROUP_IN_CHARACTER", "GROUP_USER_IS_PRESENT"].forEach(k => {
    const n = (live(eng).match(new RegExp(k, "g")) || []).length + (live(app).match(new RegExp(k, "g")) || []).length;
    assert.equal(n, 2, k + " 还在别处各拼一遍（" + n + " 次）：只该有 1 处定义 + groupBans");
  });
  // 群线上和群通话那两段 system 里，不许再自己拼这几条（单聊线上/线下照旧各有各的，那不归这条管）
  const gOnline = app.slice(app.indexOf("const system = groupBans"), app.indexOf("const system = groupBans") + 3400);
  const gCall = app.slice(app.indexOf("const sys = groupBans"), app.indexOf("const sys = groupBans") + 1600);
  ["REGISTER_FOLLOWS_SCENE", "PERSONA_REGISTER_ANCHOR", "CONDESCENDING_TONE_BAN", "ANTI_CLICHE", "STOCK_REPLY_BAN"].forEach(k => {
    assert.ok(gOnline.indexOf(k) < 0, "群线上又自己拼了 " + k);
    assert.ok(gCall.indexOf(k) < 0, "群通话又自己拼了 " + k);
  });
});

test("群线上的回声禁令别发两遍——它包在 ONLINE_CHAT_RULE_V2 里", () => {
  assert.ok(groupBans({ echo: false }).indexOf("<ECHO_QUESTION_BAN>") < 0);
  assert.match(eng, /群线上把它包在 ONLINE_CHAT_RULE_V2 里了，别发两遍/);
});

test("群线下顺带补上了回声禁令——原来只有代码那一道削回声", () => {
  assert.ok(groupBans({ narrative: true, mood: true, echo: true }).indexOf("<ECHO_QUESTION_BAN>") > 0);
  assert.match(eng, /提示词那一层从来没给过/);
});

test("任务句和输出契约照旧各留各的——那是写着理由的差异", () => {
  const bans = eng.slice(eng.indexOf("function groupBans(opts) {"), eng.indexOf("\n}", eng.indexOf("function groupBans(opts) {")));
  ["只输出 JSON", "输出", "quoteId", "redpacket"].forEach(k =>
    assert.ok(bans.indexOf(k) < 0, "输出契约不该被揉进 groupBans：" + k));
  assert.match(app, /只输出 JSON 数组，按发言先后顺序/, "群线上的契约还在");
  assert.match(app, /只输出 JSON 数组，按发言先后：/, "群通话的契约还在");
});
