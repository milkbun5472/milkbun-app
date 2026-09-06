// 她 2026-09-06 截图：状态卡「Ta 眼里」顶上写着
//   「替他自动复看过 4 次，都没成（这一次没成）；试满了，往后不再自动试」
// —— 「还是不行宝宝」。
//
// 查下来是三件事叠在一起，只有第三件才可能是真故障：
//
// ① **「一块都没改」被当成失败。** 复看那份提示词白纸黑字写着「没变就是没变，
//    不必为了交差改字」，模型照做返回全 null；代码这一道却 markReviewFail，
//    连着三次就「试满了，往后不再自动试」，而界面上写的是「都没成」。
//    她看到的是「坏了」，其实是「他真没什么要改的」。
// ② **手动那颗键跟自动共用预算。** 截图上「4 次」而上限是 3——多出来那一次是她
//    自己按的「让他再看一遍这十块」。预算防的是【代码偷偷花钱】，不是防她自己要。
// ③ **真败因被吞了。** 界面上那句「这一次没成」正是 plainWhy 认不出来时的兜底，
//    而 engine 其实已经把话说得很清楚（callDiag：哪个模型、提示词多大、输出上限
//    多少、等了几秒、是上游直接打回来还是超时）——全被那一句吞掉，
//    于是她和我都不知道到底什么坏了。人话留着给她看，原文另存一份，点开才看。
//
// ⚠️③ 是这一轮真正的交付：前两件是确凿的账目 bug，第三件让【下一次失败可诊断】。
//    在她那台机器上到底是哪一种，只有原文能说——猜是没用的。
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "gaze.js"), "utf8");
// gaze.js 是挂 window 的浏览器 IIFE：给它一个最小的壳就能真跑，
// 这样测的是【真正会跑的那段】，不是我照着它重写的一份（stub-from-the-writer.md）。
function boot() {
  const store = {};
  const win = {
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    }
  };
  const ctx = {
    window: win, localStorage: win.localStorage, document: { createElement: () => ({}) },
    React: { useState: v => [v, () => {}], createElement: () => null },
    h: () => null, F_BODY: "", F_DISPLAY: "", console
  };
  ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { G: win.Gaze, store, raw: () => JSON.parse(store.x_gaze || "{}").c1 || {} };
}
const DAY = 86400000;
const seedBox = (store, over) => {
  const old = Date.now() - 20 * DAY;
  store.x_gaze = JSON.stringify({ c1: Object.assign({
    seeded: true, mute: 14, reviewN: 0, reviewAt: 0, hist: [],
    blocks: { "me.person": { text: "她是和我反复拉扯的另一端。", ts: old } }
  }, over || {}) });
};
const ALL_NULL = { me: { person: null, soft: null, like: null, recent: null, unread: null },
                   us: { what: null, how: null, marks: null, elephant: null, want: null } };

test("① 全 null＝他真没什么要改的，不是失败", () => {
  const { G, store, raw } = boot();
  seedBox(store);
  assert.equal(G.reviewDue("c1"), true, "先得是该复看的状态，不然下面什么都没测到");
  G.markReview("c1");
  assert.equal(G.review("c1", ALL_NULL), 0);
  G.markReviewNoChange("c1");
  const st = G.reviewState("c1");
  assert.equal(st.tries, 0, "「没变」把预算还回去了才对——它不是一次失败");
  assert.equal(st.err, "", "还在把「没变」记成败因");
  assert.ok(st.okAt > 0, "没记下「这一次的结论是没变」");
  // ⚠️只是不记失败还不够：那样十分钟后又会自动再问一次，一路烧到上限。
  //   ⚠️这里必须先把【十分钟冷却】跨过去再问，否则 reviewDue 是被冷却挡住的，
  //     真正要测的那道闸一个字都没测到（第一版就是这样：把闸拆了它照样绿）。
  const box = JSON.parse(store.x_gaze); box.c1.reviewAt = Date.now() - 60 * 60000;
  store.x_gaze = JSON.stringify(box);
  assert.equal(G.reviewDue("c1"), false, "刚得到「没变」这个答案，过了冷却就又要再问一遍");
});

test("① 之二：「没变」等满一轮天数之后还能再复看", () => {
  const { G, store } = boot();
  seedBox(store, { reviewOkAt: Date.now() - 15 * DAY, reviewAt: Date.now() - 15 * DAY });
  assert.equal(G.reviewDue("c1"), true, "过了 14 天还不肯再看一遍＝这一层永久停了");
});

