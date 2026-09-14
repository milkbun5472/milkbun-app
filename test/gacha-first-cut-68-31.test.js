// 她 2026-09-14：「情侣空间扭蛋，我感觉扭出来的奖励有点无聊」。
//
// 病根不是文案：四分之三的抽出来是 R，而 R 是把已经存在的一行原样摆一次——
// 平时翻手机就看得到。第一刀按她定的三层来：
//   种子（世界里多了什么）→ 特权（你能拿它干什么）→ 质感（同一张券每次不一样）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const K = require(path.join(root, "js/gacha.js"));
const P = require(path.join(root, "js/phone.js"));
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const gac = fs.readFileSync(path.join(root, "js/gacha.js"), "utf8");

test("R 不再是大头，但「抽是抽、兑是兑」没被破", () => {
  assert.ok(K.RATE_SSR + K.RATE_SR > 0.4, "SR 还不是常见档");
  // 能玩的那几张一律不许进 R —— R 的定义是【兑换 0 调用】
  K.POOLS.filter(p => p.r === "R").forEach(p => assert.equal(p.act, "peek", p.id + " 破了 R 的 0 调用"));
});

test("避重复：池子够大时连抽不会撞同一张", () => {
  const have = {}; ["album","notes","search","order","reading","playlist","memlib","forum","moment","diary"].forEach(k => { have[k] = 1; });
  let st = {}, last = "", same = 0;
  for (let i = 0; i < 30; i++) {
    const r = K.pull(1, st, { have: have });
    st = r.state;
    const id = r.cards[0].poolId;
    if (id === last) same++;
    last = id;
  }
  assert.equal(same, 0, "连着两抽抽到同一张了");
  assert.ok(Array.isArray(st.recent) && st.recent.length, "recent 没跟着走");
  // 十连内部也要躲（原来「约会券 ×3」正是这么来的）
  const ten = K.pull(10, {}, { have: have }).cards.map(c => c.poolId);
  ten.forEach((id, i) => { if (i) assert.notEqual(id, ten[i - 1], "十连里连着两张一样"); });
});

test("池子全出过了也不能抽不出东西来——宁可重复", () => {
  // 只有一张能用的时候，避重不许把它挡掉
  const r = K.pickCard("R", () => 0, { have: { album: 1 }, recent: ["r_photo"] });
  assert.equal(r && r.poolId, "r_photo");
});

test("每张卡都有 tone，老卡按甜的算", () => {
  K.POOLS.forEach(p => assert.ok(K.TONES.indexOf(K.toneOf(p)) >= 0, p.id));
  assert.equal(K.toneOf({ id: "x" }), "sweet");
  assert.equal(K.toneOf(K.byId.s_drop), "tease");
});

test("种进手机的那一行必须盖 _wk 戳，不然周刷把它抹了", () => {
  const i = app.indexOf("const GACHA_SEED_KINDS = {");
  assert.ok(i > 0, "没有种子那张表");
  const tbl = app.slice(i, app.indexOf("\n  const gachaSeedPatch", i));
  assert.match(tbl, /_seed: 1, _wk: 1, _wkAt: Date\.now\(\)/);
  // 另一半在 phone 那头：这一栏得登记进去，戳才有人认
  assert.equal((P.PHONE_WATCH_KEEP.shopping || {}).shipping, 6, "shipping 没登记进 PHONE_WATCH_KEEP");
});

test("不是闹钟：只在打开 App / 切回前台时兑现", () => {
  const i = app.indexOf("const gachaSeedSweep = () => {");
  assert.ok(i > 0);
  assert.match(app.slice(i, i + 1600), /dueTs\) <= now/);
  // 靠 focus / visibilitychange 起跑，不许有 setInterval 冒充定时器
  const hook = app.slice(app.indexOf("gachaSeedSweep();", i), i + 2200);
  assert.match(hook, /addEventListener\("focus", run\)/);
  assert.match(hook, /addEventListener\("visibilitychange", run\)/);
  assert.doesNotMatch(hook, /setInterval/);
});

test("那个 app 被清空了就留着下次再种，不许假装送到了", () => {
  const i = app.indexOf("const gachaSeedSweep = () => {");
  const fn = app.slice(i, app.indexOf("\n  useEffect", i));
  assert.match(fn, /if \(!ok\) return sd;/);                 // 种不进去就不盖戳、不标 done
  assert.match(app, /if \(!cur\) return false;\s*\/\/ 这个 app 还没生成过/);
});

test("界面上说实话：还在路上那一行写明是下次打开才看得到", () => {
  assert.match(scr, /还在路上/);
  assert.match(scr, /下次打开就看得到/);
});

