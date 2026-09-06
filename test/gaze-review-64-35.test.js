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

// ⑥ 原来那两条钉的是【只缩一级】那一版的形状（user / userSlim / head）。
// v64.55 换成三级阶梯之后它们说的已经不是现在这套了——整条删掉，
// 现在的形状由 ⑨ 那几条钉着（撤掉东西要删除，不留着说它错了）。
test("⑥ 两枪都走同一个 gazeCall，别只改一处", () => {
  // v64.57：sys 挪进 levels 之后签名变成 gazeCall(p, levels, onFallback)
  assert.equal((APP.match(/await gazeCall\(p, levels, zh =>/g) || []).length, 2);
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
  // 空的时候不发一个空栏目——v64.60 起这件事由 base 那个三元表达式表达：
  // 没有世界书时 base 就等于 bare，而不是拼一个空的【世界书】进去。
  assert.equal((app.match(/const base = gazeLore \? [\s\S]{0,400}?: bare;/g) || []).length, 2);
  // ⚠️v64.55 起它在 base 里＝三级全都带着。缩料时不许把她要的这一层缩掉。
  //（那一条钉在 ⑨ 里，这儿只确认它确实落在 base 上、而不是只挂在最全那一级。）
  // v64.60：base 的形状变成 gazeLore ? 带世界书的一份 : bare（最后一级要用 bare）
  const bases = app.match(/const base = gazeLore \? "【你的人设】[\s\S]{0,320}?: bare;\n/g) || [];
  assert.equal(bases.length, 2);
  bases.forEach(b => assert.ok(b.includes("【世界书】"), "世界书没落在 base 上，前几级就吃不到"));
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

// ── v64.55：她 2026-09-06 试了一圈之后报的规律 ──────────────────────────
//   「就是被拦出了 toast 说聊天记录，试了别人也是这样。我试了好几个只有两个能过。
//     感觉我没说过 18+ 的话的人都能过，除了图里这位。但是我也没跟他说过」
//
// ⚠️**有角色能过，就说明这十道题的问法本身不是主因**——否则谁都过不去。
//   踩线的是每个角色自己带的料。这是一条很硬的排除，别再往提示词措辞上想。
//
// 而上一版只缩一级（去掉聊天记录），剩下的料里【长期记忆】正是聊天浓缩出来的：
// 聊天里的东西它照样带着，所以只缩聊天记录等于没缩干净。改成一级一级往下缩。
// ⚠️封顶三级、只在确认被内容拦时才往下走、成一级立刻停：她按次计费，
//   一次失败最多变三次，不许无限试。
test("⑨ 阶梯的顺序：先缩聊天、再缩记忆；人设和世界书缩到最后也留着", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const arrs = app.match(/const levels = \[[\s\S]*?\];/g) || [];
  assert.equal(arrs.length, 2, "建卡和复看各要一份");
  // 级数各是几级由 ⑪/⑬ 钉（建卡 4、复看 5）；这儿只管【缩的先后顺序】
  arrs.forEach(a => {
    assert.ok(a.indexOf('zh: "整份"') < a.indexOf('zh: "去掉聊天记录"'), "顺序反了：得从最全的开始");
    assert.ok(a.indexOf('zh: "去掉聊天记录"') < a.indexOf('zh: "连长期记忆也去掉"'), "记忆得在聊天之后才缩");
    // 最后一级用 base：人设 + 世界书 + 好感度，一样都不少
    // v64.57：每一级自己带 sys 了，所以这儿连 sys 一起认
    assert.match(a, /zh: "连长期记忆也去掉", sys: \w+, text: base \+ NO_CHAT/);
    // 世界书是最后才舍的那一层（⑬ 单独钉）
    assert.ok(a.indexOf('zh: "连长期记忆也去掉"') < a.lastIndexOf('zh: "连世界书也不发"'));
  });
  // base 里必须有世界书（前几级都靠它）；记忆不许留在 base 里，否则第三级就没缩到东西。
  // v64.60：base 变成 gazeLore ? 带世界书的一份 : bare。
  const bases = app.match(/const base = gazeLore \? [\s\S]{0,400}?: bare;/g) || [];
  assert.equal(bases.length, 2);
  bases.forEach(b => {
    assert.ok(b.includes("【世界书】"), "前几级也不带世界书了");
    assert.ok(!b.includes("【长期记忆】"), "记忆还留在 base 里，那第三级就没缩到东西");
  });
  // 记忆单独一段，第二级才连它一起去掉
  assert.equal((app.match(/const mem = "\\n\\n【长期记忆】/g) || []).length, 2);
});

test("⑨ 成一级就停；只有被拦才往下走；封顶就是级数", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const call = app.slice(app.indexOf("const gazeCall = async"), app.indexOf("const [gazeReviewBusy"));
  assert.match(call, /for \(let i = 0; i < levels\.length; i\+\+\)/, "不是按级数封顶了");
  assert.match(call, /if \(!gazeBlocked\(e\)\) throw e;/, "别的错也往下缩＝白花钱");
  assert.equal((call.match(/await callAI\(/g) || []).length, 1, "一层循环里只该有一处调用");
  assert.match(call, /levels\[i\]\.sys/, "sys 不按级取，system 那半就永远缩不掉（v64.57 的病根）");
  assert.match(call, /if \(i && onFallback\) onFallback\(levels\[i\]\.zh\)/, "不是第一级成的，得让她知道这份是凭什么写的");
  // 三级都没成时那句结论
  assert.match(call, /都试过了，还是被拦——/);
  // v64.57：第四级连卡的正文都不摆回去了，所以那句结论也收窄了
  assert.match(call, /连世界书和这张卡自己的正文都没再发，剩下的只有【人设】本身和这十道题/);
});

test("⑨ 那句结论翻成人话，而且排在更笼统那句前面", () => {
  const { G, store } = boot();
  seedBox(store);
  G.markReviewFail("c1", "这条线路把提示词拦了；去掉聊天记录、连长期记忆也去掉 都试过了，还是被拦——剩下的只有【人设】或【这张卡自己的正文】。");
  assert.equal(G.reviewState("c1").err, "聊天记录和长期记忆都去掉了还是被拦，剩下人设或这张卡本身");
  const why = SRC.slice(SRC.indexOf("function plainWhy(msg)"), SRC.indexOf("function markReviewFail("));
  assert.ok(why.indexOf("聊天记录和长期记忆都去掉了") < why.indexOf("去掉聊天记录也还是被拦"), "顺序反了，这句永远轮不到");
});

test("⑨ 降级只在她按了键时才吭声（auto 那一路不打扰她）", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /gazeCall\(p, levels, zh => \{ if \(!auto\) toast\("被拦了，" \+ zh \+ "才写成的"\); \}\)/);
  assert.match(app, /gazeCall\(p, levels, zh => \{ if \(manual\) toast\("被拦了，" \+ zh \+ "才写成的"\); \}\)/);
});

// ── v64.56：她贴了沈屿白的整份人设过来 ────────────────────────────────
// 那份人设**本身完全干净**——而且主聊天天天带着同一份人设、同一个模型在跑，一次没拦过。
// 再加上她那条「只有两个能过」：
//   · 光有这十道题不够（有角色能过）
//   · 光有人设也不够（主聊天用同一份人设没事）
// ⇒ 是【人设 × 问法】撞在一起。她那份人设里有「姐姐」「年龄差」「调情」「撒娇」，
//   而这十块里三块问的是「她的软肋和雷区」「我吃她哪一套」「我假装没注意的事」——
//   合起来读就是「分析这个真人的弱点、什么招对她管用、她有什么把柄」。
//   人设是她的，改不得；能动的只有我这半边。
// ⚠️只换【发给模型的措辞】，界面上那十个名字一个字不动——那是她的东西。
const G = boot().G;
test("⑩ 两套名字：界面照旧，发出去的换了说法", () => {
  assert.equal(G.KEYS["me.soft"], "她的软肋和雷区", "界面上的名字被动了");
  assert.equal(G.KEYS["me.like"], "我吃她哪一套·头疼哪一套");
  assert.equal(G.KEYS["us.elephant"], "我假装没注意的事");
  // 三份真提示词里，那股「给真人做弱点分析」的味道一处都不剩
  const bad = ["软肋", "雷区", "吃她哪一套", "把柄", "假装没注意"];
  // ⚠️「每轮那一句」里那行点名是【有 due 才发】的：拿一个随手的桩去调 spec，
  //   那一行根本不出现，于是把 ASK 换回 KEYS 也测不出来（第一版就这么逃掉了）。
  //   所以这儿两条都要：源码上钉住它用的是 ASK，行为上再造一个真有 due 的桩。
  assert.match(SRC, /「" \+ ASK\[due\.k\] \+ "」\(" \+ due\.k \+ "\)"/, "每轮那一句又发老说法了");
  const b2 = boot();
  b2.store.x_gaze = JSON.stringify({ c1: { seeded: true, mute: 0, hist: [], turns: 99,
    blocks: { "me.soft": { text: "她送我键盘那次。", ts: Date.now() - 40 * 86400000 } } } });
  const nudged = String(b2.G.spec("Lisa", "c1") || "");
  assert.match(nudged, /【这一轮请复看这一块】/, "桩没造出 due 来，这一条又白测了");
  [["建卡", G.seedSpec("Lisa")], ["复看", G.reviewSpec("Lisa", "c1")], ["每轮那一句", nudged]]
    .forEach(([zh, t]) => bad.forEach(w =>
      assert.equal(String(t || "").includes(w), false, zh + "那份里还带着「" + w + "」")));
  assert.match(G.seedSpec("Lisa"), /什么事会让她一下子不好受/);
  assert.match(G.seedSpec("Lisa"), /她哪些地方最打动我、哪些地方让我头疼/);
  assert.match(G.seedSpec("Lisa"), /有件事我一直没提/);
});

test("⑩ 覆盖那一行的 key 打错字，模块直接起不来", () => {
  // ⚠️我第一版的闸问的是「ASK 会不会漏一块」——**那根本不可能**：
  //   ASK 是 Object.assign({}, KEYS, {...}) 出来的，永远带着全部 key。
  //   写完才发现那道闸从来不会触发（这条测试当场抓到的）。
  //   真会出事的是【覆盖那一行的 key 打错字】：写成 "me.softt"，
  //   ASK 里多一条垃圾，而 me.soft 悄悄退回老说法——提示词变回去了，界面上一点看不出来。
  const bad = SRC.replace('"me.soft": "什么事会让她一下子不好受"', '"me.softt": "什么事会让她一下子不好受"');
  assert.throws(() => {
    const ctx2 = { window: { localStorage: { getItem: () => null, setItem: () => {} } }, document: { createElement: () => ({}) },
      React: { useState: v => [v, () => {}], createElement: () => null }, h: () => null, F_BODY: "", F_DISPLAY: "", console };
    ctx2.globalThis = ctx2; ctx2.localStorage = ctx2.window.localStorage;
    vm2.createContext(ctx2); vm2.runInContext(bad, ctx2);
  }, /发给模型那套说法里，这个 key 打错了：me\.softt/);
});

test("⑩ 名字只剩两份，不许再抄第三第四份", () => {
  // 原来 spec 的 keys 串和 seedSpec 的 schemaHint 各自把十个名字又抄了一遍。
  // 现在都从 ASK 长出来；照字面数一下，除了 ME/US 那两行不该再有第二处。
  ["她的软肋和雷区", "我吃她哪一套·头疼哪一套", "我假装没注意的事"].forEach(n => {
    const inCode = SRC.split("\n").filter(l => !l.trim().startsWith("//") && l.includes(n));
    assert.equal(inCode.length, 1, "「" + n + "」在代码里出现了 " + inCode.length + " 处，只该在 ME/US 那一行");
  });
  assert.match(SRC, /const _side = \(arr, sd\) =>/, "spec 那串 keys 又写死了");
  assert.match(SRC, /me: ME\.reduce\(\(o, \[k\]\) => \(o\[k\] = ASK\["me\." \+ k\], o\), \{\}\)/, "schemaHint 又写死了");
});

test("⑩ 他用哪一套说法答回来都认，抄说明回来都不算写", () => {
  const g = boot().G;
  assert.equal(g.normKey("me", "什么事会让她一下子不好受"), "me.soft", "他照新说法答，这一块会被静悄悄丢掉");
  assert.equal(g.normKey("us", "有件事我一直没提"), "us.elephant");
  assert.equal(g.normKey("me", "她的软肋和雷区"), "me.soft", "老说法不认了");
  // 把栏目说明原样抄回来当内容，两套都得挡（他现在看到的是新那套）
  assert.equal(g.apply("c9", "me", "soft", "什么事会让她一下子不好受"), false);
  assert.equal(g.apply("c9", "us", "elephant", "我假装没注意的事"), false);
  assert.equal(g.apply("c9", "us", "elephant", "她其实还在等我回答那句话。"), true, "真写的一句被误挡了");
});

// ── v64.57：她 2026-09-06 给出的那条决定性观察 ────────────────────────
//   「一开始做这块的时候是好的，第一次让他们写一次也是可以的。
//     除了有没有说过 18+ 以外我能想到唯一的区别是刚出版那会我有没有让他写 10 版了。
//     **写了的人都失败了，都卡在 16-20 天前。剩下新人让他们写是可以过的**」
//
// 新人走的是【建卡】，写过的人走的是【复看】——两份提示词只差一样东西：
// **复看那份会把这张卡现在写的十块正文原样摆回去给他看**（reviewSpec 的 rows）。
// 而前三级缩的全是 user 那半（聊天、记忆），**卡的正文在 system 那半，一次都没缩到**。
// 「卡在 16-20 天前」＝那正是这些卡最后一次写成的日子；此后每次复看都被拦。
//
// ⚠️所以阶梯得能缩 system，不只是 user。第四级换成建卡那份问法（整份重写）——
//   它就是新人能过的那一份。
// ⚠️重写回来的照旧交给 Gaze.review 落地：apply 遇到一模一样的原文返回 false，
//   所以「没变的那几块他照原样写回来」天然不算改动，不会污染时间戳。
test("⑪ 每一级自己带 sys：复看的第四级换成建卡那份问法", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const call = app.slice(app.indexOf("const gazeCall = async"), app.indexOf("const [gazeReviewBusy"));
  assert.match(call, /const gazeCall = async \(p, levels, onFallback\)/, "sys 还是整条阶梯共用一份");
  // v64.60：料全挪进 system 之后写法变成 levels[i].sys + "\n\n" + levels[i].text
  assert.match(call, /await callAI\(p, levels\[i\]\.sys \+ /, "没按级取 sys，那 system 那半永远缩不掉");

  const rev = app.slice(app.indexOf("const reviewGazeFor = async (char, manual)"), app.indexOf("const maybeAutoReviewGaze"));
  const arr = rev.slice(rev.indexOf("const levels = ["), rev.indexOf("];", rev.indexOf("const levels = [")));
  assert.equal((arr.match(/zh: "/g) || []).length, 5, "复看是五级（末级连世界书也不发）");
  // 前三级还是复看那份问法（要「逐块比对」就得看得见旧的）
  assert.equal((arr.match(/sys: revSys/g) || []).length, 3);
  // 第四级：不摆正文，改用建卡那份
  assert.match(arr, /zh: "不把这张卡现在写的摆回去（改成整份重写）", sys: window\.Gaze\.seedSpec\(uN\)/);
  // 建卡那一路本来就没有卡的正文，所以还是三级
  const seed = app.slice(app.indexOf("const seedGazeFor = async (char, auto)"), app.indexOf("const maybeAutoSeedGaze"));
  const arr2 = seed.slice(seed.indexOf("const levels = ["), seed.indexOf("];", seed.indexOf("const levels = [")));
  assert.equal((arr2.match(/zh: "/g) || []).length, 4);
  assert.equal((arr2.match(/sys: seedSys/g) || []).length, 4, "建卡四级都该是同一份问法");
});

test("⑪ 病因确认：复看那份【真的】把卡的正文摆了回去，建卡那份没有", () => {
  const { G, store } = boot();
  store.x_gaze = JSON.stringify({ c1: { seeded: true, hist: [], blocks: {
    "me.soft": { text: "她送我键盘那次的样子。", ts: Date.now() - 18 * 86400000 } } } });
  assert.match(G.reviewSpec("Lisa", "c1"), /她送我键盘那次的样子。/, "复看没摆正文，那这条推断就站不住");
  assert.equal(G.seedSpec("Lisa").includes("她送我键盘那次的样子。"), false, "建卡那份不该有卡的正文");
  // 「卡在 16-20 天前」——那个天数也是从卡里算出来的，一并确认这一份真读了卡
  assert.match(G.reviewSpec("Lisa", "c1"), /最近一次改动已经是 18 天前/);
});

test("⑪ 整份重写回来，没变的那几块不算改动", () => {
  const { G, store } = boot();
  const old = "她送我键盘那次的样子。";
  store.x_gaze = JSON.stringify({ c1: { seeded: true, hist: [], blocks: {
    "me.soft": { text: old, ts: Date.now() - 18 * 86400000 } } } });
  // 第四级是整份重写：他会把没变的那几块照原样写回来
  const n = G.review("c1", { me: { soft: old, person: "她比我以为的更能扛。" }, us: {} });
  assert.equal(n, 1, "照原样写回来的那一块被当成改动了——时间戳会被污染，红点也会乱亮");
  const box = JSON.parse(store.x_gaze).c1;
  assert.equal(box.blocks["me.soft"].text, old);
  assert.equal(box.blocks["me.person"].text, "她比我以为的更能扛。");
});

test("⑪ 四级都被拦时那句结论：只剩人设本身", () => {
  const { G, store } = boot();
  seedBox(store);
  G.markReviewFail("c1", "这条线路把提示词拦了；去掉聊天记录、连长期记忆也去掉、不把这张卡现在写的摆回去（改成整份重写） 都试过了，还是被拦——连这张卡自己的正文都没再摆回去，剩下的只有【人设】本身。");
  assert.equal(G.reviewState("c1").err, "连这张卡的正文都不发了还是被拦，只剩人设本身");
  const why = SRC.slice(SRC.indexOf("function plainWhy(msg)"), SRC.indexOf("function markReviewFail("));
  assert.ok(why.indexOf("连这张卡的正文都不发了") < why.indexOf("聊天记录和长期记忆都去掉了"), "顺序反了，这句永远轮不到");
});

// ── v64.60：她 2026-09-06 第四级也被拦了——「就是只剩人设了」 ─────────
//
// ⚠️先更正我上一条的说法：阶梯只证明了「不在聊天、不在记忆、不在卡的正文里」，
//   剩下的是【人设 ＋ 世界书 ＋ 这十道题】三样，不是人设单独。别把结论说过头。
//
// 而这里有个一直没人动过的差别：**主聊天把人设放在 system 里，
// 这两枪一直是把人设当成 user 的正文发出去的**。同一段字，作为「用户说的话」
// 递上去，和作为「给你的设定」摆在 system 里，输入过滤器读起来完全是两件事。
// 而这个 app 自己的一次性生成调用（周刊/朋友圈那几处）本来就是
// 「料全在 system，user 只有一句『开始。』」——只有这两枪没跟上。又是同一个形状。
test("⑫ 料全放 system，user 只留一句「开始。」", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const call = app.slice(app.indexOf("const gazeCall = async"), app.indexOf("const [gazeReviewBusy"));
  assert.match(call, /await callAI\(p, levels\[i\]\.sys \+ "\\n\\n" \+ levels\[i\]\.text, \[\{ role: "user", content: "开始。" \}\]/,
    "料还挂在 user 上");
  // 跟这个 app 自己那三处一次性生成写法一致（不是我新发明的形状）
  assert.ok((app.match(/\[\{ role: "user", content: "开始。" \}\]/g) || []).length >= 4);
});

test("⑬ 最后一级连世界书也不发（她要的那一层放在最后才舍）", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  // bare = 人设 + 好感度，没有世界书；base = bare 里插进世界书
  const bares = app.match(/const bare = "【你的人设】[\s\S]{0,220}?;\n/g) || [];
  assert.equal(bares.length, 2);
  bares.forEach(b => assert.equal(b.includes("【世界书】"), false, "bare 里还带着世界书，那最后一级就没缩到东西"));
  const bases = app.match(/const base = gazeLore \? "【你的人设】[\s\S]{0,320}?: bare;\n/g) || [];
  assert.equal(bases.length, 2, "没有世界书时 base 就该等于 bare，别多发一个空栏目");
  bases.forEach(b => assert.ok(b.includes("【世界书】")));
  // 级数：建卡 4、复看 5；最后一级都是 bare
  const seed = app.slice(app.indexOf("const seedGazeFor = async (char, auto)"), app.indexOf("const maybeAutoSeedGaze"));
  const rev = app.slice(app.indexOf("const reviewGazeFor = async (char, manual)"), app.indexOf("const maybeAutoReviewGaze"));
  const arr = t => t.slice(t.indexOf("const levels = ["), t.indexOf("];", t.indexOf("const levels = [")));
  assert.equal((arr(seed).match(/zh: "/g) || []).length, 4);
  assert.equal((arr(rev).match(/zh: "/g) || []).length, 5);
  [["建卡", arr(seed)], ["复看", arr(rev)]].forEach(([zh, a]) => {
    assert.match(a, /\{ zh: "连世界书也不发", sys: [^,]+, text: bare \+ NO_CHAT \}/, zh + "的最后一级不是 bare");
    // ⚠️它必须【在最后】：世界书是她点名要的一层，前面每一级都得还带着
    assert.ok(a.lastIndexOf('zh: "连世界书也不发"') > a.indexOf('zh: "连长期记忆也去掉"'), zh + "把世界书缩得太早了");
  });
});

test("⑬ 全都缩过还是被拦时，那句话不许说过头", () => {
  const { G, store } = boot();
  seedBox(store);
  G.markReviewFail("c1", "这条线路把提示词拦了；…… 都试过了，还是被拦——连世界书和这张卡自己的正文都没再发，剩下的只有【人设】本身和这十道题。");
  assert.equal(G.reviewState("c1").err, "世界书、卡的正文都不发了还是被拦，只剩人设本身");
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  // ⚠️「这十道题」也得算在嫌疑里——它是唯一没法缩掉的那一样（缩了就没得问了）
  assert.match(app, /剩下的只有【人设】本身和这十道题/);
});
