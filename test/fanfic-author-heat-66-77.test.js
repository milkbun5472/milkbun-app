// 她 2026-09-11 的③：请枪手之后原作者会怎样。三件事——
//   ① 在最底下发表她对这一章的看法 ② 有几率抢笔回来自己写 ③ 写多了她可能不愿再写
//
// ⚠️**没做成三选一的概率**。纯概率会出现「连着五章一声不吭」或者「第一章就翻脸」，
//   两种都像 bug。做成一根热度线（跟好感度同一个形状），她能一章章感觉到语气在变冲。
// ⚠️谁定什么：代码定【热度多少、跨没跨线、这次抢不抢笔】，模型定【她开口说什么】。
//   热度那个数一个字都不进提示词——进去了它就会照着「愤怒值 78」演。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const fic = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic.js"), "utf8");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const grab = name => {
  const i = fic.indexOf("function " + name + "(");
  assert.ok(i > 0, "找不到 " + name);
  let d = 0, j = fic.indexOf("{", i);
  for (let k = j; k < fic.length; k++) { if (fic[k] === "{") d++; else if (fic[k] === "}") { d--; if (!d) { j = k + 1; break; } } }
  return fic.slice(i, j);
};
const HEATSRC = fic.slice(fic.indexOf("  const HEAT = {"), fic.indexOf("  // 她的脾气有多容易被点着"));
const box = { module: {} };
vm.createContext(box);
vm.runInContext(HEATSRC + grab("temperWeight") + grab("heatNow") + grab("heatAfter") + grab("authorStanceFacts") + grab("authorNoteAsk")
  + "\nconst grabChance = h => (h <= HEAT.GRAB_AT ? 0 : Math.min(0.5, (h - HEAT.GRAB_AT) / 120));"
  + "\nconst refuseChance = h => (h <= HEAT.QUIT_AT ? 0 : Math.min(0.55, (h - HEAT.QUIT_AT) / 60));"
  + "\nconst backChance = h => Math.max(0.15, Math.min(0.7, 0.6 - (h - HEAT.QUIT_AT) / 100));"
  + "\nthis.M = { HEAT, temperWeight, heatNow, heatAfter, authorStanceFacts, authorNoteAsk, grabChance, refuseChance, backChance };", box);
const M = box.M;
// grabChance/refuseChance/backChance 是箭头函数，上面那三行是照源码原样抄的——钉住它别偷偷改
test("那三条概率线照源码原样抄进了这份测试", () => {
  ["const grabChance = h => (h <= HEAT.GRAB_AT ? 0 : Math.min(0.5, (h - HEAT.GRAB_AT) / 120));",
   "const refuseChance = h => (h <= HEAT.QUIT_AT ? 0 : Math.min(0.55, (h - HEAT.QUIT_AT) / 60));",
   "const backChance = h => Math.max(0.15, Math.min(0.7, 0.6 - (h - HEAT.QUIT_AT) / 100));"
  ].forEach(line => assert.ok(fic.indexOf("  " + line) > 0, "源码里这一行改了，测试没跟上：" + line));
});

test("热度是一根线，不是一次掷骰子", () => {
  const now = Date.now();
  let f = { authorHeat: 0, heatTs: now };
  // 连着请枪手：一章比一章高
  const h1 = M.heatAfter(f, "ghost", { now: now });
  f = { authorHeat: h1, heatTs: now };
  const h2 = M.heatAfter(f, "ghost", { now: now });
  assert.ok(h2 > h1 && h1 > 0, "请了两次枪手热度没往上走");
  // 原作者自己写一章就降下来
  f = { authorHeat: h2, heatTs: now };
  assert.ok(M.heatAfter(f, "own", { now: now }) < h2, "她自己写了一章还在涨");
  // 你自己动笔：不算冒犯，也不算讨好
  f = { authorHeat: 40, heatTs: now };
  const mine = M.heatAfter(f, "mine", { now: now });
  assert.ok(mine < 40 && mine > M.heatAfter(f, "own", { now: now }), "你自己写该比她自己写降得少");
  // 封顶封底
  assert.equal(M.heatAfter({ authorHeat: 99, heatTs: now }, "ghost", { now: now }), M.HEAT.CAP);
  assert.equal(M.heatAfter({ authorHeat: 2, heatTs: now }, "own", { now: now }), 0);
});

