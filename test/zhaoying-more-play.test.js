// 她 2026-10-22「2345可以 5也可以存进时刻」：他给你出题、换个处境再做、一个群一起做、结果存成图／收进时刻
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "../js", f), "utf8");
const core = rd("zhaoying-core.js"), ui = rd("zhaoying.js"), app = rd("app.js"), ts = rd("theme-studio.js");
// 处境：一路带到提示词和记录
assert.match(core, /function askInstruction\(test, meName, prev, scene, author, lie(, charId)?\)/);
assert.match(app, /const zhaoyingAsk = \(charId, testId, scene, guess, lie\) =>/);
assert.match(app, /Z\.askInstruction\(test, userName\(profileFor\(charId\)\), Z\.recordsOf\(charId, testId\), scene, zyAuthor\(test, charId\), !!\(row\.zy \|\| \{\}\)\.lie(, charId)?\)/);
assert.match(app, /\.\.\.\(scene \? \{ scene \} : \{\}\)[^\n]*\}\);\n      patch\(\{ status: "done"/);
// 他出题：用他的线路和上下文，存成带 by 的题；by 不被 cleanTest 丢掉
assert.match(core, /\.\.\.\(t\.by \? \{ by: String\(t\.by\) \} : \{\}\)/);
assert.match(app, /const zhaoyingCharGen = async \(charId, mode\) =>[\s\S]{0,300}runProbe\(apiFor\(charId\), ctxFor\(c\)/);
// 群一起做：卡先落进群，等她按叶子才做（zhaoyingGroupKick 挂在 replyGroup 开头）；每个人的回放都看过他们才接着聊（她 2026-10-24）
assert.match(app, /const zhaoyingGroupRun = async \(groupId, testId, onStep, lie\) =>/);
assert.match(app, /if \(!rgOpts\.auto\) zhaoyingGroupKick\(groupId\);/);
assert.match(app, /if \(all\) setTimeout\(\(\) => \{ try \{ replyGroup\(w\.groupId, \{\}\); \} catch/);
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

// 她 2026-10-22「搞个分类」+ 新加四套：每套都落在一类里；新题各结果都有选项指着；分类是圆镜不是药丸
{
  const assert = require("node:assert/strict");
  const fs = require("fs"), path = require("path");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")]; require("../js/zhaoying-core.js");
  const Z = global.Zhaoying;
  Z.TESTS.forEach(t => assert.ok(["xg", "gx", "xl", "wan"].includes(t.cat), t.id + " 有分类"));
  for (const [id, n] of [["fight", 6], ["child", 6], ["jianghu", 6]]) {
    const c = {}; Z.byId(id).qs.forEach(q => q.opts.forEach(o => Object.keys(o.s).forEach(k => { c[k] = (c[k] || 0) + 1; })));
    Object.values(c).forEach(v => assert.equal(v, n, id + " 每种结果 " + n + " 个选项指着"));
  }
  assert.match(Z.resultOf("bigfive", Z.byId("bigfive").qs.map(() => 0)).title, /好奇. · 靠谱. · 外向. · 随和. · 敏感./);
  assert.equal(Z.catOf({ custom: true }), "mine");
  assert.equal(Z.catOf({ custom: true, cat: "gx" }), "gx");
  const ui = fs.readFileSync(path.join(__dirname, "../js/zhaoying.js"), "utf8");
  assert.match(ui, /"data-wk": "zycats", role: "tablist"/);
  assert.match(ui, /saveJSON\("x_zyCat", c\)/);
}

// 她 2026-10-22「继续都慢慢加进去吧」第二批：每套都分了类、每种结果都有同样多的选项指着、算得出来
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")]; require("../js/zhaoying-core.js");
  const Z = global.Zhaoying;
  for (const id of ["disc", "jealous", "secure", "stress", "escape", "color", "movie", "friend"]) {
    const t = Z.byId(id); assert.ok(t && ["xg", "gx", "xl", "wan"].includes(t.cat), id);
    const c = {}; t.qs.forEach(q => q.opts.forEach(o => Object.keys(o.s).forEach(k => { c[k] = (c[k] || 0) + 1; })));
    assert.equal(new Set(Object.values(c)).size, 1, id + " 各结果一样多");
    assert.ok(Z.resultOf(id, t.qs.map(() => 0)).title);
  }
  assert.equal(Z.resultOf("lovebrain", Z.byId("lovebrain").qs.map(() => 3)).title, "恋爱脑指数 100%");
  assert.equal(Z.resultOf("lovebrain", Z.byId("lovebrain").qs.map(() => 0)).title, "恋爱脑指数 0%");
}

// 她 2026-10-22「角色写的我俩都能做也能发给别的角色」「这页的美化顺便做了」
{
  const assert = require("node:assert/strict");
  const fs = require("fs"), path = require("path");
  const rd = f => fs.readFileSync(path.join(__dirname, "../js", f), "utf8");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")]; require("../js/zhaoying-core.js");
  const Z = global.Zhaoying, t = Z.byId("mbti");
  assert.match(Z.askInstruction(t, "她", [], "", { mine: true }), /这套题是你自己当初出给「她」的/);
  assert.match(Z.askInstruction(t, "她", [], "", { name: "顾朝" }), /这套题是「顾朝」出的/);
  assert.match(rd("app.js"), /zyAuthor\(test, charId\), !!/);
  assert.match(rd("app.js"), /zyAuthor\(test, c\.id\), !!lie[,)]/);
  // 美化：照影是一页、挂点在照影那一组；颜色走公共的 pagePalette
  assert.match(rd("core.js"), /zhaoying: "照影"/);
  const ts = rd("theme-studio.js"), gi = ts.indexOf('zh: "照影", pages: Object.freeze(["zhaoying"])');
  assert.ok(gi > 0, "主题工作台有照影这一页");
  const grp = ts.slice(gi, ts.indexOf("})", gi));
  for (const k of ["zypage", "zycats", "zycover", "zyq", "zyopt", "zyresult", "zyreview", "zybyhint"]) assert.match(grp, new RegExp('\\["' + k + '", '), k);
  assert.match(rd("zhaoying-core.js"), /pagePalette\("zhaoying", base\)/);
  assert.match(rd("zhaoying.js"), /const \{ PAPER, INK, FOG, LINE, ACC \} = Z\.colors\(\);/);
}

// 第三批（GPT 单子里好玩的 8 套）：都在「好玩」，每种结果都由同样多的选项指着
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")]; require("../js/zhaoying-core.js");
  const Z = global.Zhaoying;
  for (const id of ["cat", "dog", "weather", "villain", "doom", "fairy", "campus", "hidden"]) {
    const t = Z.byId(id); assert.equal(t.cat, "wan", id);
    const c = {}; t.qs.forEach(q => q.opts.forEach(o => Object.keys(o.s).forEach(k => { c[k] = (c[k] || 0) + 1; })));
    assert.deepEqual([...new Set(Object.values(c))], [6], id + " 各结果 6 个选项");
    assert.ok(Z.resultOf(id, t.qs.map(() => 1)).line);
  }
}

// 第四批：关系 7 套、心里 3 套各自结果均衡；两张清单按「最硬那档 / 看情况」列出来
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")]; require("../js/zhaoying-core.js");
  const Z = global.Zhaoying;
  for (const id of ["jealousreact", "loveview", "breakup", "reunite", "power", "secret", "lovefriend", "moral", "emotion", "defense"]) {
    const t = Z.byId(id); assert.ok(t, id);
    const c = {}; t.qs.forEach(q => q.opts.forEach(o => Object.keys(o.s).forEach(k => { c[k] = (c[k] || 0) + 1; })));
    assert.equal(new Set(Object.values(c)).size, 1, id + " 各结果同样多选项");
    assert.ok(Z.resultOf(id, t.qs.map(() => 0)).line);
  }
  for (const [id, cat] of [["bound", "gx"], ["cant", "xl"]]) {
    const t = Z.byId(id); assert.equal(t.cat, cat); assert.equal(t.list.length, 3);
    const r = Z.resultOf(id, t.qs.map((_, i) => i % 3));
    assert.equal(r.code, "4-4"); assert.match(r.line, new RegExp("^" + t.list[0] + "："));
    assert.match(Z.resultOf(id, t.qs.map(() => 2)).title, /^没有一条是/);
  }
}

