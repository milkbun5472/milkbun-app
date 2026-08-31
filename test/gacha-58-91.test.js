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
  assert.match(redeem, /where: "memlib"|where: "pacts"|where: "offline"/, "票根上没写清留在哪儿了");
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
  assert.match(scr, /tile\("gacha", \{ e: "🎴", zh: "抽卡"/, "情侣空间首页上没有入口");
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

// .claude/rules/no-half-sheet.md：新界面一律整页
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