test("② 手动那一次不占自动预算", () => {
  const { G, store } = boot();
  seedBox(store);
  G.markReview("c1", true); G.markReview("c1", true); G.markReview("c1", true);
  assert.equal(G.reviewState("c1").tries, 0, "她自己按的也被记进自动预算了");
  assert.equal(G.reviewDue("c1"), false, "冷却没记上：连点会一次次真发调用");
  G.markReview("c1");
  assert.equal(G.reviewState("c1").tries, 1, "自动那一次得照记");
});

test("③ 真败因留一份原文：人话给她看，原文点开才看", () => {
  const { G, store } = boot();
  seedBox(store);
  // 这就是 engine 在「上游把请求打回来」时真正抛的那句
  const REAL = "模型返回为空（停止原因：max_tokens）\n〔claude-x｜提示词约 6k 字｜输出上限 65535 tok｜等了 1.2 秒＝上游直接打回来了（拦截／格式／配额），不是超时〕";
  G.markReviewFail("c1", REAL);
  const st = G.reviewState("c1");
  assert.equal(st.raw, REAL, "原文被扔了——那她和我都不知道到底什么坏了");
  assert.notEqual(st.err, "这一次没成", "还是那句什么都没说的兜底");
  assert.match(st.err, /上游把这次请求打回来了/);
  // 原文里的关键数字得留着：一眼能看出是不是 65535 被上游拒了
  assert.match(st.raw, /输出上限 65535 tok/);
  assert.match(st.raw, /等了 1\.2 秒/);
});

test("③ 之二：认不出来的仍然只给她那句兜底，绝不把异常原文摆到她眼前", () => {
  const { G, store } = boot();
  seedBox(store);
  G.markReviewFail("c1", "TypeError: undefined is not a function");
  const st = G.reviewState("c1");
  assert.equal(st.err, "这一次没成");
  assert.ok(st.raw.includes("TypeError"), "原文那一份还是得留着，不然还是查不了");
});

test("③ 之三：一句明说「不是超时」的诊断，不许被判成超时", () => {
  const { G, store } = boot();
  seedBox(store);
  // callDiag 的原话里带着「不是超时」——按顺序先跑 /超时/ 的话就会判反（第一版就这么错的）
  G.markReviewFail("c1", "〔m｜等了 1.2 秒＝上游直接打回来了（拦截／格式／配额），不是超时〕");
  assert.equal(G.reviewState("c1").err, "上游把这次请求打回来了");
  // 真超时那一句照旧认得出来
  G.markReviewFail("c1", "〔m｜等了 150 秒＝等到一半才断，像超时或冷启动〕");
  assert.equal(G.reviewState("c1").err, "等太久，超时了");
});

test("重来一次会把上一次的结论清干净", () => {
  const { G, store } = boot();
  seedBox(store);
  G.markReviewFail("c1", "网络没连上");
  G.markReview("c1");
  const st = G.reviewState("c1");
  assert.equal(st.err, ""); assert.equal(st.raw, "", "上一次的原文赖着不走，会指着旧账说新话");
});

test("真改出来了：预算清零、败因清干净", () => {
  const { G, store } = boot();
  seedBox(store);
  G.markReview("c1"); G.markReviewFail("c1", "网络没连上");
  const n = G.review("c1", { me: { person: "她比我以为的更能扛。" }, us: {} });
  assert.equal(n, 1);
  const st = G.reviewState("c1");
  assert.equal(st.tries, 0); assert.equal(st.err, "");
});