// 敲一敲（她 2026-10-23）：她说一句，他认是哪题、可以改选；说的话留在记录里，聊天时他记得评语和这些话
{
  const assert = require("node:assert/strict");
  const fs = require("node:fs"), path = require("node:path");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")]; require("../js/zhaoying-core.js");
  const Z = global.Zhaoying, t = Z.byId("mindage");
  // 题号只认做过的和眼下这题，改选只认那题有的选项
  assert.deepEqual(Z.readTalk(t, { q: 1, say: "嗯", pick: 2 }, 3), { qi: 0, say: "嗯", pick: 1 });
  assert.equal(Z.readTalk(t, { q: 9, say: "嗯", pick: null }, 3).qi, 3);
  assert.equal(Z.readTalk(t, { q: 2, say: "嗯", pick: 99 }, 3).pick, null);
  const ins = Z.talkInstruction(t, "她", { upTo: 2, picks: [0, 1], whys: ["想到小时候", ""], talks: {}, line: "第一题为啥", scene: "喝多了" });
  assert.match(ins, /她刚说：「第一题为啥」/); assert.match(ins, /当时心里：想到小时候/); assert.match(ins, /喝多了/);
  // 聊天时：最近那次带评语、心里那句、题下说的话
  const store = {}; global.loadJSON = (k, d) => k in store ? store[k] : d; global.saveJSON = (k, v) => { store[k] = v; };
  Z.addRecord("c9", { id: "r1", testId: "mindage", ts: Date.now(), picks: t.qs.map(() => 0), whys: t.qs.map(() => "嗯"), title: "T", line: "", review: "评语在这" });
  Z.patchRecord("c9", "r1", { talks: { 0: [{ who: "me", t: "为啥" }, { who: "him", t: "就这样", pick: 1 }] } });
  const note = Z.chatNote("c9");
  assert.match(note, /评语在这/); assert.match(note, /她：为啥 你：就这样（你改选了/); assert.match(note, /Q1「嗯」/);
  // 接线：看他做题那页有敲一敲、存回记录
  const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  assert.match(app, /onTalk: c \? async st =>[\s\S]{0,400}Z\.talkInstruction\(/);
  assert.match(app, /onTalkSave: patch => \{ window\.Zhaoying\.patchRecord\(/);
  assert.match(fs.readFileSync(path.join(__dirname, "../js/zhaoying-core.js"), "utf8"), /noKnock: !p\.onTalk, knockText: "敲一敲"/);
}

// 换个答法（她 2026-10-23）：排序不重排、拍卖凑满 100、回头改最多三题、钓鱼题留着谜底、押中了算徽章
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")];
  const store = {}; global.loadJSON = (k, d) => k in store ? store[k] : d; global.saveJSON = (k, v) => { store[k] = v; };
  require("../js/zhaoying-core.js");
  const Z = global.Zhaoying;
  const rk = Z.byId("rankhurt"), a1 = Z.readAnswers(rk, { answers: [{ i: 1, steps: [{ at: 2 }] }, { i: 2, steps: [{ at: 2 }] }] });
  assert.equal(new Set(a1.picks).size, a1.picks.length, "同一个不排两次");
  assert.equal(Z.resultOf("rankhurt", a1.picks).title, "排第一：背叛");
  const bd = Z.byId("bidlife"), a2 = Z.readAnswers(bd, { answers: bd.qs.map((q, i) => ({ i: i + 1, amt: i < 3 ? 70 : 0, steps: [{ at: 0 }] })) });
  assert.equal(a2.bids.reduce((x, y) => x + y, 0), 100); assert.equal(a2.picks[0], 3, "档照真出的数");
  assert.match(Z.askSchema(bd), /"amt"/); assert.doesNotMatch(Z.askSchema(bd), /revise/);
  const mb = Z.byId("mbti"), a3 = Z.readAnswers(mb, { answers: mb.qs.map((q, i) => ({ i: i + 1, steps: [{ at: 0 }] })), revise: [1, 2, 3, 4].map(i => ({ i, to: 1, why: "嗯" })) });
  assert.equal(a3.revs.length, 3); assert.equal(a3.picks[0], 1); assert.equal(a3.revs[0].from, 0);
  assert.match(Z.askSchema(mb), /revise/);
  assert.match(Z.charTestInstruction("她"), /bait/); assert.match(Z.CHAR_TEST_SCHEMA, /"bait"/);
  const ct = Z.saveCustom({ name: "x", by: "c1", bait: "想不想住一起", qs: [{ q: "a", opts: [{ t: "1" }, { t: "2" }] }] });
  assert.equal(ct.bait, "想不想住一起");
  Z.addRecord("c1", { id: "g1", testId: "rankhurt", ts: 1, picks: a1.picks, guess: 2, title: "t" });
  const bs = Z.badgesOf("c1"); assert.ok(bs.find(b => b.k === "bet").on); assert.ok(!bs.find(b => b.k === "bait").on);
  Z.addRecord("me", { testId: ct.id, ts: 2, picks: [0], title: "" });
  assert.ok(Z.badgesOf("c1").find(b => b.k === "bait").on);
  assert.match(Z.guessLine(rk, { picks: a1.picks, guess: 2 }), /押中了/);
}

// 上下文封顶（她 2026-10-23）：全做完也只有最近 5 套带细节；徽章收成一行，点开才摊开
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")];
  const store = {}; global.loadJSON = (k, d) => k in store ? store[k] : d; global.saveJSON = (k, v) => { store[k] = v; };
  require("../js/zhaoying-core.js");
  const Z = global.Zhaoying;
  Z.allTests().forEach((t, k) => Z.addRecord("c", { testId: t.id, ts: k, picks: t.qs.map(() => 0), whys: t.qs.map(() => "想到那天下午"), title: "结果", review: "评语".repeat(60) }));
  const n = Z.chatNote("c"); assert.ok(n.length < 2000, "全做完也不超过两千字：" + n.length);
  assert.match(n, /更早做过的：/);
  const zy = require("node:fs").readFileSync(require("node:path").join(__dirname, "../js/zhaoying.js"), "utf8");
  assert.match(zy, /"data-wk": "zybadgeline"/); assert.match(zy, /char && badgeOpen \? h\("div", \{ "data-wk": "zybadges"/);
}

// 拍卖不给档（她 2026-10-23「给范围咋算100」「会不会超」）：他没超就原样、可以剩；超了才摊回 100；看他做的那页只画一条和「还剩」
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")]; require("../js/zhaoying-core.js");
  const Z = global.Zhaoying, t = Z.byId("bidlove");
  const a = Z.readAnswers(t, { answers: t.qs.map((q, i) => ({ i: i + 1, amt: i < 3 ? 20 : 0, steps: [{ at: 0 }] })) });
  assert.deepEqual(a.bids.slice(0, 4), [20, 20, 20, 0], "没超就原样，剩 40 不花");
  assert.match(Z.askInstruction(t, "她"), /边出边算手里还剩多少/);
  const core = require("node:fs").readFileSync(require("node:path").join(__dirname, "../js/zhaoying-core.js"), "utf8");
  assert.match(core, /"data-wk": "zybidleft"/);
  const zy = require("node:fs").readFileSync(require("node:path").join(__dirname, "../js/zhaoying.js"), "utf8");
  assert.match(zy, /"data-wk": "zybidme"/); assert.match(zy, /stepBtn\("＋", \(\) => set\(i, 5\), !left\)/);
}

// 又一批答法（她 2026-10-23「1-6都可以」）＋ 做完附一句发回去、做到一半存档
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")];
  const store = {}; global.loadJSON = (k, d) => k in store ? store[k] : d; global.saveJSON = (k, v) => { store[k] = v; };
  require("../js/zhaoying-core.js");
  const Z = global.Zhaoying;
  // 淘汰赛：后面几场的两边是前面赢下来的
  const br = Z.byId("brtype"), pk = br.qs.map((q, i) => i % 2);
  assert.equal(br.qs.length, 15);
  assert.deepEqual(Z.live(br, pk).qs[8].opts.map(o => o.t), ["温柔", "安静"]);
  assert.match(Z.resultOf("brtype", pk).title, /^冠军：/);
  assert.equal(Z.live(br, []).qs[8].opts[0].t, "待定");
  // 滑杆：分数和两头
  assert.equal(Z.resultOf("scbrave", Array(10).fill(4)).title, "胆量 10 / 10");
  // 填空：存他写的，记录里、聊天时都是他写的那句
  const fl = Z.byId("fillme"), a = Z.readAnswers(fl, { answers: fl.qs.map((q, i) => ({ i: i + 1, fill: "句" + i, steps: [{ at: 0 }] })) });
  assert.equal(a.fills[2], "句2"); assert.match(Z.askSchema(fl), /"fill"/); assert.doesNotMatch(Z.askSchema(fl), /revise/);
  assert.equal(Z.answerText(fl, a, 2), "句2");
  // 看图选：每题四块颜色，每种结果各 8 块
  const pc = Z.byId("piccolor"); assert.ok(pc.qs.every(q => q.opts.length === 4 && q.opts.every(o => o.v)));
  assert.match(Z.resultOf("piccolor", Array(8).fill(3)).title, /深夜/);
  // 快问快答：二十题，不回头改
  const qk = Z.byId("quick20"); assert.equal(qk.qs.length, 20); assert.doesNotMatch(Z.askSchema(qk), /revise/);
  // 说谎：题号和真心那个对得上才算；她猜中了算徽章
  const mb = Z.byId("mbti"), b = Z.readAnswers(mb, { answers: mb.qs.map((q, i) => ({ i: i + 1, steps: [{ at: 0 }] })), lie: { i: 2, truth: 1, why: "嗯" } });
  assert.deepEqual(b.lie, { i: 1, truth: 1, why: "嗯" });
  assert.equal(Z.readAnswers(mb, { answers: [], lie: { i: 2, truth: 9 } }).lie, undefined);
  assert.match(Z.askInstruction(mb, "她", [], "", null, true), /故意在其中一题撒谎/); assert.match(Z.askSchema(mb, true), /"lie"/);
  Z.addRecord("c2", { testId: "mbti", ts: 1, picks: b.picks, title: "x", lie: b.lie, lieGuess: 1 });
  assert.ok(Z.badgesOf("c2").find(x => x.k === "liar").on);
  assert.match(Z.chatNote("c2"), /偷偷撒了一题谎[\s\S]*猜中了/);
  // 接线
  const fs = require("node:fs"), path = require("node:path");
  const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8"), zy = fs.readFileSync(path.join(__dirname, "../js/zhaoying.js"), "utf8");
  assert.match(app, /const zhaoyingSendMine = \(charId, testId, rec, note\) =>/);
  assert.match(app, /onLieGuess: i => window\.Zhaoying\.patchRecord\(/);
  assert.match(zy, /props\.onSendMine\(to, tt\.id, r0, note\)/);
  assert.match(fs.readFileSync(path.join(__dirname, "../js/zhaoying-core.js"), "utf8"), /const DRAFT = "x_zyDraft"/); assert.match(zy, /const drafts = Z\.drafts, saveDraft = Z\.saveDraft;/); assert.match(zy, /else saveDraft\(r\.testId, next\)/);
  assert.match(zy, /Z\.optsView\(tt, q, i,/);
}

// 自己出／AI 出／他出的题也能换答法（她 2026-10-23）
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")];
  const store = {}; global.loadJSON = (k, d) => k in store ? store[k] : d; global.saveJSON = (k, v) => { store[k] = v; };
  require("../js/zhaoying-core.js");
  const Z = global.Zhaoying;
  assert.ok(!Z.KINDS.some(k => k[0] === "pic"), "看图选不开放");
  const r = Z.saveCustom({ kind: "rank", name: "r", items: ["a", "b", "c", "d"] }); assert.equal(r.qs.length, 3); assert.equal(Z.resultOf(r.id, [2]).title, "排第一：c");
  assert.equal(Z.saveCustom({ kind: "bracket", items: ["a", "b"] }), null, "淘汰赛不满 16 样存不了");
  assert.equal(Z.saveCustom({ kind: "bracket", items: "abcdefghijklmnop".split("") }).qs.length, 15);
  assert.equal(Z.saveCustom({ kind: "bid", items: ["a", "b", "c"] }).bid, 100);
  const sc = Z.saveCustom({ kind: "scale", scale: "心软", qs: [{ q: "x" }] }); assert.equal(Z.resultOf(sc.id, [4]).title, "心软 10 / 10");
  assert.ok(Z.saveCustom({ kind: "fill", qs: [{ q: "我 ____" }] }).fill);
  assert.equal(Z.saveCustom({ kind: "quick", qs: [{ q: "a", opts: [{ t: "1" }, { t: "2" }, { t: "3" }] }] }).qs[0].opts.length, 2);
  // 改题：条目回到草稿里
  assert.deepEqual(Z.draftOf(r).items, ["a", "b", "c", "d"]); assert.equal(Z.draftOf(r).kind, "rank");
  // 普通算分题不受影响
  const p = Z.saveCustom({ scored: true, results: [{ title: "A" }, { title: "B" }], qs: [{ q: "q", opts: [{ t: "x", r: 1 }, { t: "y", r: 0 }] }] });
  assert.equal(Z.resultOf(p.id, [0]).title, "B");
  // 他出题时自己挑答法
  assert.match(Z.charTestInstruction("她"), /答法由你挑，写在 kind/); assert.match(Z.CHAR_TEST_SCHEMA, /"kind"/);
  const fs = require("node:fs"), path = require("node:path");
  assert.match(fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8"), /genTest\(p, theme, count, scored, kind\)/);
  assert.match(fs.readFileSync(path.join(__dirname, "../js/zhaoying.js"), "utf8"), /"data-wk": "zykind"/);
}

// 出题页是一张卷子（她 2026-10-23「这个页面 ui 也还是简陋啊」）：题型卡不是一排药丸；卷面、收卷都在
{
  const assert = require("node:assert/strict");
  const zy = require("node:fs").readFileSync(require("node:path").join(__dirname, "../js/zhaoying.js"), "utf8");
  const a = zy.indexOf("// ── 出题／改题 ──"), b = zy.indexOf("// ── 正在做 ──"), ed = zy.slice(a, b);
  assert.match(ed, /"data-wk": "zykind", role: "tablist"/); assert.doesNotMatch(ed, /pill\(K === k/);
  assert.match(ed, /"data-wk": "zypaper"/); assert.match(ed, /const mini = k =>/); assert.match(ed, /"收 卷"/);
}

// 他出通用题＋去重（她 2026-10-23）：通用题不写你们俩、没有钓鱼；出题前都看得到已有的题，他自己出过的单列
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")];
  const store = {}; global.loadJSON = (k, d) => k in store ? store[k] : d; global.saveJSON = (k, v) => { store[k] = v; };
  require("../js/zhaoying-core.js");
  const Z = global.Zhaoying;
  Z.saveCustom({ name: "他的旧题", sub: "想知道你怕不怕黑", by: "c1", qs: [{ q: "a", opts: [{ t: "1" }, { t: "2" }] }] });
  const o = Z.charTestInstruction("她", "open", "c1"), me = Z.charTestInstruction("她", "", "c1");
  assert.match(o, /谁拿到都能做/); assert.match(o, /题里不写你和她之间的事/); assert.match(o, /bait 留空/);
  assert.match(o, /你以前出过：「他的旧题」（想知道你怕不怕黑）/); assert.match(me, /你以前出过：「他的旧题」/); assert.match(me, /最不能接受排序/);
  const t = Z.saveCustom({ name: "x", by: "c1", open: true, bait: "秘密", qs: [{ q: "a", opts: [{ t: "1" }, { t: "2" }] }] });
  assert.equal(t.open, true); assert.equal(t.bait, undefined);
  const fs = require("node:fs"), path = require("node:path");
  assert.match(fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8"), /Z\.charTestInstruction\(userName\(profileFor\(charId\)\), mode, charId, kind, !hasPref\)/);
  const zy = fs.readFileSync(path.join(__dirname, "../js/zhaoying.js"), "utf8");
  assert.match(zy, /props\.onCharGen\(c\.id, genMode\)/); assert.match(zy, /"data-wk": "zygenmode"/);
  assert.match(fs.readFileSync(path.join(__dirname, "../js/zhaoying-core.js"), "utf8"), /async function genTest[\s\S]{0,900}avoidNote\(""\)/);
}

// 互相发结果（她 2026-10-23）：任何一套都能发给任何人；他也做过就是并排对照；发过的他聊天时记得
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")];
  const store = {}; global.loadJSON = (k, d) => k in store ? store[k] : d; global.saveJSON = (k, v) => { store[k] = v; };
  require("../js/zhaoying-core.js");
  const Z = global.Zhaoying;
  Z.addRecord("me", { id: "m1", testId: "mbti", ts: 1, picks: [0], title: "INFP · 心里有片海的理想派" });
  assert.equal(Z.chatNote("c7"), "");
  Z.patchRecord("me", "m1", { sentTo: ["c7"] });
  assert.match(Z.chatNote("c7"), /她做完发给你看过的：「MBTI[^」]*」.*测出「INFP/);
  const fs = require("node:fs"), path = require("node:path");
  const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  assert.match(app, /咱俩每题对一对/); assert.match(app, /Z\.patchRecord\("me", rec\.id, \{ sentTo:/);
  const zy = fs.readFileSync(path.join(__dirname, "../js/zhaoying.js"), "utf8");
  assert.match(zy, /"data-wk": "zysendbox"/); assert.doesNotMatch(zy, /run\.done && run\.mode === "me" && tt\.by && props\.onSendMine/);
}

// 评语说人话；猜完谎，他自己那句亮出来并滚过去（她 2026-10-23）
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")]; require("../js/zhaoying-core.js");
  const Z = global.Zhaoying, ins = Z.askInstruction(Z.byId("moral"), "她");
  assert.match(ins, /用大白话跟她讲讲你这个人/); assert.doesNotMatch(ins, /口气是测试页面的口气/);
  const core = require("node:fs").readFileSync(require("node:path").join(__dirname, "../js/zhaoying-core.js"), "utf8");
  assert.match(core, /"data-wk": "zyliewhy"/); assert.match(core, /lieRef\.current\.scrollIntoView/);
}

// 补漏（她 2026-10-23「1-6做了吧」）：大家怎么选照答法排、删题清存档、她发的卡点开是回放、群里能撒谎
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")];
  const store = {}; global.loadJSON = (k, d) => k in store ? store[k] : d; global.saveJSON = (k, v) => { store[k] = v; };
  require("../js/zhaoying-core.js");
  const Z = global.Zhaoying;
  const fl = Z.byId("fillme"), bd = Z.byId("bidlife"), br = Z.byId("brtype"), mb = Z.byId("mbti");
  assert.deepEqual(Z.spreadOf(fl, [{ name: "甲", rec: { fills: ["怕黑"] } }, { name: "乙", rec: { fills: [] } }]).rows[0].lines, ["甲：怕黑", "乙：（空着）"]);
  const sb = Z.spreadOf(bd, [{ name: "甲", rec: { bids: [60] } }, { name: "乙", rec: { bids: [10] } }]); assert.equal(sb.rows[0].spread, 50); assert.equal(sb.rows[0].lines[0], "甲 60 枚");
  assert.match(Z.spreadOf(br, [{ name: "甲", rec: { picks: br.qs.map(() => 0) } }]).head[0], /甲 的冠军：温柔/);
  assert.equal(Z.spreadOf(mb, [{ name: "甲", rec: { picks: [0] } }, { name: "乙", rec: { picks: [1] } }]).rows[0].spread, 2);
  const t = Z.saveCustom({ name: "x", qs: [{ q: "a", opts: [{ t: "1" }, { t: "2" }] }] });
  Z.saveDraft(t.id, { picks: [0], whys: [], step: 1 }); assert.ok(Z.drafts()[t.id]);
  Z.delCustom(t.id); assert.equal(Z.drafts()[t.id], undefined, "删题时存档一起清");
  const fs = require("node:fs"), path = require("node:path");
  const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8"), core = fs.readFileSync(path.join(__dirname, "../js/zhaoying-core.js"), "utf8"), zy = fs.readFileSync(path.join(__dirname, "../js/zhaoying.js"), "utf8");
  assert.match(app, /she: true, charId: "me", recId: rec\.id/); assert.match(app, /z\.she \? \{ replay: true \}/);
  assert.match(app, /const sp = Z\.spreadOf\(test, done\.map/); assert.match(app, /每个人都偷偷撒了一题谎/);
  assert.match(core, /const she = !ask && z\.she;/);
  assert.match(core, /if \(rec\.react\) add\(/); assert.match(core, /if \(test\.bid && rec\.bids\) rec\.bids\.map/); assert.match(core, /if \(rec\.lie && rec\.lieGuess != null\)/);
  assert.match(zy, /"data-wk": "zygrouplie"/); assert.match(zy, /"data-wk": "zycomparebar"/); assert.match(zy, /const sp = Z\.spreadOf\(test, ids\.map/);
}

// 取舍／打分／连线（她 2026-10-23）＋他的出题偏好：照分抽，带保底
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")];
  const store = {}; global.loadJSON = (k, d) => k in store ? store[k] : d; global.saveJSON = (k, v) => { store[k] = v; };
  require("../js/zhaoying-core.js");
  const Z = global.Zhaoying;
  for (const id of ["trdevil", "trpawn", "trredo", "stday", "sthard", "stlife", "lkpeople", "lkanimal", "lkplace"]) assert.ok(Z.byId(id).qs.length >= 8, id);
  assert.equal(Z.resultOf("trdevil", [0, 0, 1]).title, "换了 2 样");
  assert.match(Z.resultOf("sthard", Array(10).fill(4)).title, /难开口 5\.0 星/);
  const lk = Z.byId("lkpeople"); assert.equal(Z.kindOf(lk), "link"); assert.match(Z.askSchema(lk), /放在这一格的人/);
  assert.match(Z.askInstruction(lk, "她"), /这一套是连线/); assert.doesNotMatch(Z.askInstruction(lk, "她"), /这一套是填空/);
  ["trade", "star", "link"].forEach(k => assert.ok(Z.KINDS.some(x => x[0] === k), k));
  assert.deepEqual(Z.saveCustom({ kind: "trade", trade: ["要", "不要"], qs: [{ q: "x" }] }).trade, ["要", "不要"]);
  // 偏好：没设过就不抽；设过以后 40 次里每种都轮到过，最爱的那种最多
  assert.equal(Z.drawKind("c"), null);
  Z.setPref("c", { choice: 2, quick: 0, scale: 1, fill: 9, rank: 3, bid: 0, bracket: 0, trade: 10, star: 2, link: 5 });
  const cnt = {}; let seed = 7; for (let i = 0; i < 40; i++) { seed = (seed * 9301 + 49297) % 233280; const k = Z.drawKind("c", seed / 233280); cnt[k || "choice"] = (cnt[k || "choice"] || 0) + 1; Z.noteKind("c", k); }
  assert.equal(Object.keys(cnt).length, 10, JSON.stringify(cnt));
  assert.ok(cnt.trade >= 3 && cnt.trade >= cnt.quick, JSON.stringify(cnt));
  assert.match(Z.charTestInstruction("她", "", null, "star"), /这一次的答法是「打分」，kind 写 star/);
  assert.match(Z.charTestInstruction("她", "", null, null, true), /pref 给这几种答法各打一个 0 到 10 的分/);
  const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "../js/app.js"), "utf8");
  assert.match(app, /const hasPref = !!Z\.prefOf\(charId\), kind = hasPref \? Z\.drawKind\(charId\) : null;/);
  assert.match(app, /if \(t\) Z\.noteKind\(charId, Z\.kindOf\(t\)\)/);
}

// 动物塑一视同仁（群友 2026-10-23「好几个狗男测出来都是兔子」）：每个选项只算一种，六种各 6 个
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")]; require("../js/zhaoying-core.js");
  const t = global.Zhaoying.byId("animal"), c = {};
  t.qs.forEach(q => q.opts.forEach(o => { assert.equal(Object.keys(o.s).length, 1, q.q + "／" + o.t); Object.keys(o.s).forEach(k => { c[k] = (c[k] || 0) + 1; }); }));
  assert.deepEqual(Object.keys(c).sort(), ["Be", "Ca", "Do", "Fo", "Ra", "Wo"]); assert.deepEqual([...new Set(Object.values(c))], [6]);
}

// 内置题一视同仁（群友 2026-10-23）：按票数定结果的那些，每种结果的选项一样多；依恋是两条线各看过线没有，不算
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")]; require("../js/zhaoying-core.js");
  // 比的是「随手乱选时落到它的机会」：每个选项算 1／这一题的选项数（三选一的选项比四选一的值钱，光数个数不够）
  global.Zhaoying.TESTS.filter(t => t.id !== "attach").forEach(t => {
    const c = {}; t.qs.forEach(q => q.opts.forEach(o => Object.keys(o.s || {}).forEach(k => { c[k] = (c[k] || 0) + o.s[k] / q.opts.length; })));
    const v = Object.values(c); if (v.length) assert.ok(Math.max(...v) - Math.min(...v) < 1e-9, t.id + " " + JSON.stringify(c));
  });
  // 平票不再让表里排第一的白捡（群友「狗测出来都是金毛」）：同一份答卷结果不变，乱选几千次各种都差不多
  const Z = global.Zhaoying, dog = Z.byId("dog"), cnt = {};
  let seed = 11; for (let n = 0; n < 6000; n++) { const p = dog.qs.map(q => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed >>> 16) % q.opts.length; }); const k = Z.resultOf("dog", p).code; cnt[k] = (cnt[k] || 0) + 1; }
  const v = Object.values(cnt); assert.equal(v.length, 6); assert.ok(Math.max(...v) / Math.min(...v) < 1.3, JSON.stringify(cnt));
  const p0 = dog.qs.map(() => 0); assert.equal(Z.resultOf("dog", p0).code, Z.resultOf("dog", p0.slice()).code);
}

