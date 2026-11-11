const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/games.js", "utf8");
const grab = n => { const i = src.indexOf("function " + n + "("); let d = 0; for (let k = src.indexOf("{", i); k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && !--d) return src.slice(i, k + 1); } };
const line = n => { const i = src.indexOf(n); return src.slice(i, src.indexOf(";\n", i) + 2); };
const match = new Function(line("const TD_ACT_RE") + grab("tdLooksLikeDare") + grab("tdLooksLikeTruth") + grab("tdPromptMatchesChoice") + "; return tdPromptMatchesChoice;")();
test("大冒险：有动作就算，只挡纯提问", () => {
  for (const p of ["学猫叫三声", "给你最近聊天的人发一句我想你了", "发一张现在的自拍", "用最肉麻的语气说晚安", "把头像换成我选的那张"]) assert.ok(match("大冒险", p), p);
  assert.ok(!match("大冒险", "你最近一次哭是什么时候？"));
});
test("真心话：只挡明摆着要现场做动作的", () => {
  assert.ok(match("真心话", "你最想亲谁？"));
  assert.ok(!match("真心话", "现在立刻表演一段舞"));
});
test("她自己出的题不拦；模型出了题就不换成固定那一句", () => {
  const i = src.indexOf("const submitUserAsk = async"); assert.ok(!/tdPromptMatchesChoice/.test(src.slice(i, i + 600)));
  assert.match(src, /if \(!String\(out\.prompt \|\| ""\)\.trim\(\)\) \{   \/\/ 只在压根没出题时补一句/);
});