test("放着不动会自己降——不然她会记恨一辈子", () => {
  const now = Date.now();
  assert.equal(M.heatNow({ authorHeat: 60, heatTs: now }, now), 60);
  const after10 = M.heatNow({ authorHeat: 60, heatTs: now - 10 * 86400000 }, now);
  assert.ok(after10 < 60 && after10 > 0, "十天之后是 " + after10);
  assert.equal(M.heatNow({ authorHeat: 60, heatTs: now - 100 * 86400000 }, now), 0, "降到负数了");
  assert.equal(M.heatNow({ authorHeat: 30 }, now), 30, "没有时间戳的老存档要能读");
});

test("脾气硬的太太涨得更快——temper/sore 那两栏终于派上用场", () => {
  const now = Date.now();
  const f = { authorHeat: 0, heatTs: now };
  const soft = M.heatAfter(f, "ghost", { now: now, by: { temper: "", sore: "" } });
  const hard = M.heatAfter(f, "ghost", { now: now, by: { temper: "有人动她的文她能骂三天，删评拉黑一条龙，绝不私下和解", sore: "她笔下那个人绝不许被写成软弱的样子，谁改她跟谁急" } });
  assert.ok(hard > soft, "护得紧的和无所谓的涨一样多，那两栏就白填了");
  assert.equal(M.temperWeight(null), 0);
  assert.equal(M.temperWeight({ temper: "x".repeat(200), sore: "y".repeat(200) }), 1);
});

test("拿「就这么写」逼原作者是要付代价的", () => {
  const now = Date.now();
  // ⚠️从 0 起算会被地板夹掉（own 是 -18，加不加那 8 点都还是 0），看不出差别
  const f = { authorHeat: 40, heatTs: now };
  assert.ok(M.heatAfter(f, "own", { now: now, hardWant: true }) > M.heatAfter(f, "own", { now: now }),
    "硬要求逼她照写，热度一点不涨＝强扭没有代价");
});

test("三条线各管各的：没到线一次都不会发生", () => {
  assert.equal(M.grabChance(0), 0);
  assert.equal(M.grabChance(M.HEAT.GRAB_AT), 0, "刚到线就可能抢笔＝这根线没意义");
  assert.ok(M.grabChance(M.HEAT.GRAB_AT + 20) > 0);
  assert.ok(M.grabChance(100) <= 0.5, "抢笔概率封顶——不然到后面她每章都抢");
  assert.equal(M.refuseChance(0), 0);
  assert.equal(M.refuseChance(M.HEAT.GRAB_AT + 10), 0, "还没到撂挑子那条线就开始拒绝了");
  assert.ok(M.refuseChance(100) > 0 && M.refuseChance(100) <= 0.55);
  assert.ok(M.HEAT.GRAB_AT < M.HEAT.QUIT_AT, "先会抢笔，再会撂挑子——顺序反了就没有渐进");
  // 请得回来：热度越高越难，但永远留一条缝
  assert.ok(M.backChance(100) >= 0.15, "热度顶格就彻底请不回来＝作者库单向枯竭");
  assert.ok(M.backChance(M.HEAT.QUIT_AT) > M.backChance(100));
});

test("热度那个数一个字都不进提示词，进去的是【事实】", () => {
  const f = { author: "青梅", chapters: [{}, { byAuthor: "老陈" }, { byAuthor: "老陈" }] };
  const txt = M.authorStanceFacts(f, { hardWant: true });
  assert.match(txt, /一共 3 章，其中 2 章是请别人代笔的/);
  assert.match(txt, /最近连着 2 章都不是她自己写的/);
  assert.match(txt, /这一章是被点了单的/);
  assert.ok(!/热度|愤怒|不满|生气值|\d+\/100/.test(txt.replace("别默认她生气", "")), "给了情绪标签＝替她把戏演完了，她只会回一句判语");
  assert.match(txt, /别默认她生气，也别写成客气的场面话/);
  assert.match(txt, /她本来就不在乎的，那就真的不在乎/, "不给出口的话，没脾气的太太也会被演成护崽狂");
  assert.equal(M.authorStanceFacts({ chapters: [] }, {}), "", "还没有章节就别发一段空的");
  // 调用点也不许把热度递进去
  const seg = fic.slice(fic.indexOf("async function genNextChapter"), fic.indexOf("  // ---- 「让他接着写」"));
  assert.ok(strip(seg).indexOf("authorHeat") < 0, "热度递进了这一枪");
});

