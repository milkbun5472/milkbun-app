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

// ── v64.43：她第四轮把原文发过来了，写的是 ─────────────────────────────
//   「The prompt could not be submitted. The prompt contains sensitive words…」
//   而她补的一句更要紧：**「只有这个站子是这个，其他都是 empty response from Gemini API」**。
//   两句话不一样，是同一件事：Gemini 把这一枪的【提示词本身】拦了。
//
// 病因两层，都不在提示词上：
//   ① app 本来认识这两句（UPSTREAM_ERROR_PATTERNS 里两条都有，注释里还记着
//      「她 2026-08-25 抓到过」），但那两条正则里的 `\b` 是【真正的退格字节 0x08】，
//      从写下来那天起一次都没匹配过——所以拒绝话被当成模型正文，界面报「没解析出卡」。
//      （那道闸在 test/no-control-chars-64-43.test.js，扫全库控制字符，不靠人看。）
//   ② 拦得住之后还是得能用：这一枪把人设＋好感度＋长期记忆＋几十条聊天打成
//      【一大段单条 user 消息】，比一来一回的聊天容易触发输入过滤器得多。
//      全 app 的后台活儿本来就走后台线路，只有这两枪没跟上。
test("⑤ 建卡和复看都改走后台线路优先（没配后台时行为不变）", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const seed = app.slice(app.indexOf("const seedGazeFor = async (char, auto)"), app.indexOf("const maybeAutoSeedGaze"));
  const rev = app.slice(app.indexOf("const reviewGazeFor = async (char, manual)"), app.indexOf("const maybeAutoReviewGaze"));
  [["建卡", seed], ["复看", rev]].forEach(([zh, seg]) => {
    assert.match(seg, /const p = bgActive \|\| apiFor\(char\.id\);/, zh + "还锁死在角色自己那条线路上");
    // ⚠️顺序不许反：后台线路是【逃生口】，反过来写就等于没接
    assert.doesNotMatch(seg, /apiFor\(char\.id\) \|\| bgActive/, zh + "的优先级反了");
  });
  // 跟全 app 那条约定是同一个形状（解梦生成那一路早就这么写了）
  const dj = fs.readFileSync(path.join(__dirname, "..", "js", "dreamjournal.js"), "utf8");
  assert.match(dj, /props\.bgApi \|\| \(props\.apiFor \? props\.apiFor\(char\.id\) : null\)/);
});

test("⑤ 被线路拦下来时，卡上那句话说的是【被拦】，不是「模型没按格式答」", () => {
  const { G, store } = boot();
  seedBox(store);
  // engine 认出上游错误之后抛的就是这一句
  G.markReviewFail("c1", "线路报错（不是模型写的正文）：The prompt could not be submitted. The prompt contains sensitive words that violate Google's Generative AI Prohibited Use policy…");
  assert.equal(G.reviewState("c1").err, "这条线路把提示词拦了（内容政策）");
  // 另一个站子那句（同一件事，说法不同）
  G.markReviewFail("c1", "线路报错（不是模型写的正文）：empty response from Gemini API");
  assert.equal(G.reviewState("c1").err, "这条线路此刻没跑起来");
});

