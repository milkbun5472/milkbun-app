const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const K = require("../js/ifroom.js");
const app = R("app.js"), scr = R("screens.js"), html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const cut = (s, a, b) => s.slice(s.indexOf(a), s.indexOf(b));

// 她 2026-08-31 划的那条「度」。⚠️提示词里【不放她举的那几个例子】——
// 放了模型就照着抄，每条线都长成同一个样子（.claude/rules/prompt-no-content-samples.md）。
// 改成写【维度】和【判据】。
test("「度」给的是维度和判据，不是例子", () => {
  const p = K.openPrompt("裴照川", "Lisa", "");
  ["小动物", "外星人", "穿越", "失忆", "分手"].forEach(x =>
    assert.ok(p.indexOf(x) < 0, "把她举的例子写进提示词了，模型会照抄：" + x));
  assert.match(K.IF_SCALE, /他的形态/);
  assert.match(K.IF_SCALE, /时代与身份/);
  assert.match(K.IF_SCALE, /还记不记得你/);
  assert.match(K.IF_SCALE, /岔路口/);   // 措辞随 DIMS 走，别把整句冻死（另有一条按 DIMS 逐条核）
  assert.match(K.IF_SCALE, /挑【一样】动，别一次动几样/, "没说只动一样");
  // 上不封顶和下不封底两头都要挡住
  assert.match(K.IF_SCALE, /那个人的核心一个字都不许换/, "没挡住「换了个人」那一头");
  assert.match(K.IF_SCALE, /那是今天的日程，不是如果/, "没挡住「太小」那一头");
  assert.match(K.IF_SCALE, /换个角色照样成立的，就是想坏了/, "那条通用判据没写");
});

// 跟小剧场的分界：小剧场换掉两个人是谁，如果馆两个人不变、只换一个变量
test("说清了这不是第二个小剧场", () => {
  assert.match(K.openPrompt("A", "B", ""), /他俩还是他俩，这段关系还是这段关系/, "没跟小剧场划开");
  assert.match(R("ifroom.js"), /小剧场 = 【换掉两个人是谁】/, "模块顶上没写清这个分界");
  assert.match(R("ifroom.js"), /如果馆 = 【两个人还是这两个人/, "分界只写了一半");
});

test("她给了方向就照办，没给才让他自己想", () => {
  assert.match(K.openPrompt("A", "B", "如果他忘了我"), /【她给的方向】如果他忘了我/);
  assert.match(K.openPrompt("A", "B", "如果他忘了我"), /按它来，别另起炉灶/);
  assert.match(K.openPrompt("A", "B", ""), /【她没给方向】/);
  assert.match(K.openPrompt("A", "B", ""), /从【他这个人身上】长出一条来/, "没给方向时也该长在人设上");
});

// 一个框一口气读完，点一下出下一个：旁白和台词是两种框，界面上长得不一样
test("框收得住：只认他的名字或旁白，替她说话的整框丢掉", () => {
  const out = K.normBoxes([
    { who: "", text: "雨下了一夜。" },
    { who: "裴照川", text: "醒了？" },
    { who: "Lisa", text: "这句是替她说的" },
    "纯字符串也当旁白收",
    { who: "裴照川", text: "" }
  ], "裴照川");
  assert.deepEqual(out.map(x => x.text), ["雨下了一夜。", "醒了？", "纯字符串也当旁白收"]);
  assert.deepEqual(out.map(x => x.who), ["", "裴照川", ""]);
  // ⚠️不许把她那框转成旁白留下来——摘掉名字，那句话还是替她说的
  assert.ok(!out.some(x => x.text.indexOf("替她说的") >= 0), "转成旁白留下来了");
  // 一框有上限，一拍有上限
  assert.equal(K.normBoxes([{ who: "", text: "字".repeat(500) }], "x")[0].text.length, K.BOX_CAP);
  assert.equal(K.normBoxes(new Array(30).fill({ who: "", text: "a" }), "x").length, K.BOXES_MAX);
  assert.deepEqual(K.normBoxes(null, "x"), []);
});

