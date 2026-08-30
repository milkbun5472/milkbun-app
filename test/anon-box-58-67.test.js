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
const net = grab(app, "  const genNetizenQ = async char => {", "  // 我问的:先【放进箱子】", 6000);

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

// ── ⑤ 网友:两枪,而且写问题那一枪什么都不知道 ────────────────────────────
// 她 2026-08-30 第二轮:「这问题还是带着答案去问的,而且网友也不应该知道他是谁吧」
// 一枪打完必然两个病:写问题的那个「网友」吃的是完整人设(于是问出「工科楼五楼那个哥们」),
// 而且它会先想好答案再倒推问题。光在提示词里写「你不知道他是谁」只是降概率——
// 上下文里摆着人设它就是会漏。所以必须【两次调用,喂的东西不一样】。
test("写问题那一枪不带任何上下文——它没有的东西就漏不出来", () => {
  assert.ok(!/runProbe\([^)]*ctxFor/.test(net.slice(0, net.indexOf("第二枪"))), "写问题那一枪还在走带 bundle 的 runProbe");
  assert.match(net, /const rawQ = await callAI\(apiFor\(char\.id\), askSys/, "写问题没有单独一次裸调用");
  const ask = net.slice(net.indexOf("const askSys ="), net.indexOf("const rawQ ="));
  assert.ok(!/char\.name/.test(ask), "把他的真名递给网友了——那网友当然知道他是谁");
  assert.ok(!/ctxFor|buildBundle|persona/.test(ask), "写问题那一枪混进了人设");
  // 陌生人只看得见这三样
  assert.match(ask, /网名:/);
  assert.match(ask, /box\.bio/);
  assert.match(ask, /pastQ/, "以前问过的没递过去，会一直重复问");
  assert.ok(!/r\.a/.test(ask), "把以前的答案也递给网友了，又能从答案倒推");
});

test("提示词里把「不许猜身份」写死", () => {
  const ask = net.slice(net.indexOf("const askSys ="), net.indexOf("const rawQ ="));
  ["真名", "职业", "住在哪", "不许猜", "不许暗示你认识他"].forEach(k =>
    assert.ok(ask.includes(k), "没挡住这一项：" + k));
  assert.match(ask, /听说你们XX的人如何如何/, "没挡住「听说你们XX的人」那种按行业下的假设");
  assert.match(ask, /你写的时候并不知道他会怎么答/, "没挑明「不许从答案倒推」");
});

test("第二枪才是他，问题已经写死，倒推不了", () => {
  const ans = net.slice(net.indexOf("// 第二枪"));
  assert.match(ans, /runProbe\(apiFor\(char\.id\), ctxFor\(char\)/, "答的那一枪没带上下文");
  assert.match(ans, /qs\.map\(\(q, i\) => \(i \+ 1\) \+ "\. " \+ q\)/, "没把写死的问题递过去");
  assert.match(ans, /问偏了、问得莫名其妙、或者建立在一个错的前提上/, "没允许他直接说「不是这样」——陌生人本来就会问错");
  assert.match(ans, /不是每条都得答/);
  // 答案按顺序配回问题；模型少答几条，那几条就是空答案，不许张冠李戴
  assert.match(net, /const it = outs\[i\] \|\| \{\};/, "答案没按顺序对回问题");
  assert.match(net, /qs\.map\(\(q, i\) => \{/, "记录该以问题为准生成");
});

test("一次多来几条，天花板不再压着", () => {
  assert.match(net, /const n = 5 \+ Math\.floor\(Math\.random\(\) \* 3\);/, "一次的条数没放大");
  assert.match(net, /maxTokens: 65535/, "写问题那一枪的天花板没给满");
  const ansCode = net.slice(net.indexOf("// 第二枪")).split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(!/maxTokens/.test(ansCode), "答的那一枪又把天花板写死了——runProbe 默认就是满的");
  const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
  assert.match(eng, /const want = probe\.maxTokens \|\| \(window\.StylePresets && window\.StylePresets\.OUT_CEILING\) \|\| 65535;/);
});

test("网友是谁由客户端掷骰，不把「问什么」全交给模型", () => {
  const tone = grab(app, "  const ANON_ASKER_TONE = [", "  ];", 1600);
  const angle = grab(app, "  const ANON_ASKER_ANGLE = [", "  ];", 1200);
  assert.ok((tone.match(/"/g) || []).length / 2 >= 8, "立场太少，掷不出花样");
  assert.ok((angle.match(/"/g) || []).length / 2 >= 10, "方向太少");
  // prompt-no-content-samples.md：只许给维度和判据，不许塞例句
  [tone, angle].forEach(pool => {
    assert.ok(!/[？?]"/.test(pool), "池子里塞了具体的例句，模型会照着那个句式生成一整批");
  });
  assert.match(net, /anonDraw\(ANON_ASKER_TONE, n\)/);
  assert.match(net, /anonDraw\(ANON_ASKER_ANGLE, n\)/);
});

// ── ③ 我问的 / 网友问的分开，每条带日期 ─────────────────────────────────────
test("两种来源分得开，每条带日期", () => {
  assert.match(box, /r\.from === "me" \? "我问的" : "网友问的"/, "两种来源的标签分不开");
  assert.match(box, /dayOf\(r\.ts\) \+ " · " \+ timeAgo\(r\.ts\)/, "没有日期，只有相对时间");
  assert.match(box, /const dayOf = ts =>/, "没有算日期的地方");
  assert.match(box, /\["all", "全部"[\s\S]{0,220}\["netizen", "网友问的"/, "没有分开看的三格");
  assert.match(box, /tab === "all" \|\| \(tab === "me" \? r\.from === "me" : r\.from !== "me"\)/, "筛选筛错了");
});
