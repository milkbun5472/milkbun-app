// 双语规则里「粤语也算外语」只发给粤语/上海话这类角色（群里 2026-10-18：普通话 char 开着双语说起了粤语）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const eng = fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const i = eng.indexOf("function bilingualRule("), j = eng.indexOf("\n}\n", i) + 3;
const rule = new Function(eng.slice(i, j) + "; return bilingualRule;")();
test("普通话角色看不到粤语那一句，粤语角色看得到", () => {
  assert.doesNotMatch(rule("甲", false), /粤语/);
  assert.match(rule("甲", true), /粤语、上海话这类本来就用汉字写的话也算外语/);
});
test("单聊、群聊、通话三处都按这个人的常用语言传", () => {
  assert.match(app, /bilingualRule\("", hanLangOf\(char\)\)/);
  assert.match(app, /bilingualRule\(c\.name, hanLangOf\(c\)\)/);
  assert.match(eng, /bilingualRule\(p\.name, typeof hanLangOf === "function" && hanLangOf\(p\)\)/);
});
