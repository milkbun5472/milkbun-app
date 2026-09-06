// 「这个是九月四号我进了他梦境的内容，不应该被今天6号才被说出来吧」（她 2026-09-06）。
// 病根：这条余味留三天，抬头却写死「你昨晚做的那个梦」——第二天第三天照样说「昨晚」。
// 而且 mode:"tell" 那一支「今天主动提一句」也跟着留三天，于是隔了两天又被挑起来说一遍。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

// 把 dreamEcho 那个闭包抠出来跑（它只依赖 loadJSON / char）
const src = app.slice(app.indexOf("dreamEcho: (() => {"), app.indexOf("directives: directives[char.id]"));
const body = src.slice(src.indexOf("{") + 1, src.lastIndexOf("})(),"));
const run = (seen, now) => {
  const g = { loadJSON: () => ({ c1: seen }), char: { id: "c1" }, Date: { now: () => now } };
  return new Function("loadJSON", "char", "Date", "return (function(){" + body + "})();")(g.loadJSON, g.char, g.Date);
};
const D = 86400000, NOW = new Date(2026, 8, 6, 14, 0).getTime();

test("抬头跟着日子走，不再一律说「昨晚」", () => {
  assert.match(run({ line: "梦见系统说咱俩异地", ts: NOW - 2 * 3600000, mode: "tell" }, NOW), /【你昨晚做的那个梦】/);
  assert.match(run({ line: "梦见系统说咱俩异地", ts: NOW - 1 * D, mode: "tell" }, NOW), /【你前天夜里做的那个梦】/);
  // 她那一张就是这个：9/4 的梦，9/6 还在说
  assert.match(run({ line: "梦见系统说咱俩异地", ts: NOW - 2 * D, mode: "tell" }, NOW), /【你几天前做的那个梦】/);
  assert.ok(run({ line: "x", ts: NOW - 2 * D, mode: "tell" }, NOW).indexOf("昨晚做的") < 0, "隔了两天还在说昨晚");
});

test("隔了夜就不再主动提——值得说的那一下就在醒来那天", () => {
  const d0 = run({ line: "x", ts: NOW - 2 * 3600000, mode: "tell" }, NOW);
  assert.match(d0, /今天找个自然的空当\*\*主动\*\*跟她提一句/, "当天那一支没了");
  const d1 = run({ line: "x", ts: NOW - 1 * D, mode: "tell" }, NOW);
  assert.match(d1, /别主动提起、别复述梦的内容/, "隔了夜还在挑起来说");
  assert.ok(d1.indexOf("主动**跟她提一句") < 0, "隔了夜还留着「主动提」");
  // 半路碎的那一支同理：过了那天也不再开口
  const v1 = run({ line: "x", ts: NOW - 1 * D, mode: "vague" }, NOW);
  assert.ok(v1.indexOf("做了个乱七八糟的梦") < 0, "隔了夜还在说「做了个乱七八糟的梦」");
  // 她自己提起时，说清是哪天的
  assert.match(d1, /说清那是哪天的梦，别说成昨晚/, "她提起时他还是会说成昨晚");
});

test("三天到期照旧；日子的判据写在一处", () => {
  assert.equal(run({ line: "x", ts: NOW - 4 * D, mode: "tell" }, NOW), "", "过期没清掉");
  assert.match(app, /const days = Math\.max\(0, Math\.floor\(\(Date\.now\(\) - \(d\.ts \|\| 0\)\) \/ 86400000\)\);/, "日子算了两遍");
  // ⚠️三支各自说完，不在「主动提」后面挂「不过隔了一天就别」（no-yes-unless）
  assert.match(app, /if \(days >= 1\) return head/, "又写成了「主动提，除非…」");
});
