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
  const net = grab(app, "  const genNetizenQ = async char => {", "  // 我问的:先【放进箱子】", 3400);
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

// ── ⑤ 网友的提问不再从答案倒推 ─────────────────────────────────────────────
test("网友是谁由客户端掷骰，不把「问什么」全交给模型", () => {
  const tone = grab(app, "  const ANON_ASKER_TONE = [", "  ];", 1600);
  const angle = grab(app, "  const ANON_ASKER_ANGLE = [", "  ];", 1200);
  assert.ok((tone.match(/"/g) || []).length / 2 >= 8, "立场太少，掷不出花样");
  assert.ok((angle.match(/"/g) || []).length / 2 >= 10, "方向太少");
  // prompt-no-content-samples.md：只许给维度和判据，不许塞例句——给了例句，
  // 五条问题会一齐长成那个句式
  [tone, angle].forEach(pool => {
    assert.ok(!/[？?]"/.test(pool), "池子里塞了具体的例句，模型会照着那个句式生成一整批：" + pool.match(/"[^"]*[？?]"/));
  });
  const net = grab(app, "  const genNetizenQ = async char => {", "  // 我问的:先【放进箱子】", 3400);
  assert.match(net, /anonDraw\(ANON_ASKER_TONE, n\)/);
  assert.match(net, /anonDraw\(ANON_ASKER_ANGLE, n\)/);
  assert.match(net, /不是从答案倒推一个正好答得上的问题/, "没有挑明「别从答案倒推问题」——那正是她说的病");
  assert.match(net, /这些已经问过了/, "没避重，会一直问同几句");
});

test("一次多来几条，天花板不再压着", () => {
  const net = grab(app, "  const genNetizenQ = async char => {", "  // 我问的:先【放进箱子】", 3400);
  assert.match(net, /const n = 5 \+ Math\.floor\(Math\.random\(\) \* 3\);/, "一次的条数没放大");
  // 注释里说得着这个词（写着原来压在 4200），所以只看代码
  const netCode = net.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(!/maxTokens/.test(netCode), "又把 token 天花板写死了——runProbe 默认就是满的（65535）");
  // 默认那一档确实是满的
  const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
  assert.match(eng, /const want = probe\.maxTokens \|\| \(window\.StylePresets && window\.StylePresets\.OUT_CEILING\) \|\| 65535;/);
});

// ── ③ 我问的 / 网友问的分开，每条带日期 ─────────────────────────────────────
test("两种来源分得开，每条带日期", () => {
  assert.match(box, /r\.from === "me" \? "我问的" : "网友问的"/, "两种来源的标签分不开");
  assert.match(box, /dayOf\(r\.ts\) \+ " · " \+ timeAgo\(r\.ts\)/, "没有日期，只有相对时间");
  assert.match(box, /const dayOf = ts =>/, "没有算日期的地方");
  assert.match(box, /\["all", "全部"[\s\S]{0,220}\["netizen", "网友问的"/, "没有分开看的三格");
  assert.match(box, /tab === "all" \|\| \(tab === "me" \? r\.from === "me" : r\.from !== "me"\)/, "筛选筛错了");
});
