const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const grab = (src, a, b, cap) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return src.slice(i, j);
};
const box = grab(comp, "function AnonBox({", "\n}\n// 转账卡片", 16000);
const net = grab(app, "  const genNetizenQ = async char => {", "  // 我问的:先【放进箱子】");
const brew = grab(app, "  const brewAnonPool = async (cur, quiet) => {", "  const refillAnonPool = async () => {");

// ── ④ 我可以一次性放几条下去，等我按调用他再一次性看 ──────────────────────
test("写一条只是放进箱子，一分钱不花", () => {
  const drop = grab(app, "  const dropAnon = (char, q, re) => {", "  // 让他一次性打开箱子", 700);
  assert.ok(!/runProbe|callAI/.test(drop), "放进箱子这一步不该调模型");
  assert.match(drop, /pending: true/, "放进去的没标成「等着答」");
  assert.match(drop, /re: re \|\| null/, "追问没记住是接着哪一条");
  assert.match(box, /onDrop\(q\.trim\(\), replyTo\)/, "界面上「放进去」没走 dropAnon");
  assert.ok(!/onAsk\b/.test(box), "还留着旧的当场作答那条路");
});

test("打开箱子：所有等着的一次递过去，答案按 id 对回去", () => {
  const open = grab(app, "  const openAnonBox = async char => {", "  const genPhoneApp", 4200);
  assert.match(open, /\(cur\.records \|\| \[\]\)\.filter\(r => r\.pending\)\.slice\(\)\.sort\(\(a, b\) => a\.ts - b\.ts\)/, "没有把全部待答的按时间排好一起递");
  assert.match(open, /pend\.forEach\(\(r, i\) => \{ ansById\[r\.id\] = items\[i\] \|\| null; \}\)/, "答案没按记录 id 对回去");
  assert.match(open, /if \(!it\) return r;/, "模型少答几条时，剩下的必须原样留在箱子里");
  assert.match(open, /pending: false/, "答完了没销掉待答标记");
  assert.match(box, /"让 Ta 打开箱子（" \+ pending\.length \+ " 条等着）"/, "按钮上没写还有几条");
});

// ── ② 他可以不答 ────────────────────────────────────────────────────────
test("他可以不答：提示词给了这条口子，界面也有这一档", () => {
  const open = grab(app, "  const openAnonBox = async char => {", "  const genPhoneApp", 4200);
  [["打开箱子", open], ["网友提问", net]].forEach(([name, seg]) => {
    assert.match(seg, /不是每条都得答/, name + " 那条路没给「可以不答」的口子");
    assert.match(seg, /skip/, name + " 的 schema 里没有 skip");
  });
  assert.match(box, /r\.skip[\s\S]{0,320}Ta 看见了，没答/, "界面上没有「看了不答」这一档");
  assert.match(box, /r\.note \? "（" \+ r\.note \+ "）"/, "他当时的反应没显示出来");
});

// ── ⑦ 我也有马甲 ────────────────────────────────────────────────────────
test("我也有马甲：全院一份、递给他、他会猜这人是谁", () => {
  const me = grab(app, "  const genAnonMe = async () => {", "  const pAnon = (charId, updater)", 1800);
  assert.match(app, /localStorage\.getItem\("x_anonMe"\)/, "我的马甲没存盘");
  assert.match(me, /别人只看得见这两样/, "没说清这个马甲是干嘛的");
  const open = grab(app, "  const openAnonBox = async char => {", "  const genPhoneApp", 4200);
  assert.match(open, /全部来自【同一个匿名的人】/, "没告诉他这些是同一个人问的——那才有得猜");
  assert.match(open, /mask\.name/, "马甲没递给他");
  assert.match(open, /guess/, "他没有机会猜这人是谁");
  assert.match(box, /Ta 好像在猜你是谁/, "猜测没显示出来");
  assert.match(box, /myMask \? myMask\.name : "还没有"/, "界面上看不见自己的马甲");
});

// ── ① 追问 ──────────────────────────────────────────────────────────────
test("追问接着某一条，同样先进箱子", () => {
  assert.match(box, /setReplyTo\(r\.id\)/, "追问没绑到那一条上");
  assert.match(box, /"追问 · 针对 Ta 那句「"/, "写追问时看不见在追问哪一句");
  assert.match(box, /"追问 · 「" \+ String\(src\.a \|\| src\.q \|\| ""\)/, "记录上看不出这条是追问");
  assert.match(box, /\(!r\.pending && !r\.skip && r\.a\) \?/, "还没答/没答的也给了追问按钮");
});

