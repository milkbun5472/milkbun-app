// 第一版之后言秋和 gpt 同一轮拉回来的那一次（2026-09-10）。
//
// 言秋那半：prompt 里白纸黑字写着「允许无聊」，模型很听话，于是做出来一台
//   忠实执行「可信的无聊」的收音机——**可信≠想听，第一版只做了前一个**。
//   而且为了循环播不穿帮，明令「每条都要能单独立住」，等于亲手拆了全部钩子。
// gpt 那半：矫枉过正了——完全跟角色无关的内容，再精致也是 NPC 噪音。
//   缺的是中间那一层：「这个世界不是围着我男朋友转，但因为我认识他，
//   所以我听什么都可能联想到他。」
//
// 这一份钉的就是那两条的落点：三个距离、跨天的钩子、以及【不许判定】。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
globalThis.Axes = require("../js/axes.js");
const R = require("../js/radio.js");
const Rd = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = Rd("js/app.js"), ui = Rd("js/radio-ui.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const ST = { id: "s1", name: "甲台", callSign: "JT-1", freq: 92, area: "沿江", habit: "路况", ads: [] };

test("距离由代码掷，不是交给模型自己拿捏", () => {
  // 同一个台同一天问两次一样；换一天就不一样
  assert.deepEqual(R.rollDistances(12, "s1", "d1"), R.rollDistances(12, "s1", "d1"));
  assert.notDeepEqual(R.rollDistances(12, "s1", "d1"), R.rollDistances(12, "s1", "d2"));
  const seg = app.slice(app.indexOf("const genRadioDay"), app.indexOf("const genRadioDrift"));
  assert.match(seg, /const dists = R\.rollDistances\(R\.DAY_ITEMS, st\.id, period\);/);
  assert.ok(strip(seg).indexOf("概率") < 0, "把「他出现的概率是 15%」写进提示词交给模型，它会塌到一边去");
});

test("三档的比例：大头在生活半径，远景保底，痕迹一天一个台最多一条", () => {
  let far = 0, orbit = 0, trace = 0, days = 0, maxTrace = 0;
  for (let d = 0; d < 240; d++) {
    const row = R.rollDistances(12, "s" + (d % 4), "day" + d);
    const t = row.filter(x => x === R.DISTANCE.TRACE).length;
    maxTrace = Math.max(maxTrace, t);
    far += row.filter(x => x === R.DISTANCE.FAR).length;
    orbit += row.filter(x => x === R.DISTANCE.ORBIT).length;
    trace += t;
    if (row.indexOf(R.DISTANCE.FAR) < 0) days++;
  }
  const n = 240 * 12;
  assert.ok(orbit / n > 0.5, "生活半径只占了 " + Math.round(orbit / n * 100) + "%——那一层才是命根子");
  assert.ok(far / n > 0.15 && far / n < 0.4, "远景占了 " + Math.round(far / n * 100) + "%（这一档负责让世界不围着他转）");
  assert.ok(trace / n > 0.02 && trace / n < 0.14, "痕迹占了 " + Math.round(trace / n * 100) + "%");
  assert.equal(maxTrace, 1, "一天一个台冒出 " + maxTrace + " 条痕迹——那不是「诶这个跟他有关」，是蹲男朋友告白");
  assert.equal(days, 0, "有 " + days + " 天一条远景都没有＝整个台都在围着他转，那正是要防的另一头");
});

test("不许判定：痕迹不署名，界面上也永远不标是谁", () => {
  assert.match(R.DISTANCE_RULE, /不署名、不点名、也不在话里暗示「你懂的」/);
  assert.match(R.DISTANCE_RULE, /一旦坐实，它就从「可能是他」变成「系统通知你是他」/);
  // 存的是一串纯句子，没有作者字段——存了作者，界面迟早会把它显示出来
  assert.match(Rd("js/radio.js"), /row\.st\[stId\] = \(Array\.isArray\(items\) \? items : \[\]\)\.map\(S\)\.filter\(Boolean\);/);
  assert.ok(strip(ui).indexOf("authorId") < 0 && strip(ui).indexOf("charId") < 0, "界面上出现了角色身份，那就等于替她判定了");
});

test("生活半径那一档的判据：把那个人删掉，这一条还成立吗", () => {
  assert.match(R.DISTANCE_RULE, /\*\*不要写关于他的内容\*\*/);
  assert.match(R.DISTANCE_RULE, /把那个人整个删掉，这一条还成立吗/);
  assert.match(R.DISTANCE_RULE, /播的人不认识他，也不知道有他这个人/);
  const bed = R.worldBedText({ orbit: ["下午在平江路那家印刷店"] });
  assert.match(bed, /不是让你写他/);
  assert.match(bed, /别整份用完/, "整份用完就成了「今日顾朝行踪播报」");
});

test("「允许无聊」那一句删掉重写了，不是在后面挂个「但是」", () => {
  const f = R.RADIO_FLOOR;
  assert.ok(f.indexOf("允许无聊") < 0, "那一句还在——模型很听话，它会照做");
  assert.ok(f.indexOf("电台大部分时间是无聊的") < 0);
  assert.match(f, /每一条都得有一个具体的东西/);
  assert.match(f, /平淡可以，空转不行/);
});

test("钩子：同一天里不许前后咬死，跨天必须接得上", () => {
  const t = R.buildScheduleInstruction(ST, Date.now(), { names: [] }, {}, null, "");
  assert.match(t, /同一天里的几条之间不许前后咬死/);
  assert.match(t, /跨天是可以接的、而且该接/, "一刀切「每条都要能单独立住」等于把全部钩子一起拆了");
  assert.match(t, /thread：今天播完，这个台手上还悬着、明天该有下文的那件事/);
  assert.match(t, /没有就留空字符串，别为了交这个字段硬造一件事/);
  assert.match(R.scheduleSchemaHint, /"thread"/);
  // 昨天悬着的那件事今天要接着走
  const t2 = R.buildScheduleInstruction(ST, Date.now(), { names: [] }, {}, null, "码头那批货是谁的");
  assert.match(t2, /【你手上还悬着这件事】码头那批货是谁的/);
  assert.match(t2, /别原地把昨天那句重说一遍/);
  assert.ok(t.indexOf("【你手上还悬着这件事】") < 0, "没悬着东西的时候发了一段空的");
  // 存得回去
  const seg = app.slice(app.indexOf("const genRadioDay"), app.indexOf("const genRadioDrift"));
  assert.match(seg, /R\.patchStation\(st\.id, \{ thread: String\(d\.thread \|\| ""\)/, "拿回来的 thread 没存＝明天还是从零开始");
  assert.match(seg, /st\.thread/, "昨天那件事没喂回去");
});

test("料是现成的：行程、论坛、一起听、匿名箱", () => {
  const seg = app.slice(app.indexOf("const radioBed = () =>"), app.indexOf("const radioAsk"));
  assert.match(seg, /schedulesRef\.current/, "行程是他真的去过哪儿、做了什么——生活半径最强的那一份");
  assert.match(seg, /plans\[k\] \|\| \{\}\)\.seqs/, "字段名得照 saveSchedDay 那段抄");
  assert.match(seg, /forumPostsRef\.current/);
  assert.match(seg, /listenRef\.current \|\| \{\}\)\.songs/);
  assert.match(seg, /anonPool \|\| \[\]\)\.slice\(-8\)/);
  assert.match(seg, /loreForContext\("creative", \[\], ""\)/);
  assert.ok(seg.indexOf("worlds") < 0, "架空世界是跑团的平行时空，接进来会把电台搬去另一个世界");
});

