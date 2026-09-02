const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const rule = eng.slice(eng.indexOf("const GROUP_USER_IS_PRESENT"), eng.indexOf("const GROUP_IN_CHARACTER"));

// 她 2026-09-02：「群聊自己聊起来通常都是开启一些他俩自己的话题我接不上话。。。
// 完全忘记群里还有我了。。。就如果是他俩私聊这种是好的，但是我还在。。。」

test("要的不是禁止他们之间有自己的话——那正是群聊好看的地方", () => {
  assert.match(rule, /那是这个群活着的样子，别收着/);
  assert.match(rule, /你们之间那段来回可以照聊/);
  // 反方向也得管住：别把群聊写成排队向用户汇报
  assert.match(rule, /不是每个人每一句都要转向她/);
  assert.match(rule, /别把群聊写成轮流面向用户发言/);
});

test("给的是可判定的那把尺子，不是一句「要照顾用户」", () => {
  assert.match(rule, /【判定】把她从这个群里整个删掉，这一轮的对话一个字都不用改也照样成立/);
  assert.match(rule, /这一轮里至少有一个人是【对着她】说的/, "没有可执行的下限，等于没说");
});

test("不许在这条里塞具体的示范台词", () => {
  // .claude/rules/prompt-no-content-samples.md：给了例句，每个角色都会照抄那一句
  assert.ok(!/如「|比如「|例如「/.test(rule), "举了例句，那一句会被所有人照抄");
});

test("三处群都挂上了（群线上 / 群线下 / 群通话）", () => {
  assert.match(app, /GROUP_IN_CHARACTER \+ "\\n\\n" \+ GROUP_USER_IS_PRESENT \+ "\\n\\n" \+ CONDESCENDING_TONE_BAN \+ "\\n\\n" \+ REGISTER_FOLLOWS_SCENE \+ "\\n\\n" \+ PERSONA_REGISTER_ANCHOR \+ "\\n\\n" \+ dir/, "群线上");
  assert.match(app, /\+ "\\n\\n" \+ GROUP_IN_CHARACTER \+ "\\n\\n" \+ GROUP_USER_IS_PRESENT \+ "\\n\\n" \+ CONDESCENDING_TONE_BAN/, "群通话");
  assert.match(eng, /"\\n\\n" \+ GROUP_IN_CHARACTER \+\n\s*"\\n\\n" \+ GROUP_USER_IS_PRESENT \+/, "群线下");
  // 1 处定义 + 三处注入；数字变了就核对是新通道接上了还是哪条掉了
  assert.equal((eng.match(/GROUP_USER_IS_PRESENT/g) || []).length +
               (app.match(/GROUP_USER_IS_PRESENT/g) || []).length, 4);
});

test("单聊不发这一条——那儿只有她一个人，没有「把她晾着」这回事", () => {
  const single = app.slice(app.indexOf("const _onlineRuntime"), app.indexOf("const _onlineRuntime") + 400);
  assert.ok(single.indexOf("GROUP_USER_IS_PRESENT") < 0);
});
