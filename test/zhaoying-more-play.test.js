// 她 2026-10-22「2345可以 5也可以存进时刻」：他给你出题、换个处境再做、一个群一起做、结果存成图／收进时刻
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "../js", f), "utf8");
const core = rd("zhaoying-core.js"), ui = rd("zhaoying.js"), app = rd("app.js"), ts = rd("theme-studio.js");
// 处境：一路带到提示词和记录
assert.match(core, /function askInstruction\(test, meName, prev, scene\)/);
assert.match(app, /const zhaoyingAsk = \(charId, testId, scene\) =>/);
assert.match(app, /Z\.askInstruction\(test, userName\(profileFor\(charId\)\), Z\.recordsOf\(charId, testId\), scene\)/);
assert.match(app, /\.\.\.\(scene \? \{ scene \} : \{\}\) \}\);\n      patch\(\{ status: "done"/);
// 他出题：用他的线路和上下文，存成带 by 的题；by 不被 cleanTest 丢掉
assert.match(core, /\.\.\.\(t\.by \? \{ by: String\(t\.by\) \} : \{\}\)/);
assert.match(app, /const zhaoyingCharGen = async charId =>[\s\S]{0,300}runProbe\(apiFor\(charId\), ctxFor\(c\)/);
// 群一起做：一人一次，做完发进群让他们聊
assert.match(app, /const zhaoyingGroupRun = async \(groupId, testId, onStep\) =>/);
assert.match(app, /try \{ replyGroup\(groupId, \{\}\); \} catch/);
// 存图、收进时刻走公共的那一处
assert.match(app, /const zhaoyingPin = [\s\S]{0,900}pinToShike\(charId, rows/);
assert.match(core, /function resultImage\(test, rec, name\)/);
// 发答案给出题的他：只落一条她发的，不当场替他开口
const send = app.slice(app.indexOf("const zhaoyingSendMine"), app.indexOf("const phoneSendAsFake"));
assert.ok(!/replyNow|replyGroup/.test(send), "发完等她按回复");
// 挂点登记
for (const k of ["zyscene", "zyscenechip", "zyscenediff", "zyrecacts", "zysendmine", "zygrouprun", "zyspread", "zyby", "zychargen"]) {
  assert.match(ui, new RegExp('"data-wk": "' + k + '"|"' + k + '"\\)'), k + " 挂在页面上");
  assert.match(ts, new RegExp('\\["' + k + '", "'), k + " 登记了");
}
console.log("ok");
