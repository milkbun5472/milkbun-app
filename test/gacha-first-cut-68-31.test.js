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
  assert.match(app, /GACHA_SR_ASK\["dual_" \+ side\]/);
});

test("掉马券摆到TA面前：走翻手机那条现成的链，不另开一条", () => {
  assert.match(app, /onGachaShow: card => \{/);
  assert.match(app, /forwardPhonePeekToChat\(c, \{ label: String\(r\.title/);
  assert.doesNotMatch(app, /kind: "gachapeek"/);   // 别另造一种消息
});

test("券的提示词给出口，不下判决（施工规则/bans-make-it-dumber.md）", () => {
  const i = app.indexOf("    dual_tease:");
  const ask = app.slice(i, app.indexOf("\n  };", i));
  assert.match(ask, /不是【TA一定会照办】/);
  assert.match(ask, /讨价还价、反将一军/);
  // 掉马券反过来：它要的是【别解释】
  const d = app.slice(app.indexOf("    drop:   "), app.indexOf("    // 双面券"));
  assert.match(d, /别替TA解释/);
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
  ["drop", "dual_sweet", "dual_tease"].forEach(k => {
    const i = app.indexOf("    " + (k === "drop" ? "drop:   " : k + ": "));
    assert.ok(i > 0, k);
    const seg = app.slice(i, i + 900);
    assert.doesNotMatch(seg, /如「|例如「/, k);
  });
});

test("几天后到由代码掷，不问模型", () => {
  assert.match(app, /const days = 2 \+ Math\.floor\(Math\.random\(\) \* 3\);/);
  const sh = app.slice(app.indexOf('schemaHint: "{\\"cover\\"'), 400);
  assert.doesNotMatch(sh, /days/, "把天数交给模型了，它能写「三个月后」");
});