test("人名一条都不许上电台——整条丢掉，不是抠掉名字留残句", () => {
  const seg = app.slice(app.indexOf("const radioBed = () =>"), app.indexOf("const radioAsk"));
  assert.match(seg, /const clean = v => \{ const x = T\(v\); return \(x && !names\.some\(n => x\.indexOf\(n\) >= 0\)\) \? x : ""; \};/);
  assert.match(seg, /\(characters \|\| \[\]\)\.forEach\(c => \{ if \(c\) \{ addName\(c\.name\); addName\(c\.remark\); \} \}\)/,
    "只滤主角不滤 NPC，NPC 的名字照样会被念出来");
  assert.match(seg, /addName\(userName\(profile\)\)/, "她自己的名字也不许上电台");
  assert.ok(seg.indexOf("replace(n,") < 0, "把名字抠掉留下一个残句，比整条不要更糟");
});

test("临时台故意不掷距离——差异要写着理由，不能是忘了", () => {
  const t = R.buildDriftInstruction(R.rollAxes("x"), 98.7, { names: [] }, { orbit: ["平江路"] });
  assert.ok(t.indexOf("三个距离") < 0, "漂移台也掷距离的话，一台飘过来的收音机凭什么知道这儿住着谁");
  const src = Rd("js/radio.js");
  assert.match(src, /临时台\*\*故意不掷三个距离\*\*（不是漏）/, "差异没写理由，下次查缺时会被当成漏掉的那一处补上");
});

test("seed01 收尾那三步不许省", () => {
  // FNV 只跑到最后一步的话，只有末字不同的两串算出来的数是挨着的（0.289/0.293/0.281），
  // 而这个文件里到处都是「按序号掷」——第几条、第几个字、第几圈。
  const xs = [];
  for (let i = 0; i < 24; i++) xs.push(R.seed01("s1", "day1", "dist", i));
  let near = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - xs[i - 1]) < 0.05) near++;
  assert.ok(near <= 4, "相邻序号有 " + near + " 对算出来几乎一样——掷出来的不是分布，是一条缓慢爬行的线");
  const lo = xs.filter(x => x < 0.34).length, hi = xs.filter(x => x > 0.66).length;
  assert.ok(lo >= 4 && hi >= 4, "24 个数全挤在中间一档（低 " + lo + " 高 " + hi + "）");
  assert.match(Rd("js/axes.js"), /h \^= h >>> 16; h = Math\.imul\(h, 2246822507\);/);  // 搬去公共那一层了
});
