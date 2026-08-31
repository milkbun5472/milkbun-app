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
