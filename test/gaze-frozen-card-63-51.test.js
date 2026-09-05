// Ta 眼里冻住那一路（她 2026-09-05：「Ta 眼里还是不改啊看都不看的」）。
//
// 截图给的是硬证据：顾朝那张卡，看得见的三块全写着「19 天前写的」，
// **一块「又想了一遍 · 没改」都没有**。界面上那两句是这么来的：
//   checks[k] > blocks[k].ts → 「又想了一遍 · 没改」（他填了 impressionChecked）
//   否则                     → 「N 天前写的」
// 所以他既没改（impression 没填）、也没答（impressionChecked 也没填）——
// 走的是【两个字段都不填】那条路。
//
// 那条路原来在代码这一道**一点代价都没有**：只 tick 一下把 turns 加一。而 turns
// 早就过了门槛，dueBlock 又只按「写过/复看过」排队 → 同一块被点名点到天荒地老，
// 另外九块一次都轮不到，界面上还看不出他是「真没得改」还是「压根不理」。
//
// 三处一起补：
//   排队 —— 沉默也算碰过（passAt），队伍转得动；位置用【序号】不是【时刻】
//   位置 —— 点名那一段挪到整份提示词的尾巴上（线下一直如此，线上从来没对齐）
//   保证 —— 卡长期冻住就补一次【专门的复看调用】，照建卡那一路的形状
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), gaze = R("gaze.js"), components = R("components.js");
const appCode = app.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