test("① 她那句话跟这一章同一枪出，不另打一枪", () => {
  const ask = M.authorNoteAsk({ author: "青梅" }, "老陈", false);
  assert.match(ask, /\*\*那是另一个人在开口，不是你\*\*/, "不说清站位，枪手会用自己的语气写原作者的话");
  // v66.91 收窄：那句本来是防它硬挤废话，结果成了「可以一直不说」（她 2026-09-11 报的就是这个）。
  // 现在出口留在【说什么】上，不留在【说不说】上——下面那条新测试钉着。
  assert.match(ask, /心平气和也写一句心平气和的；挑不出毛病就说挑不出毛病/, "不给「说什么」的出口，它只会写成一句客气话");
  assert.ok(ask.indexOf("不打算再写这篇") < 0, "没撂挑子的那一次也在说「不写了」");
  const quit = M.authorNoteAsk({ author: "青梅" }, "老陈", true);
  assert.match(quit, /她已经不打算再写这篇了/);
  // 零额外成本：authorNote 是这一枪 JSON 里多出来的一栏
  // v66.91 挪了位置（从队尾挪到正文和锚点后面），措辞也跟着短了一点
  assert.ok(fic.indexOf('\\"authorNote\\":\\"原作者看完这一章，在评论区底下留的那一句话\\",') > 0, "输出形状里没有 authorNote 这一栏");
  assert.match(fic, /authorNote: String\(d\.authorNote \|\| ""\)\.trim\(\)\.slice\(0, 300\)/);
  // 挂在【这一章】上，所以章末显示、书评区不重复
  assert.match(fic, /chapterIdx: newIdx/);
  assert.match(fic, /return r && r\.chapterIdx === idx;/);
  assert.match(fic, /return r && r\.chapterIdx == null;/, "书评区没滤掉挂在章上的，同一条会显示两遍");
});

