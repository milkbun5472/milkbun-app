const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-08-22：「我说看看自拍，有时候会回答：自拍？行，别后悔。明明直接说后部分就行」。
// 回声式开场——把对方刚说的词原样反问一遍再回答。它不添任何东西，只是给真正的回答垫场。

// v55.66 起禁令抽成了共用常量 ECHO_QUESTION_BAN（线上线下同一份），
// 所以这里要【求值】而不是读原文，否则看到的是没插值的 ${...} 占位。
const ONLINE = (() => {
  const g = n => { const i = engine.indexOf("const " + n + " = `"); return engine.slice(i, engine.indexOf("`;", i) + 2); };
  return new Function(g("ECHO_QUESTION_BAN") + "\n" + g("ONLINE_CHAT_RULE_V2") + "\nreturn ONLINE_CHAT_RULE_V2;")();
})();

test("点名这个毛病，并说清它为什么是复述不是反应", () => {
  assert.match(ONLINE, /别把对方刚说的词原样反问一遍再开口/);
  assert.match(ONLINE, /这种回声式开场不是反应，是复述/);
  assert.match(ONLINE, /把对方的话原样退回去一次，什么都没添/);
  // 用她给的原例，模型照着这个形状认最准
  assert.match(ONLINE, /「行，别后悔」本身就是一句完整的回答，前面不需要挂一个「自拍？」/);
});

test("给可判定的检验，而不是再加一句「别反问」", () => {
  assert.match(ONLINE, /【判定】把开头那个反问删掉——句子照样成立、意思一点没少，那它就是回声，删掉/);
});

test("真反问不许被误杀：区别在有没有带进新东西", () => {
  assert.match(ONLINE, /真的没听清、真的意外到要确认一遍、或者你就是在质疑这件事本身，那是真反问，照常用/);
  assert.match(ONLINE, /区别在于它有没有带进新的东西/);
});

test("单聊和群聊都吃得到（共用同一个常量）", () => {
  const m = app.match(/ONLINE_CHAT_RULE_V2\.replace\("([^"]+)", "([^"]+)"\)/);
  assert.ok(m, "群聊那处的改写形状变了，得重新确认这条还在不在");
  assert.match(ONLINE.replace(m[1], m[2]), /别把对方刚说的词原样反问一遍再开口/, "群聊也要带上");
  assert.match(app, /ONLINE_CHAT_RULE_V2 \+ "\\n\\n" \+ REGISTER_FOLLOWS_SCENE/, "单聊");
});

test("只加在线上：线下是叙事散文，对白里的反问由场景决定", () => {
  assert.ok(!/回声式开场/.test(
    engine.match(/const OFFLINE_NARRATIVE_RUNTIME = `([\s\S]*?)`;/)?.[1] || ""),
    "别顺手塞进线下");
});