// ⚠️时钟必须冻住。排队原来拿 Date.now() 当队列位置，测试里十次 markChecked
//   本该落在同一毫秒、排成并列——可 JSON 反复读写慢到跨了毫秒，于是【坏的实现
//   也能过】（变异测试当场证明：把序号改回时刻，这条断言一声不吭）。
//   冻住时钟，并列才是真并列。
function loadGaze() {
  const store = {};
  const clock = { t: 1757000000000 };
  const ctx = {
    Date: new Proxy(Date, { get: (o, k) => (k === "now" ? () => clock.t : o[k]) },),
    React: { useState: () => [null, () => {}] },
    ReactDOM: { createPortal: () => null },
    document: { body: {} }, F_BODY: "", F_DISPLAY: "",
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(gaze, ctx);
  return { G: ctx.Gaze, store, clock };
}
// 把这张卡的所有写入时刻推回 n 天前（存档里就是这么存的：blocks[k].ts）
function ageCard(store, id, days) {
  const d = JSON.parse(store.x_gaze);
  Object.keys(d[id].blocks).forEach(k => { d[id].blocks[k].ts -= days * 86400000; });
  store.x_gaze = JSON.stringify(d);
}
// 把一张【十块写满、且已经过了门槛】的卡摆出来
function fullCard(G, id) {
  ["person", "soft", "like", "recent", "unread"].forEach((b, i) => G.apply(id, "me", b, "我" + b + i));
  ["what", "how", "marks", "elephant", "want"].forEach((b, i) => G.apply(id, "us", b, "我们" + b + i));
  // ⚠️tick 是先问 dueNow 再把 turns 加一，所以要过门槛得多转两轮：
  //   第 26、27 次 tick 才真的是【点了名却没答】那两轮。
  for (let i = 0; i < G.STALE_TURNS + 2; i++) G.tick(id);
  return id;
}

test("他两个字段都不填时，代码这一道得留下痕迹——不然「没得改」和「不理」长得一样", () => {
  const { G } = loadGaze();
  const id = fullCard(G, "frozen1");
  assert.ok(G.muteCount(id) > 0, "点了名却没答，一次都没数");
  // 答了就断连击——哪怕答的是「不用改」
  G.markChecked(id, G.dueBlock(id).k);
  assert.equal(G.muteCount(id), 0, "他答了话，沉默连击还挂着");
  // 真写了也断
  for (let i = 0; i < G.STALE_TURNS; i++) G.tick(id);
  assert.ok(G.muteCount(id) > 0);
  G.apply(id, "me", "person", "换了个说法的新内容");
  assert.equal(G.muteCount(id), 0, "他真改了一块，沉默连击还挂着");
});

test("一直沉默也得把队伍转下去——不然另外九块一次都轮不到", () => {
  const { G } = loadGaze();
  const id = fullCard(G, "frozen2");
  const seen = new Set();
  // 一路沉默：只 tick，不 apply 也不 markChecked
  for (let i = 0; i < 120; i++) { seen.add(G.dueNow(id).k); G.tick(id); }
  assert.equal(seen.size, Object.keys(G.KEYS).length, "一路沉默下来只点到 " + seen.size + " 块，队伍没转");
});

test("排队的位置是序号不是时刻——同一毫秒碰过的几块不许并列", () => {
  const { G } = loadGaze();   // 时钟是冻住的：这十次复看全落在同一毫秒
  const id = fullCard(G, "frozen3");
  // 十块连着复看（测试里全在同一毫秒），队伍必须仍然一块一块往下走
  const seen = new Set();
  for (let i = 0; i < 12; i++) { const k = G.dueBlock(id).k; seen.add(k); G.markChecked(id, k); }
  assert.equal(seen.size, Object.keys(G.KEYS).length, "同一毫秒里队伍卡住了，只轮到 " + seen.size + " 块");
  assert.match(gaze, /const ORDER_BASE = 1e15/, "老存档没有 order 时要能退回按时刻排");
});

test("沉默转队只管排队，绝不许在界面上冒充「他又想了一遍」", () => {
  const { G } = loadGaze();
  const id = fullCard(G, "frozen4");
  const k = G.dueNow(id).k;
  for (let i = 0; i < 10; i++) G.tick(id);
  assert.equal(G.checkedAt(id, k), 0, "他没答，checks 却被写了——界面会说他『又想了一遍』，那是假的");
  // 界面读的就是 checks，不是 passAt
  assert.match(gaze, /var ck = \(box\.checks \|\| \{\}\)\[fk\] \|\| 0;/);
  assert.ok(gaze.indexOf("passAt") > 0 && !/passAt.*又想了一遍/.test(gaze));
});

test("点名那一段单拎出来，好让它待在整份提示词的最后", () => {
  const { G } = loadGaze();
  const id = fullCard(G, "frozen5");
  const s = G.spec("阿棠", id);
  const tailless = G.spec("阿棠", id, { tail: true });
  assert.match(s, /这一轮请复看这一块/, "整份 spec 该照旧带着点名（线下走这一路）");
  assert.ok(tailless.indexOf("这一轮请复看这一块") < 0, "tail:true 还带着点名，就没法挪到尾巴上");
  assert.match(G.nudge("阿棠", id), /这一轮请复看这一块/);
  // 字段说明两路一模一样，只差点名那一段——各写一份迟早只改一处
  assert.equal(s.replace(G.nudge("阿棠", id), ""), tailless);
});

test("连着沉默要在提示词里说出来——沉默原来也没有反作用力", () => {
  const { G } = loadGaze();
  const id = fullCard(G, "frozen6");
  assert.ok(G.nudge("阿棠", id).indexOf("轮被点名却两个字段都没填") < 0, "刚点第一次就开始数落他");
  for (let i = 0; i < 6; i++) G.tick(id);
  assert.match(G.nudge("阿棠", id), /连着 \d+ 轮被点名却两个字段都没填/);
});

// ── 代码那一道：卡冻住就补一次专门的复看调用 ─────────────────────
test("卡冻住才动：有内容 + 很久没改 + 他确实被点名却不吭声，三条缺一不可", () => {
  const { G } = loadGaze();
  // 空卡不归这里管（那是建卡那一路）
  for (let i = 0; i < 200; i++) G.tick("empty");
  assert.equal(G.reviewDue("empty"), false, "空卡被复看那一路抢走了，建卡就永远轮不到");
  // 刚写过的卡不动
  const id = fullCard(G, "fresh");
  for (let i = 0; i < 200; i++) G.tick(id);
  assert.equal(G.reviewDue(id), false, "刚写过就要复看，那是白花她的钱");
});

test("十四天没动 + 连着不吭声 → 才补那一次；带上限和冷却，修不好就停手", () => {
  const { G, store, clock } = loadGaze();
  const id = fullCard(G, "old1");
  assert.equal(G.reviewDue(id), false, "卡才刚写过就要复看，那是白花她的钱");
  ageCard(store, id, 20);                            // 二十天没动过了
  assert.equal(G.reviewDue(id), false, "光是久没改就动手了——他可能一直在正常答话");
  for (let i = 0; i < 40; i++) G.tick(id);           // 而且他确实一直不吭声
  assert.equal(G.reviewDue(id), true, "两条都成立了还不补那一次，这张卡就永远冻着");
  assert.match(gaze, /const REVIEW_DAYS = 14/);
  assert.match(gaze, /const REVIEW_MUTE = 12/);
  assert.match(gaze, /const REVIEW_MAX = 3/);
  // 上限：试满三次就不再试（她按次计费，修不好就停手）
  ["a", "b", "c"].forEach(() => G.markReview(id));
  assert.equal(G.reviewState(id).tries, 3);
  assert.equal(G.reviewDue(id), false, "冷却里就该按住");
  clock.t += 60 * 60000;                             // 冷却早过了，仍然不许再试
  assert.equal(G.reviewDue(id), false, "试满三次还在试，那就成了每天一次的自动调用");
});

test("复看那一份问的是「哪几块已经不对了」，不是「你对她怎么看」", () => {
  const { G, store } = loadGaze();
  const id = fullCard(G, "old2");
  ageCard(store, id, 20);
  const sp = G.reviewSpec("阿棠", id);
  // 现行十块要原样摆给他看，否则他只能凭空再编一份
  Object.keys(G.KEYS).forEach(k => assert.ok(sp.indexOf(G.KEYS[k]) >= 0, "复看没把这一块给他看：" + k));
  assert.match(sp, /哪几块已经跟你现在心里的不一样了/);
  assert.match(sp, /没变就是没变，不必为了交差改字/, "不给「没变」留出口，他就会为了交差乱改");
  assert.match(sp, /20 天前/, "得告诉他上次改是多久以前");
  // 跟建卡那一份一样，不许出现内容示范（prompt-no-content-samples）
  assert.ok(!/如「/.test(sp), "复看那份又写了「如……」的示范");
});

test("复看写进来的走同一个 apply：原样抄回来不算改，真改了才清零重来", () => {
  const { G } = loadGaze();
  G.apply("rv", "me", "person", "她比看上去能扛");
  G.markReview("rv");
  assert.equal(G.review("rv", { me: { person: "她比看上去能扛" }, us: {} }), 0, "一字不改也算写了一块");
  assert.equal(G.reviewState("rv").tries, 1, "一块没改却把次数清了，下次冻住还会再花一次");
  assert.equal(G.review("rv", { me: { person: "她比看上去能扛,只是不说" }, us: {} }), 1);
  assert.equal(G.reviewState("rv").tries, 0, "真改出来了，次数没清零");
});

// ── 接线 ────────────────────────────────────────────────────
test("接线：先记标记再打调用；线上线下都接上，跟建卡那一路挂在同一处", () => {
  assert.match(appCode, /if \(window\.Gaze\.markReview\) window\.Gaze\.markReview\(char\.id\)/);
  assert.match(app, /先记游标再刷/, "为什么先记标记，写在代码里");
  // 两条补救路必须挂在一起：分开挂迟早只改一处（这个仓库的老毛病）
  assert.match(appCode, /try \{ maybeAutoSeedGaze\(char\); \} catch \(e\) \{\}\n\s*try \{ maybeAutoReviewGaze\(char\); \} catch \(e\) \{\}/);
  assert.match(appCode, /maybeAutoSeedGaze\(char, \(\(workSess && workSess\.msgs\) \|\| \[\]\)\.length\); \} catch \(e\) \{\}\n\s*try \{ maybeAutoReviewGaze\(char\); \}/);
  // 言秋不塑形、NPC 不参与——跟建卡那一路同一套闸
  const fn = app.slice(app.indexOf("const maybeAutoReviewGaze"), app.indexOf("const maybeAutoReviewGaze") + 400);
  assert.match(fn, /char\.npc/);
  assert.match(fn, /engineerEyes/);
  // maxTokens 给足（max-tokens-floor：一整份卡是「一屏名单」那一档）
  const call = app.slice(app.indexOf("const reviewGazeFor"), app.indexOf("const maybeAutoReviewGaze"));
  // v63.91 开满（她亲口点名）：上限是天花板不是花销，给宽了一分钱也不多花
  assert.match(call, /maxTokens: 65535/);
});

