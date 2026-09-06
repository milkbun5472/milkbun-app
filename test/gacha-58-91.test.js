const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const G = require("../js/gacha.js");
const app = R("app.js"), scr = R("screens.js");
const cut = (a, b) => app.slice(app.indexOf(a), app.indexOf(b));
const redeem = cut("  const gachaRedeem = async card => {", "  const coupleLineFor = (charId, uName) => {");
const pullFn = cut("  const gachaPull = (char, n) => {", "  const gachaStamp = (cardId, result) => {");
const stamp = cut("  const gachaStamp = (cardId, result) => {", "  // 兑换。三档在这一处分路");

// 她 2026-08-31 定的形状：**抽是抽，兑是兑**。抽卡永远 0 次调用——抽到的是一张兑换券，
// 点了兑换才真的发生。这一条塌了，十连就变成一次十几刀，整个玩法的前提就没了。
test("抽卡不花任何调用，十连也不花", () => {
  ["callAI", "runProbe", "genJSON", "await "].forEach(k =>
    assert.ok(pullFn.indexOf(k) < 0, "抽的时候就调模型了：" + k));
  assert.match(pullFn, /K\.pull\(n,/, "没走纯逻辑那一层");
});

// 「票根永远留痕有时间戳是什么时候抽到的（r sr ssr都留）」——她原话。
// 一张卡就是它自己的票根：兑换只是盖个戳，不是消耗掉它。
test("票根不删：兑换只是盖个戳", () => {
  assert.match(stamp, /gachaCardsRef\.current\.map\(c => c\.id === cardId \? \{ \.\.\.c, redeemedTs: Date\.now\(\), result: result \} : c\)/,
    "兑换把卡改掉了或者删掉了——票根就没了");
  assert.ok(stamp.indexOf("filter") < 0, "票根被过滤掉了");
  // 抽到的那一刻要盖时间戳，三档都盖（她点名 r sr ssr 都留）
  assert.match(pullFn, /ts: now \+ i,/, "抽到的时间没记");
  assert.ok(!/r === "SSR"|card\.r ===/.test(pullFn.slice(pullFn.indexOf("const made"))), "分稀有度决定留不留票根了——三档都要留");
});

test("三档分路：R 不花调用，SR/SSR 才花", () => {
  const rSeg = redeem.slice(redeem.indexOf('if (card.act === "peek")'), redeem.indexOf('if (!active)'));
  ["callAI", "runProbe"].forEach(k => assert.ok(rSeg.indexOf(k) < 0, "R 兑换调模型了：" + k));
  assert.match(rSeg, /const got = gachaPickR\(char, need\);/, "R 没从他已有的东西里翻");
  // 那一栏这会儿空了：不盖戳，卡留着
  assert.match(rSeg, /if \(!got\) \{ toast\([^)]*\); return; \}/, "翻不出东西也把卡兑掉了");
  assert.ok(redeem.indexOf('if (!active) { toast("请先到设置配置 API"); return; }') > redeem.indexOf('if (card.act === "peek")'),
    "没配 API 的闸挡在 R 前面了——R 本来就不需要 API");
});

