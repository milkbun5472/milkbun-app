// 情书回信接上聊天那套按轮提醒（她 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
test("回信前看他上一次回信的收尾、最近几次反复说到的；往来里她标「她：」不标「我：」", () => {
  assert.match(app, /tailHintsFor\(_last\[_last\.length - 1\], _last\.join\("\\n"\)\)/);
  assert.match(app, /beatEchoTail\(_mine\.map\(x => x\.join\("\\n"\)\), \{ lead: "你前两次回信"/);
  assert.match(app, /\+ \(context \|\| ""\) \+ letterTail,/);
  assert.match(scr, /\(r\.authorId === "user" \? "她：" : partner\.name \+ "："\)/);
  assert.match(app, /\(threadText \|\| ""\) \+ "\\n她：" \+ c/);
});
test("beatEchoTail 换个说法照样点名，不给 how 时跟原来一样", () => {
  const fl = eng.match(/const THOUGHT_ECHO_FILLER = [^\n]+/)[0];
  const body = fl + "\n" + eng.slice(eng.indexOf("function echoCandidates"), eng.indexOf("// 拿身份当每拍的对照组"));
  const f = new Function(body + "return beatEchoTail;")();
  const a = "反正两百万和琴全砸进来了 这辈子你得负责到底 听到没", b = "某人两百万都砸了 你得负责到底 两个人绑在一块 听到没";
  assert.match(f([a, b], { lead: "你前两次回信", tail: "这一次别再绕回这些。" }), /你前两次回信都说到了「两百万」「听到没」/);
  assert.match(f([a, b]), /^\n〔正文：前两拍都写到了/);
});