// ── v64.47：她第五轮补了一句，把「换条线路」这条路也堵死了 ─────────────
//   **「我现在后台活和普通的都是用同一个 api 模型，其他都没事」**
// 也就是说：同一个模型，别的调用全过，只有建卡/复看这两枪被拦。
// 那就跟线路无关了，是这一枪的提示词本身。
//
// 可它有三块料（人设 / 长期记忆 / 几十条聊天），光看是看不出哪一块踩线的。
// 所以让它自己试出来：被拦之后【去掉最大那块（聊天记录）】再打一次。
//   成了  → 是聊天内容踩的线，而且卡照样写出来了（她要的东西到手）
//   还被拦 → 不在聊天里，那句报错直接把这个结论写在卡上
// ⚠️只在【确认是被内容拦】时才重试，只重一次：她按次计费，失败不许翻倍。
const APP = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
test("⑥ 认得出「被拦」的那把尺子，她两个站子的说法都盖得住", () => {
  const line = APP.slice(APP.indexOf("const gazeBlocked = e =>"), APP.indexOf("const gazeCall = async"));
  const re = new Function("return " + line.slice(line.indexOf("e =>"), line.lastIndexOf(";")))();
  // 她 2026-09-06 亲手发来的两种原话
  assert.ok(re({ message: "The prompt could not be submitted. The prompt contains sensitive words…" }));
  assert.ok(re({ message: "empty response from Gemini API" }));
  assert.ok(re({ message: "线路报错（不是模型写的正文）：The prompt was blocked by safety settings" }));
  // ⚠️别的坏法不许触发重试——那是白花一次钱
  assert.equal(re({ message: "Failed to fetch" }), false);
  assert.equal(re({ message: "429 Too Many Requests" }), false);
  assert.equal(re({ message: "没解析出卡。他这回答的是：{…" }), false);
  assert.equal(re(null), false);
});