// ⚠️平行时空（跟小剧场/同人文/跑团同一档，four-surfaces-same-context.md）：
// 只读人设，不读主线记忆／印象卡／好感／心情，也一个字都不写回去。
test("平行时空：不走 buildBundle，主线一个字都不读", () => {
  const seg = cut(app, "  const ifOpen = async (char, hint) => {", "  // 这条线到目前为止说过什么");
  const adv = cut(app, "  const ifAdvance = async (lineId, myBoxes) => {", "  // 背景图：一条线一张");
  // ⚠️先剥注释再看：那段代码的注释里就写着「不走 runProbe」，不剥就是自己抓自己
  const bare = x => x.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  [seg, adv].forEach(x => {
    assert.ok(bare(x).indexOf("runProbe") < 0, "走了 runProbe——它内部一定 buildBundle，主线全灌进来了");
    assert.ok(bare(x).indexOf("ctxFor(") < 0, "读了主线上下文");
    assert.match(x, /callAI\(apiFor\(char\.id\)/, "没有自己拼精简 system");
  });
  const ctx = cut(app, "  const ifCtx = char => {", "  const ifSave = next =>");
  assert.match(ctx, /char\.persona/, "连人设都没给");
  ["memLib", "affinity", "moodLabel", "gazeText", "worldbook"].forEach(k =>
    assert.ok(bare(ctx).indexOf(k) < 0, "把主线的这一层漏进平行时空了：" + k));
});

// 三个去处她说都要
test("收线三个去处，记忆那条必须标着「这是个如果」", () => {
  const end = cut(app, "  const ifEnd = (lineId, how) => {", "  // ── 照相馆 ──");
  assert.match(end, /if \(how === "mem"\)/);
  assert.match(end, /text: "【一个如果】"/, "回喂记忆没标记——他会当成真发生过");
  assert.match(end, /tags: \["如果", "平行"\]/, "记忆条目没打标签");
  // 念头走欲望盒子已有那条【观测纸条】：是候选，不是既成的念想
  assert.match(end, /window\.DesireKit\.ingestCcCandidate\(box,/, "念头没走欲望盒子已有那条路");
  assert.match(end, /quote: said\.text/, "拿去当引证的不是他在这条线里真说过的话");
  assert.match(end, /if \(how === "mem"\)[\s\S]*?else if \(how === "seed"\)/, "三选一没分开");
  assert.match(scr, /\["keep", "只留在馆里"/, "界面上少了「只留在馆里」");
});

// ⚠️浏览器抓到的：js/ifroom.js 原来叫 root.IfRoom，正好和 screens.js 里那个页面组件
// 同名，两个都是全局——后加载的把组件函数盖成了一个对象，React 当场 #130。
// node --check 和整套测试一个字都不会说。
test("模块和组件不同名", () => {
  assert.match(R("ifroom.js"), /root\.IfKit = api;/, "又叫回 IfRoom 了，会把同名组件盖掉");
  assert.ok(R("ifroom.js").indexOf("root.IfRoom") < 0);
  assert.match(scr, /function IfRoom\(\{ partner, lines/, "组件不在了");
  assert.ok(app.indexOf("window.IfRoom") < 0 && scr.indexOf("window.IfRoom") < 0, "还有地方引着旧名字");
  assert.match(html, /js\/ifroom\.js\?v=/, "没挂进 index.html");
});

// 她要的：一个框一个点、右边侧栏、攒几条再一起发、不设短拍
test("界面按她说的那几条来", () => {
  const ui = scr.slice(scr.indexOf("function IfRoom({ partner, lines"));
  assert.match(ui, /const tap = \(\) => \{ if \(more\) setAt/, "不是点一下出下一框");
  assert.match(ui, /side \? h\("div"/, "没有侧栏");
  assert.match(ui, /"前面说过的"/, "侧栏里翻不到前面");
  assert.match(ui, /setDrafts\(drafts\.concat\(\[v\]\)\)/, "攒不了几条");
  assert.match(ui, /onAdvance\(line\.id, all\)/, "攒的没一起发出去");
  assert.match(ui, /"就到这儿"/, "收不了线");
  // 不设短拍：代码里不许有「第几拍就收」这种硬切
  const adv = cut(app, "  const ifAdvance = async (lineId, myBoxes) => {", "  // 背景图：一条线一张");
  assert.ok(!/beats\.length >= \d+|拍数上限|forceEnd/.test(adv), "偷偷加了短拍上限");
  assert.match(app, /const IF_CAP = 60;/, "一条线连个存量天花板都没有");
});

// 背景图：一条线一次，她自己点了才生（开线时不花图钱）
test("背景图开线时不生，她点了才生", () => {
  const open = cut(app, "  const ifOpen = async (char, hint) => {", "  // 这条线到目前为止说过什么");
  assert.ok(open.indexOf("generateSelfieImage") < 0, "开线就把图钱花了");
  assert.match(open, /bgPrompt: String\(\(d && d\.bg\)/, "开线时没把背景提示词先存下来（等她点时就不用再问一次）");
  assert.match(open, /bgKey: null/, "开线时就带着图");
  const bg = cut(app, "  const ifBg = async lineId => {", "  // 收线。三个去处");
  assert.match(bg, /generateSelfieImage/);
  assert.match(bg, /画面里不要有人/, "背景图里会冒出人来");
  assert.match(bg, /imgApiReady\(\)\)\) \{ toast/, "没配图像 API 也往下画");
});

// ═══ v59.06 她 2026-08-31 看了实物之后提的四条 ═══
// 「如果馆生成后在侧边栏也显示主题吧，不然我一进去一脸懵」
// 「这个主题也不对吧怎么来来回回都是差不多的」
// 「我怎么结束这拍，或者删掉记录啊」
test("避重：已经想过的那几条原样发回去，还挑明哪几样没动过", () => {
  const prior = [{ title: "未命名版本", premise: "他只是她写出来的模型", dim: "form" },
                 { title: "第一行私心", premise: "他是初代认知模型", dim: "form" }];
  const p = K.openPrompt("沈屿白", "Lisa", "", prior);
  assert.match(p, /【已经想过这几条，一条都不许再想】/);
  assert.match(p, /「未命名版本」：他只是她写出来的模型/, "旧那条没发回去");
  // ⚠️光说「别重复」不够：三条全落在同一个维度上正是因为它每次挑那个最顺手的
  assert.match(p, /上面那几条已经动过：他的形态/, "没说清动过哪几样");
  assert.match(p, /这一条从【他所处的时代与身份】或【他还记不记得你】或【你俩之间那个岔路口】里挑一样动/, "没指出还剩哪几样");
  // 换个说法不算新的
  assert.match(p, /同一样东西变了、只是换个词说/, "只挡了字面重复");
  // 一条都没有时不发这一块（零 token）
  assert.ok(K.openPrompt("A", "B", "", []).indexOf("已经想过这几条") < 0);
  assert.ok(K.openPrompt("A", "B", "", null).indexOf("已经想过这几条") < 0);
  // 四样都动过了也要有话说，不能空转
  const all = K.DIMS.map((d, i) => ({ title: "t" + i, premise: "p" + i, dim: d[0] }));
  assert.match(K.openPrompt("A", "B", "", all), /四样都动过了/, "四样用尽时没有下一步");
});

test("维度只写一处：判据表和 dim 都从 DIMS 长出来", () => {
  assert.equal(K.DIMS.length, 4);
  K.DIMS.forEach(d => assert.ok(K.IF_SCALE.indexOf(d[1]) > 0, "判据表里少了：" + d[1]));
  K.DIMS.forEach(d => assert.ok(K.openPrompt("A", "B", "").indexOf(d[0]) > 0, "输出里没让它填 key：" + d[0]));
  assert.equal(K.dimZh("memory"), "他还记不记得你");
  assert.equal(K.dimZh("nope"), "");
  // 存的时候要校验，模型乱填的不收
  assert.match(app, /\(window\.IfKit\.DIMS \|\| \[\]\)\.some\(x => x\[0\] === String\(\(d && d\.dim\) \|\| ""\)\) \? String\(d\.dim\) : ""/, "dim 没校验就存了");
  assert.match(app, /K\.openPrompt\(char\.name, profile\.name \|\| "我", hint,\n            ifLinesRef\.current\.filter/, "开线时没把旧的那几条发回去");
});

// 「一进去一脸懵」：侧栏和顶栏都要看得见这条线是什么
test("侧栏和顶栏都摆出这条线是什么", () => {
  const ui = scr.slice(scr.indexOf("function IfRoom({ partner, lines"));
  // 侧栏顶上：题目 + 前提 + 动的是哪一样
  const side = ui.slice(ui.indexOf("side ? h(\"div\""));
  assert.match(side, /line\.title/, "侧栏没写题目");
  assert.match(side, /line\.premise/, "侧栏没写前提");
  assert.match(side, /"这条动的是：" \+ window\.IfKit\.dimZh\(line\.dim\)/, "侧栏没说动的是哪一样");
  assert.match(side, /"前面说过的"/, "侧栏原来那块标题丢了");
  // 顶栏也带一句前提：不用掀侧栏也知道自己在哪条线里
  const top = ui.slice(ui.indexOf("h(\"div\", { className: \"flex-1 min-w-0 text-center\" }"), ui.indexOf("onClick: () => setSide(true)"));
  assert.match(top, /line\.premise/, "顶栏没带前提");
});

// 「我怎么结束这拍，或者删掉记录啊」——原来只有进到线里才收得了，删压根没有
test("列表上直接收得了、删得掉，删之前问一句", () => {
  const ui = scr.slice(scr.indexOf("function IfRoom({ partner, lines"));
  assert.match(ui, /onClick: \(\) => setEndId\(x\.id\)[\s\S]{0,180}"就到这儿"/, "列表上收不了");
  assert.match(ui, /onClick: \(\) => setDropId\(x\.id\)[\s\S]{0,200}"删掉"/, "列表上删不掉");
  assert.match(ui, /"删掉这条如果？"/, "删之前不问一句");
  assert.match(ui, /找不回来/, "没说清删了就没了");
  assert.match(ui, /已经记进记忆库或留成念头的那一份不受影响/, "没说清已经留出去的那份会怎样");
  assert.match(app, /const ifDrop = lineId => \{ ifSave\(ifLinesRef\.current\.filter\(x => x\.id !== lineId\)\); toast\("删了"\); \};/, "没有删这条路");
  // ⚠️操作行必须是卡片按钮的兄弟：按钮里不许嵌按钮
  assert.match(ui, /\/\/ ⚠️操作行必须是卡片按钮的【兄弟】/, "没写清为什么要套一层 div");
  // 三个去处只写一处：列表上收和线里收共用同一个组件
  assert.equal((scr.match(/const IF_ENDINGS = \[/g) || []).length, 1);
  assert.equal((scr.match(/h\(IfEndPick, \{/g) || []).length, 2, "两处收线没共用同一个选择器");
});

// ═══ v59.07 她 2026-08-31 的诊断 ═══
// 「而且因为阿屿设定就是 ai 情绪研究员所以模型就一直抓着这个，
//  而不是想到去抓关系里面的重点？」
//
// 她说对了，而且原因比想象的更直白：ifCtx 里【压根没有「你俩是什么关系」】，
// 只有两份人设。关系里的重点它无从抓起，只能抓人设里最显眼的那一块＝他的职业。
test("上下文里给了关系事实，但不给主线状态", () => {
  const ctx = cut(app, "  const ifCtx = char => {", "  const ifSave = next =>");
  assert.match(ctx, /【他俩是什么关系】/, "还是只有两份人设，一个字没说他俩是什么关系");
  assert.match(ctx, /已经在一起的恋人/, "没说在一起没有");
  assert.match(ctx, /到今天第 " \+ days \+ " 天/, "没说多久了");
  assert.match(ctx, /关系网上写着：/, "关系网那几个标签没给");
  // ⚠️给的只能是【关系事实】：记忆库/好感/心情/印象卡仍旧一个都不给
  const bare = x => x.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  ["memLib", "affinity", "moodLabel", "gazeText", "worldbook", "memories"].forEach(k =>
    assert.ok(bare(ctx).indexOf(k) < 0, "把主线状态漏进平行时空了：" + k));
});

// 人设里最显眼的一块会把模型整个吸过去。小剧场早就栽过同一个坑、也留了同一句话
//（「原本搞研究就总派研究员，这是偷懒」）。如果馆原来一句都没有。
test("明令不许拿职业当题目", () => {
  assert.match(K.IF_ABOUT, /绝不许拿他的职业、研究领域、专业身份当这条线的题目/);
  assert.match(K.IF_ABOUT, /那是他人设里最显眼的一块，抓它最省力/, "没说清为什么会这样");
  assert.match(K.IF_ABOUT, /换个职业照样成立的关系难题才是对的/, "没给正面判据");
  assert.match(K.IF_ABOUT, /【换个职业就不成立】的题目一律推翻重想/, "没给推翻的动作");
  assert.ok(K.openPrompt("A", "B", "").indexOf(K.IF_ABOUT) > 0, "这一段没发出去");
});

// 顺序即结构：先写「探的是你俩之间的哪一点」，再去想壳——先写关系就没法再从职业出发
test("逼它先想关系那一点，壳只是手段", () => {
  const p = K.openPrompt("A", "B", "");
  assert.match(p, /about＝这条线探的是你俩之间的哪一点（先写这个）/, "没要求先写 about");
  assert.ok(p.indexOf("about＝") < p.indexOf("title＝"), "about 排在 title 后面就不叫先写了");
  assert.match(K.OPEN_SHAPE, /^\{"about"/, "输出形状里 about 也得排头一个");
  assert.match(K.IF_ABOUT, /壳（他变成什么、在哪个年代、记不记得）只是把 about 那一点逼出来的手段，不是目的/);
  // 方向给的是【一类】，不是让它照着填（prompt-no-content-samples）
  assert.match(K.IF_ABOUT, /方向是这一类，不是让你照着填/);
});

// 换个壳、探的还是同一个关系点——那是更难发现的那一种重复（题目不一样，读起来一样）
test("避重也认「同一个关系点」", () => {
  const prior = [{ title: "未命名版本", premise: "他只是她写出来的模型", dim: "form", about: "她一直在替他兜底" }];
  const p = K.openPrompt("A", "B", "", prior);
  assert.match(p, /｜探的是：她一直在替他兜底/, "避重块里没带上探的是什么");
  assert.match(p, /换了个壳、探的还是同一个关系点/, "没把这一种重复说出来");
  assert.match(p, /上面写着「探的是」的那几样，这一条一个都不许再探/);
  assert.match(app, /about: String\(\(d && d\.about\) \|\| ""\)/, "about 没存下来，下次就避不了");
  assert.match(app, /dim: x\.dim, about: x\.about \}\)\)\)/, "存了却没发回去");
  // 界面上也要看得见——那是最值得看的一行
  assert.match(scr, /"探的是：" \+ x\.about/, "列表上看不到探的是什么");
  assert.match(scr, /"探的是：" \+ line\.about/, "侧栏里看不到探的是什么");
});

// 她 2026-08-31：「删不掉宝宝删除没反应只能点旁边的算了」。
// 病根不在删的逻辑——app.js 那边 ifDrop 一直是对的、也一直 onIfDrop 传出去了，
// 是 screens.js 这一端【压根没接】：Us 的形参里没有它，路由那行也没往下传，
// IfRoom 的签名里也没有。于是 onDrop 是 undefined，按下去抛错、弹窗还开着。
// ⚠️`node --check` 全绿、两千多条测试全绿——因为少一个 prop 不是语法错。
// 所以这里不单钉 onIfDrop，改成【把整条链核一遍】：路由里递给 IfRoom 的每一样，
// 上游必须收得到、下游必须接得住。以后再漏任何一个 prop 都会红。
test("递给如果馆的每一个回调，两头都接上了", () => {
  // cut 是从头 indexOf 找结尾的，这三段都得从起点往后找，另写一个
  const from = (a, b) => { const i = scr.indexOf(a); return scr.slice(i, scr.indexOf(b, i + a.length)); };
  const usSig = from("function Us({", "}) {");
  const route = from("return h(IfRoom, {", "onBack:");
  const ifSig = from("function IfRoom({", "}) {");
  // ① 路由里用到的 onIfXxx，Us 的形参里都得有——没有就是 undefined
  const used = [...new Set(route.match(/onIf[A-Za-z]+/g) || [])];
  assert.ok(used.length >= 5, "路由里没抓到几个回调，切歪了：" + used.join(","));
  used.forEach(n => assert.ok(new RegExp("\\b" + n + "\\b").test(usSig), "Us 没收 " + n + "，传下去是 undefined"));
  // ② 路由里给出去的每个 onXxx 键，IfRoom 的签名里都得接住——不接就用不上
  const given = [...new Set((route.match(/\bon[A-Z][A-Za-z]*\s*:/g) || []).map(x => x.replace(/\s*:$/, "")))];
  assert.ok(given.indexOf("onDrop") >= 0, "路由压根没往下传 onDrop");
  given.forEach(n => assert.ok(new RegExp("\\b" + n + "\\b").test(ifSig), "IfRoom 签名里没有 " + n + "，界面上按了没反应"));
  // ③ 删的那一步：按下去要真的调、并且把弹窗关掉（她当时的症状正是弹窗关不掉）
  assert.match(scr, /onDrop\(dropId\); setDropId\(null\)/, "删完没收掉那层问话");
  assert.match(app, /const ifDrop = lineId => \{ ifSave\(ifLinesRef\.current\.filter\(x => x\.id !== lineId\)\)/, "app 这端的删没了");
  assert.match(app, /onIfDrop: ifDrop/, "app 没把删传出去");
});