// SSR 贵在【改变了什么】，不贵在辞藻。三条留痕的路各接一处已有系统。
test("SSR 真的留下东西", () => {
  assert.match(redeem, /addMemEntry\(\{ text: body, tags: \["抽卡", "过去"\]/, "「他的一段过去」没进记忆库");
  assert.match(redeem, /addPact\(char\.id, body, null\)/, "「我们说好的」没进那条已有的路");
  assert.match(redeem, /await startOffline\(char\.id, \{ opening: body \}\);\n        setOfflineChar\(char\);/,
    "线下没开起来，或者用了 openOffline（它会重读存储、把刚塞进去的那一场盖掉）");
  ["memlib", "pacts"].forEach(w => assert.ok(redeem.indexOf('where: "' + w + '"') > 0, "票根上没写清留在哪儿：" + w));
  assert.match(redeem, /gachaStamp\(card\.id, \{ title: title, body: body, where: card\.act \}\)/, "开线下那两张没在票根上写清是哪一种");
  // 情书自己有三天冷却：被挡住就不盖戳，卡留着
  assert.match(redeem, /const ok = await genCoupleLetter\(char\);\n        if \(!ok\) return;/, "情书被冷却挡住时把卡白白兑掉了");
});

test("出率与保底", () => {
  assert.equal(G.RATE_SSR + G.RATE_SR < 1, true);
  // 十连必出 SR 以上
  for (let seed = 0; seed < 40; seed++) {
    let i = 0; const rand = () => { i++; return 0.99; };   // 永远滚到 R
    const r = G.pull(G.TEN, { pulls: 0, sinceSSR: 0 }, { have: { album: 1 }, couple: false }, rand);
    assert.equal(r.cards.length, G.TEN);
    assert.ok(r.cards.some(c => G.RANK[c.r] >= 1), "十连一张 SR 都没有");
  }
  // 连着 PITY_SSR 抽没出 SSR，第 PITY_SSR 抽必出
  let st = { pulls: 0, sinceSSR: G.PITY_SSR - 1 };
  const r = G.pull(1, st, { have: { album: 1 }, couple: false }, () => 0.99);
  assert.equal(r.cards[0].r, "SSR", "保底没兜住");
  assert.equal(r.state.sinceSSR, 0, "出了 SSR 没把计数清零");
});

// 抽到一张永远兑不了的券，比没抽到更糟
test("那一栏是空的，这张券根本不会被抽出来", () => {
  const only = G.poolOf("R", { have: { notes: true } });
  assert.equal(only.length, 1);
  assert.equal(only[0].id, "r_note");
  assert.equal(G.poolOf("R", { have: {} }).length, 0);
  // 什么都还没有的新角色：R 池空了就升一档，别发空券
  const c = G.pickCard("R", () => 0.5, { have: {}, couple: false });
  assert.equal(c.r, "SR", "R 池空了还硬发 R");
});

// 她 2026-08-31：「抽卡是情侣空间的功能，每个恋爱角色单独一份，不是主页」。
// 进得来这一页就已经是在一起了，所以池子里【不该】再留「要不要在一起」那道闸——
// 恒为真的条件是死代码，删掉而不是留着。
test("只活在情侣空间里：主屏一点痕迹都没有", () => {
  const comp = R("components.js"), core = R("core.js");
  assert.ok(comp.indexOf('gacha: { kind: "app"') < 0, "主屏图标还在 REG 里");
  assert.ok(!/\["gacha"|"gacha",/.test(comp), "默认布局里还占着一格");
  assert.ok(core.indexOf("GGacha") < 0, "图标定义没删干净（零引用的死定义）");
  assert.ok(core.indexOf("gacha: 300") < 0, "色相点名表里还留着");
  assert.ok(app.indexOf('screen === "gacha"') < 0, "主屏路由还在");
  // 正门在情侣空间，而且只有在一起才进得去
  assert.match(scr, /if \(partner && cp\[view\] && cp\[view\]\.status === "together" && sub === "gacha"\) \{/, "情侣空间里没有这一页");
  // v62.41 起抽卡是【一叠】卡（外面一个壳装三张），所以它不再走 wall——入口认 openSub
  assert.match(scr, /(?:wall|spine)\("gacha",|openSub\("gacha"\)/, "情侣空间首页上没有入口");
  // 恒为真的那道闸删掉了
  assert.ok(R("gacha.js").indexOf("couple") < 0, "池子里还留着恒为真的 couple 闸");
});

// 每个恋爱角色单独一份：这一页只认它自己那位，不再有角色选择条
test("每个恋人各一份，页面上不再挑角色", () => {
  const ui = scr.slice(scr.indexOf("function Gacha({"));
  assert.match(ui, /function Gacha\(\{ partner, pts, cards, luck, busy, onPull, onRedeem, onBack \}\)/, "还在自己挑角色");
  assert.match(ui, /c\.charId === partner\.id/, "卡册没按这位恋人筛");
  assert.match(ui, /\(pts \|\| \{\}\)\[partner\.id\]/, "点数没按这位恋人取");
  assert.match(ui, /onPull\(partner, n\)/, "抽的时候没指名是谁");
  assert.ok(ui.indexOf("setCid") < 0, "角色选择条没删干净");
});

// 按消息条数给点数＝拿抽卡催她水消息。所以给的是【一段相处】。
test("点数按一段相处给，发几条不影响", () => {
  const D = "2026-08-31", t = 1000000000000;
  let b = {};
  let r = G.earn(b, "c1", "chat", t, D); b = r.box;
  assert.equal(r.got, G.EARN.chat);
  for (let i = 1; i < 20; i++) { r = G.earn(b, "c1", "chat", t + i * 60000, D); b = r.box; assert.equal(r.got, 0, "同一段里又给了一次"); }
  r = G.earn(b, "c1", "chat", t + G.SESSION_GAP_MS + 60000, D); b = r.box;
  assert.equal(r.got, G.EARN.chat, "隔够了却没算新的一段");
  // 一天封顶
  let cap = {}, tot = 0;
  for (let i = 0; i < 20; i++) { const x = G.earn(cap, "c1", "chat", t + i * (G.SESSION_GAP_MS + 1000), D); cap = x.box; tot += x.got; }
  assert.equal(tot, G.DAILY_CAP, "一天没封顶");
  // 换一天要重新开始
  const nd = G.earn(cap, "c1", "chat", t + 40 * G.SESSION_GAP_MS, "2026-09-01");
  assert.equal(nd.got, G.EARN.chat, "跨天没重置");
  // 点数跟角色走：给 c1 的不算给 c2
  assert.equal(G.ptsOf(cap, "c2"), 0);
});

test("点数不够就一点都不扣", () => {
  const b = { c1: { pts: 40 } };
  assert.equal(G.spend(b, "c1", G.COST_ONE), null, "不够也让抽了");
  assert.equal(G.ptsOf(b, "c1"), 40, "试着抽了一下就把点数扣掉了");
  assert.equal(G.ptsOf(G.spend({ c1: { pts: 500 } }, "c1", G.COST_TEN), "c1"), 500 - G.COST_TEN);
  const p = app.slice(app.indexOf("const after = K.spend"), app.indexOf("const cp = (couplesRef"));
  assert.match(p, /if \(!after\) \{ toast\([\s\S]*?\); return; \}/, "扣不动还往下抽");
  assert.ok(p.indexOf("K.pull(") < 0, "扣点数那一段里就把卡抽了——扣不动也会抽出来");
});

// 一段相处才给：两个入口都要接上（聊天 + 线下）
test("两个入口都在给点数", () => {
  assert.match(app, /gachaEarn\(activeChar\.id, "chat"\); pushUser\(/, "单聊没给");
  assert.match(app, /gachaEarn\(offlineChar\.id, "offline"\); offlineSend\(/, "线下没给");
});

// 施工规则/no-half-sheet.md：新界面一律整页
test("整页，不是半窗；标题栏是紧凑那种", () => {
  const ui = scr.slice(scr.indexOf("function Gacha({"));
  assert.ok(ui.indexOf("h(Sheet") < 0, "用半窗了");
  assert.match(ui, /className: "h-full flex flex-col"/);
  assert.match(ui, /className: "flex-1 min-h-0 overflow-y-auto/, "正文不是唯一的主滚动容器");
  assert.match(ui, /paddingTop: safeTop\(10\)/, "顶栏没吃安全区");
  assert.ok(!/fontSize: 3[0-9]/.test(ui.slice(0, ui.indexOf("flex-1 min-h-0"))), "顶上摆了大标题");
});

test("票根那一栏把两个时间都摆出来", () => {
  const card = scr.slice(scr.indexOf("function GachaCard({"), scr.indexOf("function Gacha({"));
  assert.match(card, /gachaWhen\(card\.ts\)/, "没写抽到的时间");
  assert.match(card, /"已兑 " \+ gachaWhen\(card\.redeemedTs\)/, "没写兑掉的时间");
  // 兑没兑都要显示抽到的时间：票根是永久的
  const i = card.indexOf("gachaWhen(card.ts)"), j = card.indexOf("done\n      ?");
  assert.ok(i > 0 && (j < 0 || i < j), "抽到的时间被塞进「没兑」那一支里了——兑掉就看不见了");
});

// ═══ 约会券（言秋提，她 2026-08-31：并进抽卡，不另做一叠）═══
// 原提案是另做一叠券、每周抽一张、完成盖章进册——那跟抽卡是【同一个形状】
//（兑换券 + 票根），再做一套就是两本并行的册子。所以它是多一个 act，不是新功能。
test("约会券没有另起一套，是抽卡里多一个 act", () => {
  const g = R("gacha.js");
  assert.match(g, /\{ id: "x_date",    r: "SSR", act: "date",/, "SSR 里没有约会券");
  assert.match(g, /\{ id: "s_date",    r: "SR",  act: "make", kind: "date",/, "SR 里那张想过的约会没接上");
  // 落地走的是【已有的】开线下那条路，不是新机件
  assert.match(redeem, /card\.act === "offline" \|\| card\.act === "date"/, "约会券没接到开线下那条路上");
  // 没有第二套券的存储／页面
  ["x_dateTicket", "x_coupon", "DateTickets"].forEach(k =>
    assert.ok(app.indexOf(k) < 0 && scr.indexOf(k) < 0, "另起了一套券：" + k));
  // 券面那件事必须长在人设上，不然「换个角色照样成立」
  assert.match(app, /换个角色照样成立的就是写坏了/, "券面没立那条判据");
});

// ═══ 惊喜抽屉（言秋提，她 2026-08-31 拍板）═══
// 出口本来就在（dongnian 越过阈值时那一次调用），这一层只是给它加第三个落点。
test("抽屉挂在已有的思念出口上，不是新开一条调用链", () => {
  // ⚠️右边界用它自己的收尾，别拿隔壁常量当锚（隔壁一插新代码就误伤）
  const _li = app.indexOf("  const leaveInCoupleSpace = async (char, styleHint, manual) => {");
  const leave = app.slice(_li, app.indexOf("\n  };", _li) + 4);
  assert.equal((leave.match(/runProbe\(/g) || []).length, 1, "抽屉多开了一次调用——它该跟便签/时光轴共用那一次");
  // v61.35 收成两档（note 那一档的便签墙 v59.23 就撤了，见 couple-leave-outlets-61-35）
  assert.match(leave, /drawer 或 timeline/, "落点里没有抽屉");
  assert.match(leave, /if \(d\.where === "drawer"\) \{/, "抽屉那一支没接上");
  assert.match(leave, /\["thing", "word", "draw"\]\.indexOf\(String\(d\.kind \|\| ""\)\) >= 0/, "kind 没兜底,模型写错就存了个野值");
  assert.match(leave, /openedTs: null/, "放进来就是拆开的状态——那还惊喜什么");
  assert.match(leave, /\.slice\(0, DRAWER_CAP\)/, "抽屉没有天花板");
});

// ⚠️这一格【故意】不报红点、不显示还剩几件没拆：报了就跟 App 里其余通知一个样，
// 惊喜就没了（言秋原话：开之前不知道有没有、有什么）。
test("抽屉那一格不许剧透", () => {
  // ⚠️抽屉是墙上最后一块，后面没有兄弟可以当结尾锚点；按它自己的正文收口。
  const i = scr.indexOf('wall("drawer"');
  const tile = scr.slice(i, scr.indexOf('"拉开看看"', i) + 20);
  // v62.41 抽屉真做成了一格抽屉（暗缝＋两侧木边＋把手），所以这一格本来就长了一截
  assert.ok(i > 0 && tile.length > 60 && tile.length < 2000, "抽屉那一格切歪了（切出来 " + tile.length + " 字）");
  assert.ok(tile.indexOf('"gacha"') < 0 && tile.indexOf('spine("') < 0, "切进隔壁去了");
  assert.ok(tile.indexOf("dot:") < 0, "抽屉格报红点了——惊喜没了");
  assert.ok(!/unopened|没拆|coupleDrawer\.filter|\.length/.test(tile), "格子上把还剩几件漏出去了");
  // 但页面【里头】要说清有几件没拆，不然不知道该点哪一张
  const page = scr.slice(scr.indexOf("function CoupleDrawer({"));
  assert.match(page, /unopened \? "有 " \+ unopened \+ " 样还没拆"/, "进去了也不知道有没有新的");
  // v61.33 收紧成【一个字都不露】：她 2026-09-03 报「还没拆不应该显示说的话的一部分」。
  // 原来封面上印的是 x.title，而悄悄话那一路的 title 就是正文头 16 个字。
  const sealedBlk = page.slice(page.indexOf("if (sealed) {"), page.indexOf("// 拆开的：摊平的那张纸"));
  assert.ok(sealedBlk.length > 200, "封着那一段切歪了");
  assert.ok(sealedBlk.indexOf("x.title") < 0, "封面上还印着标题");
  assert.ok(sealedBlk.indexOf("x.text") < 0, "封面上还印着正文");
  // 拆过的留着——所以从来不会白开一次
  assert.match(page, /const mine = \(items \|\| \[\]\)\.filter\(x => x\.characterId === partner\.id\);/, "没按这位恋人筛");
  assert.ok(page.indexOf("!x.openedTs)") > 0 && !/filter\(x => !x\.openedTs\)\.map/.test(page), "拆过的被过滤掉了");
});

test("拆开只改一次，时间戳留着", () => {
  const op = app.slice(app.indexOf("  const openDrawerItem = id =>"), app.indexOf("  const sealCoupleQA"));
  assert.match(op, /x\.id === id && !x\.openedTs \? \{ \.\.\.x, openedTs: Date\.now\(\) \} : x/, "重复点会把拆开时间刷掉");
  assert.ok(op.indexOf("filter") < 0, "拆开把东西删了");
  assert.match(app, /saveJSON\("x_coupleDrawer", n\)/, "没落盘");
  assert.match(R("engine.js"), /"x_coupleDrawer"/, "抽屉正文没登记进 durable，攒多了会把 localStorage 写满");
});

// ═══ 印象卡那张 SSR（她 2026-08-31 从两张里只选了这张）═══
// 印象卡（js/gaze.js 十块）【进提示词】——gazeText 常驻在 buildBundle 里。
// 所以改一块，他往后看她的眼光就真的变了。这是全池子里留痕最硬的一张。
test("印象卡那张改的是真卡，不是自己另存一份", () => {
  assert.match(R("gacha.js"), /\{ id: "x_gaze",    r: "SSR", act: "gaze",/, "池子里没有这张");
  // 必须走 Gaze 自己那条：normKey 认得中文块名／带 side 的块名，重造一份解析必然漏
  assert.match(redeem, /window\.Gaze && window\.Gaze\.applyParsed\(char\.id, \{ side: d\.side, block: d\.block, text: body \}\)/,
    "没走 Gaze.applyParsed——自己解析块名会漏掉模型那几种写法");
  assert.ok(!/localStorage\.setItem\("x_gaze"|saveJSON\("x_gaze"/.test(app), "绕过 Gaze 直接写存储了（旧版快照和红点都会丢）");
  // 认不出那一块就不盖戳，卡留着
  assert.match(redeem, /if \(!ok\) \{ toast\([\s\S]*?\); return; \}/, "写不进去也把卡兑掉了");
  assert.match(redeem, /where: "gaze"/, "票根上没写清改的是印象卡");
  // 他本来就看得见自己那张卡（buildBundle 常驻 gazeText），别再抄一遍进提示词
  const ask = app.slice(app.indexOf("    gaze: \"你心里那张关于她"), app.indexOf("    // 约会券：跟 offline"));
  assert.match(ask, /上面已经发给你了/, "没说清卡已经在上下文里——模型会以为要从零编一张");
  assert.match(ask, /整块盖掉旧的那版/, "没说清是整块重写，模型会写成补丁");
  assert.match(ask, /换个角色照样成立的就是写坏了/, "没立那条判据");
});