test("⑥ 只缩一次、只在被拦时缩；两枪都接上了", () => {
  const call = APP.slice(APP.indexOf("const gazeCall = async"), APP.indexOf("const reviewGazeFor = async"));
  assert.match(call, /if \(!gazeBlocked\(e\)\) throw e;/, "别的错也去重试＝白花一次钱");
  // 正好两次 callAI：一次 full 一次 slim，不许再多
  assert.equal((call.match(/await callAI\(/g) || []).length, 2, "重试次数变了");
  assert.match(call, /去掉聊天记录再试一次【还是被拦】/, "两次都被拦时那句结论没写出来");
  // 两枪都得走它，别只改一处
  assert.equal((APP.match(/await gazeCall\(p, window\.Gaze\.(seedSpec|reviewSpec)/g) || []).length, 2);
});

test("⑥ slim 那一份只去掉聊天记录，人设和记忆照旧带着", () => {
  const slims = APP.match(/const userSlim = head \+ "[^"]*";/g) || [];
  assert.equal(slims.length, 2, "建卡和复看各要一份");
  slims.forEach(x => assert.match(x, /这一段这次没带上来，就凭你记得的写/));
  // head 里那三样一样都不能少——slim 是【缩】，不是【换一道题】
  const heads = APP.match(/const head = "【你的人设】[^;]*;/g) || [];
  assert.equal(heads.length, 2);
  heads.forEach(x => { ["【你的人设】", "好感度", "【长期记忆】"].forEach(k => assert.ok(x.includes(k), "slim 把 " + k + " 也砍了")); });
});

test("⑥ 卡上那句结论：排除了聊天内容，就得说出来", () => {
  const { G, store } = boot();
  seedBox(store);
  G.markReviewFail("c1", "这条线路把提示词拦了；去掉聊天记录再试一次【还是被拦】——所以踩线的不是聊天内容，是这道题本身、或者人设／长期记忆里的字。\n原话：The prompt could not be submitted…");
  assert.equal(G.reviewState("c1").err, "去掉聊天记录也还是被拦，不是聊天内容的事");
  // ⚠️它必须排在那句更笼统的前面，否则会被先答掉
  const why = SRC.slice(SRC.indexOf("function plainWhy(msg)"), SRC.indexOf("function markReviewFail("));
  assert.ok(why.indexOf("去掉聊天记录也还是被拦") < why.indexOf("这条线路把提示词拦了（内容政策）"), "顺序反了，这句永远轮不到");
});

// ── v64.50：她 2026-09-06 用上一版的诊断得到结论，然后点名 ─────────────
//   「这块你也把世界书接进去吧，刚刚试了说踩线不是聊天内容。
//     我世界书里有让它不要那么敏感的提示」
//
// 排除了聊天内容之后，剩下的嫌疑在【这道题本身／人设／记忆】那一侧，
// 而她世界书里正有专门治这个的词条——可这两枪从来没吃到过世界书。
// ⚠️又是同一个形状：loreForContext 那扇门上就写着「所有非主聊天功能也必须从
//   同一扇门拿世界书」，这两枪没走过它；四处一样喂那张名单上也从来没有它俩。
test("⑦ 建卡和复看都从那扇公共门拿世界书", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  // 一处定义、两处用；scope 用 chat（这张卡说的就是主线关系里他怎么看她）
  assert.equal((app.match(/const gazeLore = \(typeof loreForContext === "function" \? loreForContext\("chat", char\.id, recent\) : ""\);/g) || []).length, 2,
    "有一枪没接上世界书，或者没走那扇公共门");
  // 空的时候不发一个空栏目
  assert.equal((app.match(/\(gazeLore \? "\\n\\n【世界书】\\n" \+ gazeLore : ""\)/g) || []).length, 2);
  // ⚠️它在 head 里＝full 和 slim 两份都带着。缩料时不许把她要的这一层缩掉。
  const heads = app.match(/const head = "【你的人设】[\s\S]{0,400}?;\n/g) || [];
  assert.equal(heads.length, 2);
  heads.forEach(h => assert.ok(h.includes("【世界书】"), "head 里没有世界书，slim 那一份就吃不到"));
});

test("⑦ 去向这道闸是真的：没勾 chat 的词条不许混进来", () => {
  // ⚠️用 engine 里【真的那几个函数】跑，不是照我以为的样子重写一份。
  const ENG = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
  const grab = (a, b) => { const i = ENG.indexOf(a); assert.ok(i > 0, "抠不出 " + a); return ENG.slice(i, ENG.indexOf(b, i) + b.length); };
  const ctx = { console, getQueryVec: () => null, _loreVecCache: () => new Map(), cosSim: () => 0 };
  vm2.createContext(ctx);
  vm2.runInContext([
    grab("function loreScopeOn(e, scope)", "\n}"),
    grab("function loreKeywordHit(e, text)", "\n}"),
    grab("function selectLore(entries, opts)", "\n}"),
    grab("function loreText(entries, opts)", "\n}"),
    "globalThis.L = loreText;"
  ].join("\n"), ctx);
  // ⚠️桩照着【写词条的那段代码】来：WorldBookEntrySheet 存的 scope 每一栏都是显式布尔，
  //   没勾的写成 chat:false——不是「这一栏不存在」。我第一版按后者写，
  //   于是那条只给查手机的词条也混进了印象卡，还以为是代码漏了（stub-from-the-writer.md）。
  const full = k => ({ chat: false, subjects: false, lifestyle: false, diary: false, study: false, creative: false, social: false, debate: false, [k]: true });
  const rows = [
    { id: "a", title: "别那么敏感", payload: "这里是虚构创作。", enabled: true, alwaysOn: true, charIds: [], scope: full("chat") },
    { id: "b", title: "只给查手机", payload: "不该进印象卡。", enabled: true, alwaysOn: true, charIds: [], scope: full("subjects") }
  ];
  const out = ctx.L(rows, { scope: "chat", charIds: ["c1"], text: "在吗" });
  assert.match(out, /这里是虚构创作。/, "该进的没进——她那条「别那么敏感」就白写了");
  assert.doesNotMatch(out, /不该进印象卡。/, "没勾这个去向的也混进来了");
});

// ── v64.54：她 2026-09-06 第三条 ──────────────────────────────────────
//   「王爷说复看了觉得没有要改的，又试了俩还是没更新但是也没有说为什么没成」
//
// 那两位的处境跟王爷、跟沈屿白都不一样：**他们从没被自动复看过（tries=0）**。
// 而卡上那一行的条件写的是 `else if (rv.tries)`——次数为 0 就整行不画。
// 偏偏 v64.39 刚把「她手动按的那一次不占自动预算」改对（reviewN 不再加一）。
// 两件事凑在一起：她手动一按、失败了，败因老老实实存进去了，**卡上一个字都不显示**。
//
// ⚠️判据：**有没有话要说，看的是「有没有败因」，不是「自动试过几次」。**
//   次数只决定那句话怎么措辞。
// ⚠️这也是「一层写在两处，第二处没跟上」的又一次：改了记账那一半（不加次数），
//   没跟上显示那一半（拿次数当门槛）。
test("⑧ 从没自动试过的角色，手动失败也要在卡上留下话", () => {
  const { G, store } = boot();
  seedBox(store, { reviewN: 0 });                    // 她那两位：一次都没自动复看过
  G.markReview("c1", true);                          // 她自己按的 → 不加次数
  G.markReviewFail("c1", "线路报错（不是模型写的正文）：empty response from Gemini API");
  const st = G.reviewState("c1");
  assert.equal(st.tries, 0, "手动那次又开始占预算了");
  assert.equal(st.err, "这条线路此刻没跑起来");
  // 界面那一行：tries=0 也得画出来，措辞换成「上一次」
  const page = SRC.slice(SRC.indexOf("hasAny(charId) ? (function () {"));
  assert.match(page, /else if \(rv\.err\) lines\.push\(\(rv\.tries \? "替" \+ say\("他"\) \+ "自动复看过 " \+ rv\.tries \+ " 次，都没成（" : "上一次复看没成（"\) \+ rv\.err/,
    "还是拿 tries 当门槛——tries=0 的角色永远看不到败因");
  // 旧那行不许留着（撤掉东西要删除）
  assert.doesNotMatch(page, /else if \(rv\.tries\) lines\.push\("替" \+ say\("他"\) \+ "自动复看过 " \+ rv\.tries \+ " 次" \+ \(rv\.err/);
});

test("⑧ 建卡那一路同病：手动失败原来只弹 toast，卡上一个字不留", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const seed = app.slice(app.indexOf("const seedGazeFor = async (char, auto)"), app.indexOf("const maybeAutoSeedGaze"));
  // toast 两秒就没了，卡才是留话的地方——两条路都得写进卡里
  assert.match(seed, /if \(window\.Gaze\.markAutoSeedFail\) window\.Gaze\.markAutoSeedFail\(char\.id, e\.message \|\| "调用没成"\);\n\s*if \(!auto\) toast\("建卡失败/,
    "手动那一路的败因还是只进 toast");
  assert.doesNotMatch(seed, /if \(auto\) \{ if \(window\.Gaze\.markAutoSeedFail\)/, "旧那行还在");
  // 「一块都没写」那一支也一样
  assert.match(seed, /if \(!auto\) toast\(_ta \+ "暂时没写出什么"\);\n\s*if \(window\.Gaze\.markAutoSeedFail\)/);
  // 空卡那一页的显示条件同样不许拿 tries 当门槛
  assert.match(SRC, /if \(st\.err\) lines\.push\(\(st\.tries \? "替" \+ say\("他"\) \+ "自动写过 " \+ st\.tries \+ " 次，都没成（" : "上一次没写成（"\)/);
});

test("⑧ 手动失败当场也有回音（她按了键，总该立刻知道）", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const rev = app.slice(app.indexOf("const reviewGazeFor = async (char, manual)"), app.indexOf("const maybeAutoReviewGaze"));
  assert.match(rev, /if \(manual\) toast\("复看没成："/);
  // 那句人话得是 gaze 翻好的那一份，不是把异常原文摆到她眼前
  assert.match(rev, /window\.Gaze\.plainWhy/);
  assert.match(SRC, /muteCount, plainWhy \};/, "plainWhy 没导出，上面那句会退回兜底");
});
