// 她 2026-11-02：线下几条心声都扯「十九岁生日」「全栽她手里」。代码数出前两条心声共有的词，下一拍点名；不摆旧心声。
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8");
const F = new Function(eng.slice(eng.indexOf("const THOUGHT_ECHO_FILLER"), eng.indexOf("function spokenLinesOf")) + ";return {thoughtEchoTail, thoughtEchoWords};")();
test("前两条共有的词点名，虚词不算", () => {
  const out = F.thoughtEchoTail(["十九岁生日全栽她手里了，停不下来。", "地下室里，十九岁第一天全栽她手里了。"]);
  assert.match(out, /全栽她手里/); assert.match(out, /十九岁/);
  assert.deepEqual(F.thoughtEchoWords("我就是想她了", "她就是这样"), []);
});
test("只有一条、或者没撞的不发", () => {
  assert.equal(F.thoughtEchoTail(["十九岁生日"]), "");
  assert.equal(F.thoughtEchoTail(["今天好累", "外面下雨了"]), "");
});
test("单人线下、群线下（按人分开数）都接上", () => {
  assert.match(eng, /\(isDigital \? "" : thoughtEchoTail\(/);
  assert.match(eng, /const gThoughtTail = members\.map\(c => c && thoughtEchoTail\([^\n]*m\.senderId === c\.id/);
  assert.equal((eng.match(/gPropTail \+ gThoughtTail \+ /g) || []).length, 2);
});
test("正文：前两拍都刷的景物和她的设定点名", () => {
  const G = new Function(eng.slice(eng.indexOf("const THOUGHT_ECHO_FILLER"), eng.indexOf("function spokenLinesOf")) + ";return {beatEchoTail};")();
  const out = G.beatEchoTail(["头顶白炽灯管滋啦响，马歇尔音箱亮着。平时在事务所算账", "白炽灯管嗡嗡响，马歇尔音箱发沉。在事务所对账"]);
  assert.match(out, /白炽灯管/); assert.match(out, /马歇尔音箱/); assert.match(out, /事务所/);
  assert.match(eng, /propTail \+ \(isDigital \? "" : beatEchoTail\(/);
  assert.equal((eng.match(/gThoughtTail \+ gBeatEchoTail \+ /g) || []).length, 2);
});