test("照片终于画出来了（取了 imageRef 却从来没人用）", () => {
  assert.match(scr, /res\.img \? h\("img", \{ src: typeof phoneImage === "function"/);
});

test("双面券两个口子，选了就定了", () => {
  assert.match(scr, /card\.act === "dual"/);
  assert.match(scr, /onRedeem\(\{ \.\.\.card, side: side \}\)/);
  assert.match(app, /const side = card\.side === "tease" \? "tease" : "sweet";/);
  assert.match(app, /gAsk\("s_dual", side\)/);
});

test("掉马券摆到TA面前：走翻手机那条现成的链，不另开一条", () => {
  assert.match(app, /onGachaShow: card => \{/);
  assert.match(app, /forwardPhonePeekToChat\(c, \{ label: String\(r\.title/);
  assert.doesNotMatch(app, /kind: "gachapeek"/);   // 别另造一种消息
});

test("券的提示词给出口，不下判决（施工规则/bans-make-it-dumber.md）", () => {
  // v68.42 提示词搬进卡表了——直接问那张卡要，不再按源码位置去切
  const ask = K.askOf("s_dual", "tease");
  assert.match(ask, /不是【TA一定会照办】/);
  assert.match(ask, /讨价还价、反将一军/);
  // 掉马券反过来：它要的是【别解释】
  assert.match(K.askOf("s_drop"), /别替TA解释/);
});

test("新开的四枪 maxTokens 都开满（施工规则/max-tokens-floor.md）", () => {
  ["drop", "dual", "seed", "flow"].forEach(actName => {
    const i = app.indexOf('if (card.act === "' + actName + '")');
    assert.ok(i > 0, actName);
    assert.match(app.slice(i, i + 2400), /maxTokens: 65535/, actName);
  });
});

test("料全放 system：走 runProbe，不自己拼 user（施工规则/prompt-send-shape.md）", () => {
  ["drop", "dual", "seed", "flow"].forEach(actName => {
    const i = app.indexOf('if (card.act === "' + actName + '")');
    const seg = app.slice(i, i + 2400);
    assert.match(seg, /runProbe\(apiFor\(char\.id\), ctxFor\(char\), \{/, actName);
    assert.match(seg, /voice: true/, actName);
  });
});

test("提示词里没有内容示范（施工规则/prompt-no-content-samples.md）", () => {
  // 全库每一张卡都核一遍，不只核新加那几张——搬进卡表之后这件事变便宜了
  K.POOLS.forEach(p => {
    const a = p.ask;
    if (!a) return;
    const all = typeof a === "string" ? [a] : Object.keys(a).map(k => a[k]);
    all.forEach(x => assert.doesNotMatch(String(x), /如「|例如「/, p.id));
  });
});

test("几天后到由代码掷，不问模型", () => {
  assert.match(app, /const days = 2 \+ Math\.floor\(Math\.random\(\) \* 3\);/);
  const sh = app.slice(app.indexOf('schemaHint: "{\\"cover\\"'), 400);
  assert.doesNotMatch(sh, /days/, "把天数交给模型了，它能写「三个月后」");
});

// ── 第二刀（v68.35）：秘密筹备两段式 + 掉落接进抽屉 + 种子再加一种 ──
test("掉落进的是现成的抽屉，不另开一叠收藏", () => {
  assert.match(app, /const drawerDrop = \(charId, title, text\) => \{/);
  assert.match(app, /kind: "drop",\s*\n\s*title: tt/);
  assert.doesNotMatch(app, /x_gachaDrops|saveJSON\("x_pocket"/);   // 没有第二个收藏库
  assert.match(scr, /drop:    \{ zh: "TA身上带的"/, "抽屉里认不出这一类，会掉进默认那一档");
});

test("秘密筹备：第一枪只出信封，第二枪由她按才花", () => {
  // 第一枪的提示词必须明说不许剧透
  ["out", "home"].forEach(k => assert.match(K.askOf("x_plan", k), /⚠️不许写/, k));
  // 到点只解锁，不打第二枪
  assert.match(app, /plan: \{ app: "", unlockOnly: true \}/);
  const sw = app.slice(app.indexOf("const gachaSeedSweep = () => {"), app.indexOf("const gachaSeedSweep = () => {") + 1800);
  assert.match(sw, /if \(spec\.unlockOnly\) \{/);
  // v68.39 起秘密盒也走这一路，所以这儿认的是【解锁】本身，不再把 where 写死成 plan
  assert.match(sw, /ready: true \}\);/);
  assert.doesNotMatch(sw, /runProbe/, "到点在后台又打了一枪——她按次计费");
  // 第二枪挂在按钮上
  assert.match(scr, /onRedeem\(\{ \.\.\.card, act: "planOpen" \}\)/);
  assert.match(scr, /res\.where === "plan" && res\.ready \? h\("button"/);
});

test("盖过戳的券还拆得开——那道防重兑的闸不许把第二段挡掉", () => {
  // 两段式的第二段都要放行（v68.39 又多了一个盒子）
  assert.match(app, /if \(card\.redeemedTs && card\.act !== "planOpen"/);
  assert.match(app, /card\.act !== "boxOpen"\) return;/);
});

test("种哪一样由代码掷，不问模型", () => {
  assert.match(app, /const kinds = \["parcel", "ticket"\];/);
  assert.match(app, /const kind = kinds\[Math\.floor\(Math\.random\(\) \* kinds\.length\)\];/);
  // 表里每一种都要么会种进手机、要么明说自己只解锁
  const i = app.indexOf("const GACHA_SEED_KINDS = {");
  const tbl = app.slice(i, app.indexOf("\n  const gachaSeedPatch", i));
  ["parcel", "ticket", "plan"].forEach(k => assert.match(tbl, new RegExp("\\n    " + k + ": \\{"), k));
});
