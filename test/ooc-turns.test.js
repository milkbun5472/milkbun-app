// 群友 2026-11-02：OOC 里前面刚指导完、让它改完那段发我，它不记得是哪段。四处 OOC 都带上最近的 OOC 来回。
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8");
const a = eng.indexOf("function oocTurns"), b = eng.indexOf("\n}\n", a) + 3;
const F = new Function("function isOocMsg(m){return !!(m&&m.kind==='ooc');}" + eng.slice(a, b) + ";return oocTurns;")();
test("按一问一答排成多轮，正戏不带，这一问不重复，助手那段给足", () => {
  const long = "改好的那段：" + "字".repeat(1500);
  const msgs = [
    { role: "user", kind: "ooc", content: "这段太油了，改平实点" },
    { role: "char", kind: "ooc", content: long },
    { role: "char", content: "正戏" },
    { role: "user", kind: "ooc", content: "改完那段发我" },
  ];
  const t = F(msgs, "改完那段发我\n\n【背景……】");
  assert.equal(t.length, 2);
  assert.equal(t[0].role, "user"); assert.equal(t[1].role, "assistant");
  assert.equal(t[1].content, long);
});
test("四处都接上，旧的截 300 字那处不留", () => {
  assert.equal((eng.match(/\[\.\.\.oocTurns\(ctx\.oocMsgs, question\), \{ role: "user", content: question \}\]/g) || []).length, 2);
  assert.match(app, /oocCtx\.oocMsgs = chatsRef\.current\[chatKey\]/);
  assert.match(app, /oocMsgs: sess\.msgs \|\| \[\] \}, q\)/);
  assert.equal((app.match(/directives: directives\[groupId\] \|\| \[\], oocMsgs: /g) || []).length, 2);
  assert.doesNotMatch(app, /String\(m\.content \|\| ""\)\.slice\(0, 300\)\)\.join\("\\n"\);\n\s*if \(oocLines\)/);
});