// 两头打平也掷签（她 2026-10-23）：MBTI、三观不再平了就给前一个字母
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")]; require("../js/zhaoying-core.js");
  const Z = global.Zhaoying;
  for (const id of ["mbti", "values"]) {
    const t = Z.byId(id), c = {}; let seed = 5;
    for (let n = 0; n < 4000; n++) { const p = t.qs.map(q => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed >>> 16) % q.opts.length; }); Z.resultOf(id, p).code.split(id === "mbti" ? "" : "-").forEach(k => { c[k] = (c[k] || 0) + 1; }); }
    t.axes.forEach(([a, b]) => assert.ok(Math.max(c[a], c[b]) / Math.min(c[a], c[b]) < 1.15, id + " " + a + b + " " + JSON.stringify(c)));
  }
}

// 所有按票数出结果的内置题：乱选几千次，各结果出现次数相差不到两成（她 2026-10-23「还有别的要改的吗」）
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")]; require("../js/zhaoying-core.js");
  const Z = global.Zhaoying; let seed = 99;
  const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed >>> 16) % n; };
  Z.TESTS.filter(t => !["attach", "mindage", "lovebrain", "mbti", "values", "bigfive"].includes(t.id) && !(t.list || t.fill || t.bid || t.rank || t.bracket || t.scale || t.star || t.trade || t.quick)).forEach(t => {
    const c = {}; for (let n = 0; n < 6000; n++) { const k = (Z.resultOf(t.id, t.qs.map(q => rnd(q.opts.length))) || {}).code; c[k] = (c[k] || 0) + 1; }
    const v = Object.values(c); assert.ok(Math.max(...v) / Math.min(...v) < 1.2, t.id + " " + JSON.stringify(c));
  });
}

