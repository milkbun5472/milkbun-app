// 她 2026-09-11 一连四条：
//   「过几轮讨论他就忘了我不是作者了」        → 摘要里【谁是作者】那一格是空的
//   「让角色代笔作者的热度也不会动」          → 房里那条路从没碰过 authorHeat
//   「我让王爷写他和皇帝……很容易就接受了这对cp」→ 配的是他自己这件事没人叫他过一遍
//   「其他作者路过点不进她主页」              → 认不认识这位太太，靠模型多填一格 pen
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const fic = R("js/fanfic.js"), app = R("js/app.js");
const Axes = require("../js/axes.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const F_ = strip(fic), A = strip(app);
const grab = name => {
  const i = fic.indexOf("function " + name + "(");
  assert.ok(i > 0, "找不到 " + name);
  let d = 0, j = fic.indexOf("{", i);
  for (let k = j; k < fic.length; k++) { if (fic[k] === "{") d++; else if (fic[k] === "}") { d--; if (!d) { j = k + 1; break; } } }
  return fic.slice(i, j);
};
const STANCE_SRC = fic.slice(fic.indexOf("  const STANCE = {"), fic.indexOf("  function stanceFor("));
const HEAT_SRC = fic.slice(fic.indexOf("  const HEAT = {"), fic.indexOf("  // 抢笔 / 撂挑子"));

const box = {
  Axes: Axes, console: console, personaOf: c => String((c && c.persona) || ""),
  bibleBlock: () => "【本篇设定卡】\n", seedBlock: () => "", BIBLE_TAIL: 14, HOOK_TAIL: 8
};
vm.createContext(box);
vm.runInContext(STANCE_SRC + HEAT_SRC + grab("stanceFor") + grab("stanceFacts")
  + grab("charVoiceTail") + grab("charWriterBlock") + grab("ficRecapForChat")
  + "\nthis.F = { charVoiceTail, charWriterBlock, ficRecapForChat, heatFields, heatNow, HEAT };", box);
const F = box.F;

const nameOf = id => ({ c1: "皇帝", c2: "王爷", c3: "别人" })[id] || id;
const FIC = {
  id: "f1", title: "长篇如果", author: "阿枝", cp: ["c1", "c2"],
  chapters: [
    { content: "一".repeat(300), endHook: "他走了" },
    { content: "二".repeat(300), endHook: "灯灭了", byCharId: "c2", byAuthor: "王爷" }
  ]
};

// ── ① 摘要里得写清谁是作者：她不是 ──────────────────────────────
test("摘要要当面说清【她不是作者】", () => {
  const r = F.ficRecapForChat(FIC, "皇帝 × 王爷", "c2", "Lisa");
  assert.match(r, /这篇的作者是「阿枝」\*\*，不是「Lisa」/, "得点名原作者：" + r.slice(0, 700));
  assert.match(r, /「Lisa」一个字都没写过这篇/, "得说清她没动过笔");
  assert.match(r, /别把她当成作者/);
  assert.match(r, /别说「你写的那一段」/, "把他最容易说错的那句话挡在这儿");
});

test("她真动过笔的时候不许瞎说", () => {
  const hers = Object.assign({}, FIC, { chapters: FIC.chapters.concat([{ content: "三", byMe: true }]) });
  const r = F.ficRecapForChat(hers, "", "c2", "Lisa");
  assert.match(r, /第 3 章是「Lisa」自己动笔写的/);
  assert.ok(r.indexOf("一个字都没写过") < 0, "她写过就不许说她没写过：" + r);
  // 她自己发的那一篇同样不许说成别人的
  const own = Object.assign({}, FIC, { source: "user", author: "Lisa" });
  const r2 = F.ficRecapForChat(own, "", "c2", "Lisa");
  assert.match(r2, /这一篇是「Lisa」自己发的/);
  assert.ok(r2.indexOf("不是「Lisa」") < 0, "作者就是她的时候不许再说「不是她」");
});

test("不传她名字（老调用点）也不炸", () => {
  const r = F.ficRecapForChat(FIC, "", "c2");
  assert.match(r, /这篇的作者是「阿枝」/);
  assert.match(r, /「她」一个字都没写过这篇/, "没名字就用「她」");
});

// ── ② 热度：两条路共用一份 ───────────────────────────────────
test("一章落下去之后的热度只有一份算法", () => {
  assert.equal((F_.match(/function heatFields\(/g) || []).length, 1, "只许定义一处");
  assert.match(A, /Object\.assign\(next, K\.heatFields\(x, \{ by: activeChar \}\)\)/, "房里那一枪要动热度");
  assert.match(A, /charId, \(profile && profile\.name\) \|\| "我"\)\);/, "摘要要收她的名字，不然「她不是作者」那句说不出口");
  assert.match(F_, /Object\.assign\(fic, window\.Fanfic\.heatFields\(fic, \{ grabbed: grabbed, by: by/, "阅读页那颗也走它");
  // ⚠️只钉【一章落下去】这条路：「请她回来」那一处降 25 是另一件事，不走这一份
  const chapPath = F_.slice(F_.indexOf("fic.chapters = (fic.chapters || []).concat([ch]);"), F_.indexOf("fic.updatedAt = Date.now(); return fic;"));
  assert.ok(chapPath.indexOf("fic.heatTs = Date.now();") < 0, "heatTs 不许再单独写一遍——写漏一半比不写更难查");
  assert.match(chapPath, /heatFields/, "这条路上只许剩那一份");
});

test("heatFields：请人代笔往上加，抢回来自己写往下走", () => {
  const base = { authorHeat: 30, heatTs: Date.now() };
  const ghost = F.heatFields(base, { by: { name: "谁" } });
  const own = F.heatFields(base, { grabbed: true, by: { name: "谁" } });
  assert.ok(ghost.authorHeat > 30, "请了人就该涨：" + ghost.authorHeat);
  assert.ok(own.authorHeat < 30, "抢回来自己写该降：" + own.authorHeat);
  assert.ok(ghost.heatTs > 0 && own.heatTs > 0, "时间戳一起交出去，不许只更一半");
  // 房里那一枪传的就是这个形状：by 是个角色对象，一样算「请了人」
  assert.ok(F.heatFields(base, { by: { id: "c2", name: "王爷" } }).authorHeat > 30);
});

// ── ③ 这一篇配的是他自己 ─────────────────────────────────────
test("把他跟别人配成一对：不许一上来就理所当然地写", () => {
  const he = { id: "c2", name: "王爷", persona: "话少" };
  const blk = F.charWriterBlock(he, { id: "f1", cp: ["c2", "c1"] }, null, null, nameOf, "Lisa");
  assert.match(blk, /这一篇配的是你自己/);
  assert.match(blk, /你和「皇帝」/, "得点出对方是谁");
  assert.match(blk, /不许一上来就理所当然地写起来/);
  assert.match(blk, /圈子里嗑这一对的太太的立场，不是当事人的/, "得说破它默认站的是谁的位置");
  assert.match(blk, /这一章照样要写/, "她点了单就得写——不是给他一个不写的出口");
  assert.match(blk, /正文里不许出现你对这件事的说明/, "态度留在字里，不许写成吐槽");
});

test("写的就是他和她、或者跟他没关系的那几篇，不发这一段", () => {
  const he = { id: "c2", name: "王爷", persona: "话少" };
  const withMe = F.charWriterBlock(he, { id: "f1", cp: ["c2", "me"] }, null, null, nameOf, "Lisa");
  assert.ok(withMe.indexOf("这一篇配的是你自己") < 0, "写他和她是另一回事，她没提过就别往上凑");
  const out = F.charWriterBlock(he, { id: "f1", cp: ["c1", "c3"] }, null, null, nameOf, "Lisa");
  assert.ok(out.indexOf("这一篇配的是你自己") < 0, "他不在里面就更不该发");
});

test("接的是故事不是笔迹：前几章的味道不许跟着走", () => {
  const t = F.charVoiceTail({ id: "c2", name: "王爷" }, "清冷克制的短句");
  assert.match(t, /前几章是别人写的/);
  assert.match(t, /不是那个人的笔迹/);
  assert.match(t, /写法不必跟着前几章走/);
  assert.match(t, /设定、前情、人物一个字不许改/, "撤掉的是笔迹，不是设定");
});

// 他交稿那一句得是他说的，不能拿原作者的评论顶
test("他交稿说的那一句另开一格 penNote", () => {
  assert.match(F_, /byChar \? "\\"penNote\\"/, "他执笔时才要这一格");
  assert.match(F_, /你本人的口气，不是作者的/);
  assert.match(F_, /在 penNote 里当面跟她说一句为什么/, "房里商量那一段要指向他自己那一格");
  assert.ok(F_.indexOf("在 authorNote 里当面跟她说一句为什么") < 0, "别再叫他去用原作者那一格");
  assert.match(A, /say: String\(ch\.penNote \|\| ""\)/, "房里那张卡上「他说的」要真是他说的");
  assert.ok(A.indexOf("say: String(ch.authorNote") < 0, "原来那句拿的是原作者的评论");
  // ⚠️救援那条路要跟正路一样全（v66.77 那次就是漏在这儿）
  assert.match(F_, /endHook\|authorNote\|penNote\|facts\|seed\|paid/, "截断救援也得认得这一格");
  assert.match(F_, /penNote: one\("penNote"\)/, "救援要把它抢回来");
  assert.match(F_, /penNote: String\(d\.penNote \|\| ""\)/, "正路也要收");
});

// ── ④ 路过的太太，名字点得进她的主页 ────────────────────────────
test("认哪一位靠查名册，不靠模型多填一格", () => {
  assert.match(F_, /const who = \(pen && roster\[pen\]\) \? pen : \(\(roster\[nm\] \|\| findAuthor\(nm\)\) \? nm : ""\);/,
    "名字在名册或作者库里就算数");
  assert.match(F_, /pen: who,/, "落库时用查出来的那个");
  assert.ok(F_.indexOf("pen: fromRoster ? pen : \"\"") < 0, "非得模型填对才算数的那一版要撤掉");
});

test("楼中楼那一层也点得进去，而且跟楼主共用同一颗按钮", () => {
  assert.match(F_, /pen: \(roster\[rn\] \|\| findAuthor\(rn\)\) \? rn : ""/, "回复里的名字也要查一遍");
  assert.equal((F_.match(/const penName = function \(r, size\)/g) || []).length, 1, "按钮只许有一份");
  assert.match(F_, /penName\(r, 12\)/, "楼主那一行用它");
  assert.match(F_, /penName\(rp, 11\.5\)/, "楼中楼那一行也用它");
  assert.equal((F_.match(/props\.onOpenAuthor\(r\.pen\)/g) || []).length, 1, "跳转只许写一处");
});

test("带刺才记流水这条没被顺手改掉", () => {
  assert.match(F_, /if \(fromRoster && x\.barbed && own\)/, "夸的不记，这条是她定的");
});
