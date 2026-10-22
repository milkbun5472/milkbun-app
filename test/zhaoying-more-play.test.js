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

// 她 2026-10-22「加吧宝宝 九型人格 另一半 心理年龄」：每种结果都有人指着，算得出来
{
  const assert = require("node:assert/strict");
  global.window = global;
  require("../js/zhaoying-core.js");
  const Z = global.Zhaoying;
  const per = id => { const c = {}; Z.byId(id).qs.forEach(q => q.opts.forEach(o => Object.keys(o.s).forEach(k => { c[k] = (c[k] || 0) + 1; }))); return c; };
  const en = per("ennea"); assert.equal(Object.keys(en).length, 9); Object.values(en).forEach(n => assert.equal(n, 6, "九型每型 6 个选项指着"));
  const pa = per("partner"); assert.equal(Object.keys(pa).length, 6); Object.values(pa).forEach(n => assert.ok(n >= 6 && n <= 7));
  const t = Z.byId("mindage");
  assert.equal(Z.resultOf("mindage", t.qs.map(() => 0)).title, "心理年龄 9 岁");
  assert.match(Z.resultOf("mindage", t.qs.map(q => q.opts.length - 1)).title, /^心理年龄 6\d 岁$/);
  assert.match(Z.resultOf("ennea", Z.byId("ennea").qs.map(() => 0)).title, /号 · /);
  // 他做题走的是公共那套 bundle（runProbe voice），不另写一份人设规矩
  const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  assert.match(app, /runProbe\(apiFor\(charId\), ctxFor\(c\), \{ voice: true, tag: "zhaoying", instruction: Z\.askInstruction/);
}

// 她 2026-10-22「这张卡好丑修一修」：聊天卡跟照影封面用同一份颜色表，不另写一份
{
  const assert = require("node:assert/strict");
  const fs = require("fs"), path = require("path");
  const core = fs.readFileSync(path.join(__dirname, "../js/zhaoying-core.js"), "utf8"), ui = fs.readFileSync(path.join(__dirname, "../js/zhaoying.js"), "utf8");
  assert.match(core, /function pal\(tt\)/);
  assert.match(core, /const c = pal\(tt\);/);
  assert.match(ui, /const pal = Z\.pal;/);
  assert.ok(!/const PAL = \{/.test(ui), "页面那边不再自己留一份颜色表");
}

// 她 2026-10-22：心声太像分析、做完要在他那边落张卡、MBTI 字母要露出来、接卡那几句别被提示词定死
{
  const assert = require("node:assert/strict");
  const fs = require("fs"), path = require("path");
  const core = fs.readFileSync(path.join(__dirname, "../js/zhaoying-core.js"), "utf8"), app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")]; require("../js/zhaoying-core.js");
  assert.match(global.Zhaoying.resultOf("mbti", global.Zhaoying.byId("mbti").qs.map(() => 1)).title, /^[EI][SN][TF][JP] · /);
  assert.match(core, /它不是给自己下定义，也不是解释你是什么样的人/);
  assert.match(app, /role: "assistant", kind: "zyask"[\s\S]{0,300}srcId: msgId/);
  assert.match(app, /msgId: z\.srcId \|\| m\.id/);
  const hints = app.slice(app.indexOf("const zyDoneHint"), app.indexOf("const peekMemo = (opts.peekPhone"));
  assert.ok(!/认不认|这就会去做|想不想看她的/.test(hints), "不替他定说什么");
}

// 她 2026-10-22：纠结的角色能来回选好几次（最多六下），存的时候也不砍到四下
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")]; require("../js/zhaoying-core.js");
  const Z = global.Zhaoying, t = Z.byId("mbti");
  const steps = [0, 1, 0, 1, 0, 1].map((at, k) => ({ at, think: "第" + (k + 1) + "下" }));
  const a = Z.readAnswers(t, { answers: [{ i: 1, steps }] });
  assert.equal(a.paths[0].length, 6);
  assert.equal(a.picks[0], 1, "最后一下才是选的");
  assert.match(Z.askInstruction(t, "她", [], ""), /最多六下/);
}

// 她 2026-10-22「还是在说把题发过来」：卡和提示里说清题就在卡里；他这一轮说完了才去做
{
  const assert = require("node:assert/strict");
  const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  assert.match(app, /题就在这张卡里，点开就能做/);
  assert.match(app, /题已经整套在这张卡里、就在你手机上，点开就能做，不用她再发/);
  assert.match(app, /laneAbortEnd\("c:" \+ chatKey, _abort\);\n      if \(_zyQueue\) _zyQueue\.forEach\(z => zhaoyingRun/);
  assert.ok(!/opts\.zyAsk\.forEach\(z => zhaoyingRun/.test(app), "不再一开口就去做");
}

// 她 2026-10-22：结果放题目最下面，配一段照这一次怎么选写的评语（同一次调用里写，不多花）
{
  const assert = require("node:assert/strict");
  const fs = require("fs"), path = require("path");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")]; require("../js/zhaoying-core.js");
  const Z = global.Zhaoying, t = Z.byId("mbti");
  assert.match(Z.ASK_SCHEMA, /"review"/);
  assert.match(Z.askInstruction(t, "她", [], ""), /review 是另一件事/);
  assert.equal(Z.readAnswers(t, { answers: [], review: "他第3题改了两回" }).review, "他第3题改了两回");
  const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  assert.equal((app.match(/\.\.\.\(a\.review \? \{ review: a\.review \} : \{\}\)/g) || []).length, 2, "单人和群里做的都存评语");
  const core = fs.readFileSync(path.join(__dirname, "../js/zhaoying-core.js"), "utf8");
  const w = core.slice(core.indexOf("function ZhaoyingWatch"), core.indexOf("function charTestInstruction"));
  assert.ok(w.indexOf('"data-wk": "zyresult"') > w.indexOf("test.qs.map((q, i) =>"), "回放里结果在题目后面");
}

// 她 2026-10-22「要」：看他做的回放页，结果下面也有存成图／收进时刻，跟照影页记录共用同一处
{
  const assert = require("node:assert/strict");
  const fs = require("fs"), path = require("path");
  const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  assert.match(app, /const zhaoyingSaveImage = async \(testId, rec, name\) =>/);
  assert.match(app, /onSaveImage: zhaoyingSaveImage,/);
  assert.match(app, /onSaveImage: \(\) => zhaoyingSaveImage\(zyWatch\.testId, rec/);
  assert.match(app, /onPin: c \? \(\) => zhaoyingPin\(zyWatch\.charId, zyWatch\.testId, rec\) : null/);
}