test("界面上那两句：「没变」不许再说成「都没成」", () => {
  const page = SRC.slice(SRC.indexOf("hasAny(charId) ? (function () {"));
  assert.match(page, /if \(rv\.okAt\) lines\.push\("替" \+ say\("他"\) \+ "复看过一遍，" \+ say\("他"\) \+ "觉得没什么要改的"\)/);
  assert.match(page, /else if \(rv\.tries\)/, "两句还是并列的——「没变」会跟「都没成」一起印出来");
  // 原文那颗键：两条路（复看 / 建卡）都得有，别只修一处。
  // ⚠️数那句字面量出现几次是不够的——把它的显示条件关掉，字面量还在原地。
  //   要数的是【它各自挂在自己那份 raw 上】。
  assert.match(SRC, /rv\.raw \? h\("div", null,/, "复看那一路的原文没挂上");
  assert.match(SRC, /st\.raw \? h\("div", null,/, "建卡那一路的原文没挂上");
  assert.equal((SRC.match(/whyOpen \? "收起原话" : "到底哪儿没成"/g) || []).length, 2);
  // 可点区域照 tabs-not-plain-pills §2
  assert.equal((SRC.match(/minHeight: 40, display: "inline-flex", alignItems: "center", padding: "0 8px 0 0"/g) || []).length, 2);
});

test("建卡那一路同病同治：原文也留着", () => {
  const { G, store } = boot();
  store.x_gaze = JSON.stringify({ c1: { seeded: false, blocks: {}, hist: [] } });
  G.markAutoSeedFail("c1", "模型返回为空（停止原因：max_tokens）〔输出上限 65535 tok〕");
  const st = G.autoSeedState("c1");
  assert.match(st.raw, /输出上限 65535 tok/, "建卡那一路的原文还在被扔");
  // 这一句里没有 callDiag 那个「上游直接打回来了」的结论，所以只说到「一个字都没吐出来」——
  // 那正是对的：认得多少说多少，剩下的靠原文那一份。
  assert.equal(st.err, "模型一个字都没吐出来");
});

// ── v64.40：她第三轮报「不行」，这次原文露出来了，写的是「没解析出卡」 ──────
//
// 那是我自己 throw 里的一句话，等于什么都没说——**一句只描述「我没看懂」的错误
// 是个死胡同：它不含任何能往下查的东西**。所以先让它带上【他到底说了什么】。
// 带上之后当场看见病根：
//
//   engine 里有个加固版 parseJSONLoose，它自己的注释就写着
//   「任何『拿模型返回当 JSON 用』的地方都该走它，别再各写各的」。
//   主聊天、群聊、小剧场、跑团、同人文都走了，**只有建卡和复看这两枪没跟上**。
//   差别正好落在这一处的痛点上：这十块要的是「亲笔碎句」，模型很容易在 JSON
//   字符串里直接敲一个真换行——JSON.parse 当场死，repairJSON 只补截断补不了它。
//   于是每一次都「没解析出卡」，四次全一样，因为它根本不是抖动，是必然。
const vm2 = require("node:vm");
const ENG = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const P = (() => {                       // 把 engine 里那四个真函数抠出来跑，不重写一份
  const ctx = { console }; vm2.createContext(ctx);
  ["extractJSON", "repairJSON", "escapeJsonStringControls", "parseJSONLoose"].forEach(n => {
    const i = ENG.indexOf("function " + n + "(");
    assert.ok(i > 0, n + " 不见了");
    const j = ENG.indexOf("\nfunction ", i + 1);
    vm2.runInContext(ENG.slice(i, j < 0 ? ENG.length : j), ctx);
  });
  return ctx;
})();

test("④ 病根：JSON 字符串里一个真换行，裸 extractJSON 就整份丢掉", () => {
  const bad = '{"me":{"person":"她是和我反复拉扯的另一端。\n她总能一句话把我拽回来。","soft":null},"us":{}}';
  assert.equal(P.extractJSON(bad), null, "裸的那条路要是能解了，这条测试就没在测病根了");
  const ok = P.parseJSONLoose(bad);
  assert.equal(ok.me.person, "她是和我反复拉扯的另一端。\n她总能一句话把我拽回来。");
});

test("④ 建卡和复看两枪都换成加固版（别只修一处）", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const seed = app.slice(app.indexOf("const seedGazeFor = async (char, auto)"), app.indexOf("const maybeAutoSeedGaze"));
  const rev = app.slice(app.indexOf("const reviewGazeFor = async (char, manual)"), app.indexOf("const maybeAutoReviewGaze"));
  [["建卡", seed], ["复看", rev]].forEach(([zh, seg]) => {
    assert.match(seg, /parseJSONLoose\(raw\)/, zh + "那一枪还在用裸的 extractJSON");
    assert.doesNotMatch(seg, /const parsed = extractJSON\(raw\);/, zh + "还留着旧那行");
    // 解析不出来时必须带上他的原话，否则又是一句「我没看懂」的死胡同
    assert.match(seg, /throw new Error\("没解析出卡。他这回答的是：\\n" \+ String\(raw \|\| ""\)\.slice\(0, 320\)\)/, zh + "报错里没带他的原话");
  });
});

test("④ 提示词把「没变」也逼进 JSON 里", () => {
  const spec = SRC.slice(SRC.indexOf("function reviewSpec(uName, charId)"), SRC.indexOf("function review(charId, data)"));
  // 这一问最可能的正确答案就是「什么都没变」，而那句话用中文说比填一份全 null 的
  // JSON 自然得多——不说死的话他很可能直接答一句话，一个大括号都没有。
  assert.match(spec, /就算十块一块都没变，也【必须】把上面那份 JSON 原样输出/);
  assert.match(spec, /不许改成一句话回答「没什么要改的」/);
  assert.match(spec, /连 \/\/ 也不行/, "注释这条没说，模型爱在 null 后面写「\/\/ 没变」");
});