test("她盯着一张冻住的卡时得有个按得动的东西", () => {
  assert.match(gaze, /onReview, reviewBusy/, "GazePage 没收这两个 prop");
  assert.match(gaze, /hasAny\(charId\) && onReview \? h\("button"/, "有内容的卡上没有复看按钮");
  assert.match(components, /onGazeReview, gazeReviewBusy/, "状态卡没把这条线传下去");
  assert.match(components, /onReview: onGazeReview, reviewBusy: gazeReviewBusy/);
  assert.match(app, /onGazeReview: \(\) => \{ if \(!apiFor\(scc\.id\)\) return toast\("请先配置 API"\); reviewGazeFor\(scc\); \}/);
});

test("卡有内容却长期不动时，这一页得把实话说出来", () => {
  // 原来这段诊断只挂在空卡那一支：卡有内容之后，「真没得改」和「被点名四十轮没答」
  // 在这一页上长得一模一样——她只看得到十张「19 天前写的」。
  const page = gaze.slice(gaze.indexOf("function GazePage"), gaze.indexOf("window.Gaze = {"));
  assert.match(page, /hasAny\(charId\) \? \(function \(\) \{/);
  assert.match(page, /被点名复看 " \+ mu \+ " 轮没答话/);
  // v63.90：「2/3 次」是给我看的日志格式，她要的是「试满了没有」＋一句人话
  assert.match(page, /自动复看过 " \+ rv\.tries \+ " 次"/);
  assert.match(page, /rv\.tries >= rv\.max \? "；试满了，往后不再自动试" : ""/);
});