// ── ⑤ 网友:出题在总库那一枪,跟任何角色都无关;开箱只花一次调用 ──────────
// 她 2026-08-30 第二轮:「这问题还是带着答案去问的,而且网友也不应该知道他是谁吧」
// Codex 同日指出:同一次推理里模型从头就看得见完整人设,「先写问题后写回答」只是
// 降概率。v58.69 拆成两枪解决了隔离,但每封信两次调用;这一版把出题【提前备货】——
// 全院共用一总库,出题那一枪连网名签名都不给,日常开箱回到一次调用。
test("出题那一枪不认识任何人——连网名签名都不给,它没有的东西就漏不出来", () => {
  const body = brew.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(!/runProbe|ctxFor\(|buildBundle|persona/.test(body), "出题混进了角色上下文");
  assert.ok(!/\bchar\b|characters|profile|netname|\.bio/.test(body), "把某个角色/他的网名签名递给出题那一枪了");
  assert.match(brew, /await callAI\(active, sys/, "出题不是裸调用");
  assert.match(brew, /maxTokens: 65535/, "天花板没给满");
});

test("提示词里把「不许猜身份」「不许从答案倒推」都写死", () => {
  ["男女", "做什么的", "住在哪", "不许猜", "不许暗示你认识他"].forEach(k =>
    assert.ok(brew.includes(k), "没挡住这一项：" + k));
  assert.match(brew, /听说你们XX的人如何如何/, "没挡住按行业下的假设");
  assert.match(brew, /并不知道他会怎么答/, "没挑明不许从答案倒推");
  assert.match(brew, /换个人来答就会答成另一个样子的/, "没给出「这题算不算写好了」的判据");
  assert.match(brew, /【库里已经有这些了/, "没把已有的递回去,会越攒越重复");
});

test("摇三颗骰子:谁在问 × 想撬什么 × 怎么开口", () => {
  const shape = grab(app, "  const ANON_ASKER_SHAPE = [", "  ];", 1600);
  assert.ok((shape.match(/"/g) || []).length / 2 >= 10, "第三颗骰子的面太少");
  // prompt-no-content-samples.md：只许写形状，不许塞例句
  assert.ok(!/[？?]"/.test(shape), "第三颗骰子里塞了例句,整批会照着那个句式长");
  ["ANON_ASKER_TONE", "ANON_ASKER_ANGLE", "ANON_ASKER_SHAPE"].forEach(k =>
    assert.ok(brew.indexOf("anonDraw(" + k + ", n)") > 0, "出题时没摇这一颗：" + k));
  // 一批 36 题、池子才十来面——必须能摇满,而且是再洗一副,不是随机重复
  assert.match(app, /while \(out\.length < n\) \{/, "anonDraw 摇不满一批的量");
  assert.match(brew, /const n = ANON_POOL_BATCH;/);
});

test("开箱:库存够就一次调用都不花在出题上", () => {
  assert.match(net, /if \(avail\.length < Math\.max\(n, ANON_POOL_LOW\)\) \{ pool = await brewAnonPool\(pool, true\); avail = pool\.filter\(q => !asked\[q\]\); \}/,
    "不是「不够了才补」——那就回到每封信两次调用了");
  assert.match(net, /const qs = anonDraw\(avail, Math\.min\(n, avail\.length\)\);/, "没从库里抽题");
  assert.match(net, /saveAnonPool\(pool\.filter\(q => !taken\[q\]\)\)/, "抽走的没从总库划掉,会一直抽到同几条");
  // 划账必须在答完【之后】：抽完就划,答的那一枪一失败,那几条题就白白没了
  assert.ok(net.indexOf("pAnon(char.id, cur => (") < net.indexOf("saveAnonPool(pool.filter"), "先划账后作答——失败一次就丢题");
  assert.match(net, /\(box\.records \|\| \[\]\)\.forEach\(r => \{ if \(r\.q\) asked\[r\.q\] = 1; \}\)/, "同一个箱子问过的题还会再抽一遍");
  assert.match(app, /localStorage\.getItem\("x_anonPool"\)|loadJSON\("x_anonPool"/, "题库没存盘");
  assert.match(app, /const ANON_POOL_CAP = 150;[\s\S]{0,400}list\.slice\(0, ANON_POOL_CAP\)/, "库存没有上限,会越攒越大");
});

test("答的那一枪才带上下文,问题已经写死,倒推不了", () => {
  assert.match(net, /runProbe\(apiFor\(char\.id\), ctxFor\(char\)/, "答的那一枪没带上下文");
  assert.match(net, /qs\.map\(\(q, i\) => \(i \+ 1\) \+ "\. " \+ q\)/, "没把抽到的题递过去");
  assert.match(net, /问偏了、问得莫名其妙、或者建立在一个错的前提上/, "没允许他直接说「不是这样」——陌生人本来就会问错");
  assert.match(net, /不是每条都得答/);
  const ansCode = net.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(!/maxTokens/.test(ansCode), "又把答的那一枪的天花板写死了——runProbe 默认就是满的");
  assert.match(net, /const it = outs\[i\] \|\| \{\};/, "答案没按顺序对回问题");
  assert.match(net, /qs\.map\(\(q, i\) => \{/, "记录该以问题为准生成");
});

test("题库摆在【选角色之前】那一页——出题跟谁都无关,它就该长在那儿", () => {
  const hub = grab(comp, "function AnonHub({", "// 匿名箱：仿 QQ 主页");
  assert.match(hub, /poolCount, onBrew/, "题库没接到列表页上");
  assert.match(hub, /"匿名题库 · 还剩 " \+ \(poolCount \|\| 0\) \+ " 条"/, "看不见库存");
  assert.match(hub, /写这些问题的人不知道会是谁收到/, "没跟她说清这条保证是怎么来的");
  assert.match(app, /poolCount: \(anonPool \|\| \[\]\)\.length/, "库存没递给界面");
  assert.match(app, /onBrew: refillAnonPool/, "手动补库没接上");
});

// ── ③ 我问的 / 网友问的分开，每条带日期 ─────────────────────────────────────
test("两种来源分得开，每条带日期", () => {
  assert.match(box, /r\.from === "me" \? "我问的" : "网友问的"/, "两种来源的标签分不开");
  assert.match(box, /dayOf\(r\.ts\) \+ " · " \+ timeAgo\(r\.ts\)/, "没有日期，只有相对时间");
  assert.match(box, /const dayOf = ts =>/, "没有算日期的地方");
  assert.match(box, /\["all", "全部"[\s\S]{0,220}\["netizen", "网友问的"/, "没有分开看的三格");
  assert.match(box, /tab === "all" \|\| \(tab === "me" \? r\.from === "me" : r\.from !== "me"\)/, "筛选筛错了");
});