test("② 抢笔：掷在调用点，而且当场告诉她", () => {
  const r = fic.slice(fic.indexOf("async function addChapter(by, want, hard)"), fic.indexOf("    // 去请她回来"));
  assert.match(r, /Math\.random\(\) < K\.grabChance\(heat\)/);
  // v66.78：抢笔只发生在【太太】之间——她自己的人接手，原作者照样说话，但抢不回来
  assert.match(r, /const grabbed = !!by && !byChar && !!ownCard &&/, "没点枪手也会「抢笔」＝她抢自己的笔");
  assert.match(r, /抢回去自己写了/, "不当场说一句，她只会以为是坏了");
  assert.match(r, /if \(grabbed\) ch\.grabbed = true;/);
  assert.match(fic, /抢回去自己写的/, "章头上没标，翻回来就看不出这一章出过事");
  // 抢笔＝她出手了，热度该往下走
  assert.match(r, /heatAfter\(fic, grabbed \? "own" : \(by \? "ghost" : "own"\)/);
  // 提示词里写的是「你把笔抢回来」，不是「你很生气」
  assert.match(fic, /\*\*把笔抢回来自己写\*\*/);
  assert.match(fic, /别在正文里对读者解释这件事，正文还是正文/);
});

test("③ 撂挑子先预告，所以它是有台词的，而且不多花一枪", () => {
  const r = fic.slice(fic.indexOf("async function addChapter(by, want, hard)"), fic.indexOf("    // 去请她回来"));
  assert.match(r, /const quitting = !f\.authorQuit &&/, "已经撂过挑子还能再撂一次");
  assert.match(r, /Math\.random\(\) < K\.refuseChance\(/);
  assert.match(r, /if \(quitting\) \{ fic\.authorQuit = true; fic\.quitSay = note; \}/, "她说的那句话没存下来，界面上就只能写死一句");
  // 下次点她那一行就被挡住，显示的是她当时说的那句
  assert.match(fic, /disabled: !!a\.quit/);
  assert.match(fic, /String\(f\.quitSay \|\| ""\)\.slice\(0, 80\)/);
  assert.match(fic, /得先请她回来，或者另找一位/);
});

test("③ 能翻脸就得能和好，而且成不成由代码定", () => {
  const r = fic.slice(fic.indexOf("async function askAuthorBack"), fic.indexOf("    // 「让他接着写」"));
  assert.match(r, /const ok = Math\.random\(\) < K\.backChance\(/, "让模型自己决定答不答应，它十次有九次会答应＝这道门等于没有");
  assert.match(r, /if \(r\.ok\) \{ fic\.authorQuit = false;/);
  assert.match(r, /fic\.authorHeat = Math\.max\(0, window\.Fanfic\.heatNow\(fic, Date\.now\(\)\) - 25\)/, "和好了热度不降，下一章立刻又翻脸");
  const g = fic.slice(fic.indexOf("async function genAuthorBack"), fic.indexOf("  // ---- 书评"));
  assert.match(g, /【这一次你答应了】/);
  assert.match(g, /【这一次你没答应】/);
  assert.match(g, /别写成一句客气的场面话/);
  assert.ok(g.indexOf("你自己决定要不要答应") < 0, "把「答不答应」交回给模型了");
});

// ── 她 2026-09-11 报：「为啥请枪手最后没有原作者的感想」──────────────────
// 三个原因叠在一起，没有一个是「模型不配合」：
//  ① authorNote 排在输出形状的**最后一个**，而截断永远从队尾开始——正文一长它第一个没。
//  ② 救援那条路（长章被截断走的正是它）只认 content / endHook，
//     v66.77~79 给正路加的 authorNote / facts / seed / paid **一个都没跟上**。
//  ③ 出口给太宽了：「不必每章都有话」本来是防它硬挤废话，结果成了「可以一直不说」。
test("① authorNote 挪到队首那几栏里——截断从尾巴开始", () => {
  // ⚠️先把注释剥掉：上面那段病历里也写着 authorNote，不剥的话量到的是注释的位置
  const out = strip(fic.slice(fic.indexOf('"【输出】只输出一个合法 JSON 对象'), fic.indexOf("const userMsg = \"续写《")));
  const at = k => out.indexOf('\\"' + k + '\\"');
  assert.ok(at("content") > 0 && at("authorNote") > 0 && at("facts") > 0 && at("paid") > 0, "输出形状抠不出来");
  assert.ok(at("authorNote") < at("facts") && at("authorNote") < at("paid"), "authorNote 又排到队尾去了——正文一长它第一个被切掉");
  assert.ok(at("content") < at("authorNote"), "它得写在正文后面：刚读完才说得出话");
  assert.match(fic, /字段顺序＝生成顺序，而\*\*截断永远从队尾开始\*\*/);
});

test("② 救援那条路要跟正路一样全", () => {
  // ⚠️又是注释：上面那段病历里把 authorNote/facts/seed/paid 全点了一遍，不剥就永远绿
  const sv = strip(fic.slice(fic.indexOf("function salvageChapter(clean, cot)"), fic.indexOf("    // 思考型模型预算别抠")));
  // ⚠️只看【交回来的那个对象】：那几个名字在上面那条正则的锚点清单里也出现，
  //   照整段搜的话，就算 return 里一个都不捞，这条断言照样绿
  const ret = sv.slice(sv.indexOf("return { content:"));
  assert.ok(ret.length > 40, "抠不出救援那条路交回来的形状");
  ["authorNote", "facts", "seed", "paid", "endHook"].forEach(k =>
    assert.ok(ret.indexOf(k) > 0, "救援路交回来的东西里没有 " + k + " —— 长章被截断走的正是这条"));
  assert.match(sv, /endHook\|authorNote\|facts\|seed\|paid/, "正文的收尾锚点只认 endHook，后面那几栏一出现就会被当成正文吃进去");
  // 正路和救援路交回来的形状要对得上
  const once = fic.slice(fic.indexOf("async function once(extra)"), fic.indexOf("let out = await once"));
  ["authorNote", "facts", "seed", "paid", "endHook"].forEach(k =>
    assert.ok(once.indexOf(k) > 0, "正路少了 " + k));
});

test("③ 出口留在「说什么」上，不留在「说不说」上", () => {
  const ask = M.authorNoteAsk({ author: "青梅" }, "老陈", false);
  assert.ok(ask.indexOf("不必每章都有话") < 0, "那句又回来了——它本来是防硬挤废话，结果成了「可以一直不说」");
  assert.match(ask, /这一章是别人替她写的，她\*\*一定\*\*看了——所以这一栏默认是有话的/);
  assert.match(ask, /心平气和也写一句心平气和的；挑不出毛病就说挑不出毛病/, "不给「说什么」的出口，它只会写成一句客气话");
  assert.match(ask, /只有在她压根不在乎这篇文的时候才留空/);
});
