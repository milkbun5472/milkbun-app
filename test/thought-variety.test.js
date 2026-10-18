const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cr = fs.readFileSync(__dirname + "/../js/chat-rooms.js", "utf8");
const a = eng.indexOf("function thoughtVarietyBlock"), src = eng.slice(a, eng.indexOf("\n}\n", a) + 3);
const ctx = {}; vm.runInNewContext(src + "\nthis.f = thoughtVarietyBlock;", ctx);
test("最近三条心声摆出来对照，给判据不给答案", () => {
  assert.equal(ctx.f([]), "");
  const out = ctx.f(["明明是她先点火的", "睡得跟小猪一样", "明明睡着了还哼", "第四条不该出现"]);
  assert.match(out, /· 明明是她先点火的\n· 睡得跟小猪一样\n· 明明睡着了还哼/);
  assert.doesNotMatch(out, /第四条/);
  assert.match(out, /骨架/); assert.match(out, /心声里也一样不许用/);
});
test("单聊线下都经 buildBundle；小房间对照本房自己那几条；隔离房跟着内在状态那一档", () => {
  assert.match(eng, /const tv = thoughtVarietyBlock\(ctx\.recentThoughts\); if \(tv\) parts\.push\(tv\);/);
  assert.match(app, /recentThoughts: \(stateHistRef\.current\[char\.id\] \|\| \[\]\)\.slice\(0, 3\)/);
  assert.match(app, /gated\.recentThoughts = \(\(typeof roomStateHistRef !== "undefined" && roomStateHistRef\.current\[chatKey\]\) \|\| \[\]\)\.slice\(0, 3\)/);
  assert.match(cr, /"aMood", "recentThoughts",/);
});
test("心声定义：四样留着，但不是每句都要交一个打算", () => {
  const TM = (eng.match(/const THOUGHT_MEANING = "([^"]+)";/) || [])[1];
  assert.ok(TM);
  assert.match(TM, /想要的、在意的、藏着的、打算的/);
  assert.match(TM, /不是每句都要落成一个打算/);
});
