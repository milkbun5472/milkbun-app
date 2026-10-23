// 她 2026-10-22「2345可以 5也可以存进时刻」：他给你出题、换个处境再做、一个群一起做、结果存成图／收进时刻
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "../js", f), "utf8");
const core = rd("zhaoying-core.js"), ui = rd("zhaoying.js"), app = rd("app.js"), ts = rd("theme-studio.js");
// 处境：一路带到提示词和记录
assert.match(core, /function askInstruction\(test, meName, prev, scene, author\)/);
assert.match(app, /const zhaoyingAsk = \(charId, testId, scene, guess\) =>/);
assert.match(app, /Z\.askInstruction\(test, userName\(profileFor\(charId\)\), Z\.recordsOf\(charId, testId\), scene, zyAuthor\(test, charId\)\)/);
assert.match(app, /\.\.\.\(scene \? \{ scene \} : \{\}\)[^\n]*\}\);\n      patch\(\{ status: "done"/);
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
  assert.match(rd("app.js"), /zyAuthor\(test, charId\)\)/);
  assert.match(rd("app.js"), /zyAuthor\(test, c\.id\)\)/);
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
