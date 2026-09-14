// 第四刀（她 2026-09-14）：双盲秘密盒。
//
// 你俩各往盒里塞一样，**两边都不许先看**，到日子一起打开。
// 这一张是整副奖池里唯一【靠结构、不靠禁令】保证角色不剧透的：
// TA塞的那样东西存着但从不进提示词，模型手上压根没有这个字段。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const K = require(path.join(root, "js/gacha.js"));
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

test("盒子在池子里，而且是 SSR", () => {
  assert.equal(K.byId.x_box.act, "box");
  assert.equal(K.byId.x_box.r, "SSR");
});

test("⚠️结构保证：盒子里的东西一个字都不进任何一处上下文", () => {
  // 存在 x_gachaSeeds。除了读写它自己那几处，全库不许有第二个地方碰它——
  // 尤其不许出现在 ctxFor / buildBundle / runProbe 的料里。
  const hits = app.split("\n").map((l, i) => [i + 1, l])
    .filter(([, l]) => /gachaSeeds/.test(l) && !/^\s*\/\//.test(l));
  hits.forEach(([n, l]) => assert.match(l,
    /useState|gachaSeedsRef|setGachaSeeds|loadJSON\("x_gachaSeeds"|saveJSON\("x_gachaSeeds"/,
    "第 " + n + " 行把种子箱交给了别人：" + l.trim()));
  // 里程碑册那一处确实拿了卡，但只拿【时间和稀有度】，拿不到内容
  const cf = fs.readFileSync(path.join(root, "js/couple-firsts.js"), "utf8");
  const seg = cf.slice(cf.indexOf("D.cards"), cf.indexOf("D.cards") + 400);
  assert.doesNotMatch(seg, /\.result|\.body|\.title/, "里程碑册摸到卡的正文了");
});

test("第一枪不告诉TA她放了什么——双盲不是靠那句禁令，是根本没发", () => {
  const i = app.indexOf('if (card.act === "box") {');
  assert.ok(i > 0);
  const fn = app.slice(i, app.indexOf('if (card.act === "boxOpen")', i));
  assert.match(fn, /GACHA_SSR_ASK\.box_his/);
  assert.doesNotMatch(fn, /instruction:[\s\S]{0,400}\bmine\b/, "第一枪把她放的那句发过去了");
  // 提示词那头也写清楚了它不知道
  const ask = app.slice(app.indexOf("    box_his:"), app.indexOf("    // 双盲秘密盒·第二枪"));
  assert.match(ask, /你不知道对方放了什么/);
  assert.match(ask, /别猜、别写成回应对方的东西/);
});

test("封着的时候卡面上一个字的内容都不露", () => {
  const i = app.indexOf('if (card.act === "box") {');
  const fn = app.slice(i, app.indexOf('if (card.act === "boxOpen")', i));
  // 盖进票根的那一份只有「封上了」那句，两样内容都留在种子箱里
  assert.match(fn, /const stamp = \{ title: "封上了"/);
  assert.doesNotMatch(fn, /gachaStamp\([\s\S]{0,200}his:/, "封着的时候就把他放的写进票根了");
  assert.match(fn, /his: \{ title: String\(d\.title \|\| ""\)\.trim\(\), body: hisBody \}/);
});

test("到日子只解锁，第二枪由她按——不许在后台背着她再调一次", () => {
  assert.match(app, /box: \{ app: "", unlockOnly: true \}/);
  const sw = app.slice(app.indexOf("const gachaSeedSweep = () => {"), app.indexOf("const gachaSeedSweep = () => {") + 1800);
  assert.doesNotMatch(sw, /runProbe/, "到点在后台又打了一枪");
  assert.match(sw, /sd\.kind === "box" \? "box" : "plan"/);
  assert.match(scr, /onRedeem\(\{ \.\.\.card, act: "boxOpen" \}\)/);
  // 防重兑那道闸要放行第二段
  assert.match(app, /card\.act !== "planOpen" && card\.act !== "boxOpen"/);
});

test("打开那一枪才第一次把两样同时给模型", () => {
  const i = app.indexOf('if (card.act === "boxOpen")');
  const fn = app.slice(i, i + 1600);
  assert.match(fn, /【你放进去的】/);
  assert.match(fn, /【对方放进去的】/);
  assert.match(fn, /String\(sd\.mine \|\| ""\)/);
});

test("打开之后两样都摆出来，之前一样都不摆", () => {
  assert.match(scr, /res\.where === "box" && res\.opened \? h\("div"/);
  assert.match(scr, /res\.where === "box" && res\.ready \? h\("button"/);
  // 封着那一行照旧说实话：不是那天自己弹出来的
  assert.match(scr, /res\.where === "box" \? \(res\.opened \? " · 已经一起打开了"/);
  assert.match(scr, /下次打开就看得到/);
});

test("她先写，写了才去问TA（空的不许往下走）", () => {
  assert.match(scr, /card\.act === "box"\s*\n\s*\? h\("button", \{ onClick: \(\) => requestAppPrompt\("你往盒子里放什么？"/);
  assert.match(scr, /if \(!t0\) return; onRedeem\(\{ \.\.\.card, mine: t0 \}\)/);
  assert.match(app, /if \(!mine\) \{ toast\("先写一句你要放进去的"\); return; \}/);
});