// AI 出算分题要配平；自己出的算分题平票掷签；编辑页看得到配得平不平（她 2026-10-23）
{
  const assert = require("node:assert/strict");
  global.window = global; delete require.cache[require.resolve("../js/zhaoying-core.js")];
  const store = {}; global.loadJSON = (k, d) => k in store ? store[k] : d; global.saveJSON = (k, v) => { store[k] = v; };
  require("../js/zhaoying-core.js");
  const Z = global.Zhaoying, fs = require("node:fs"), path = require("node:path");
  assert.match(fs.readFileSync(path.join(__dirname, "../js/zhaoying-core.js"), "utf8"), /配分要公平：每道题的几个选项各指向不同的结果/);
  const t = Z.saveCustom({ name: "x", scored: true, results: [{ title: "A" }, { title: "B" }], qs: [{ q: "1", opts: [{ t: "a", r: 0 }, { t: "b", r: 1 }] }, { q: "2", opts: [{ t: "a", r: 0 }, { t: "b", r: 1 }] }] });
  const c = {}; [[0, 1], [1, 0]].forEach(p => { for (let n = 0; n < 1; n++) { const r = Z.resultOf(t.id, p).title; c[r] = (c[r] || 0) + 1; } });
  assert.deepEqual(Z.scoreBalance(t), [1, 1]);
  assert.deepEqual(Z.scoreBalance({ results: [{}, {}], qs: [{ opts: [{ t: "a", r: 0 }, { t: "b", r: 0 }] }] }), [1, 0]);
  assert.match(fs.readFileSync(path.join(__dirname, "../js/zhaoying.js"), "utf8"), /"data-wk": "zybalance"/);
}
