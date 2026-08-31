const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const K = require("../js/ifroom.js");
const app = R("app.js"), scr = R("screens.js"), html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
// ⚠️结尾必须从起点【之后】找："\n}\n" 这种结尾在文件更前面到处都是，
// 从头 indexOf 会切出一段空的，断言就变成永远不成立（或永远成立）。
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };

// 她 2026-08-31 划的那条「度」。⚠️提示词里【不放她举的那几个例子】——
// 放了模型就照着抄，每条线都长成同一个样子（.claude/rules/prompt-no-content-samples.md）。
// 改成写【维度】和【判据】。
test("「度」给的是维度和判据，不是例子", () => {
  const p = K.openPrompt("裴照川", "Lisa", "");
  ["小动物", "外星人", "穿越", "失忆", "分手"].forEach(x =>
    assert.ok(p.indexOf(x) < 0, "把她举的例子写进提示词了，模型会照抄：" + x));
  // 她 2026-08-31 又点破一层：连「可动的四个维度」那张清单也是限制——
  // 清单是把例子往上抽一层，抄起来一样顺手。四个维度一个字都不许出现在提示词里。
  ["他的形态", "时代与身份", "还记不记得你", "岔路口"].forEach(x =>
    assert.ok(p.indexOf(x) < 0, "又把可动的东西列成清单了：" + x));
  assert.match(K.IF_SCALE, /没有一张「可以动什么」的清单，别去猜有哪几类/, "没挑明这里没有清单");
  assert.match(K.IF_SCALE, /只动【一样】东西/, "没说只动一样");
  // ⚠️v59.11：这里原来钉的是「该动哪一样，是从 about 那一点【最省事的一刀】倒推出来的」。
  // 她当天点破那句会把壳压向最温和的那个，「变成小狗」永远轮不上。撤掉，改成两轴独立。
  assert.ok(K.IF_SCALE.indexOf("最省事的一刀") < 0, "「最省事」那句还在，壳还是会往合理里缩");
  assert.match(K.IF_SCALE, /壳离谱到什么程度都行/, "没放开壳的上界");
  assert.match(K.IF_SCALE, /筛壳的判据不是「这个设定成不成立」/, "没说清筛壳该拿什么筛");
  assert.match(K.IF_SCALE, /动完之后他还是不是他/, "唯一那条筛壳判据没写");
  assert.match(K.IF_SCALE, /不会让人愣一下，那它多半太安全了/, "没挡住往「稳妥」那头缩");
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
  // 没给方向时两个方向都合法（v59.11）：从关系点起头、或从一个离谱的壳起头都行，
  // 交上来两样都得有。规定「必须先想关系点」就等于又把壳降成仆人。
  assert.match(K.openPrompt("A", "B", ""), /从你俩之间的哪一点起头，或者从一个离谱的壳起头，都行/, "又把起头的方向锁死了");
  assert.match(K.openPrompt("A", "B", ""), /但交上来的时候两样都得有/, "没要求两样都有");
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
  // ⚠️别再核「场景文本尾巴上挂没挂一句『不要有人』」——v59.17 撤掉了那个做法：
  // buildPhotoPrompt 整个是【画一个人】的说明书，外挂一句禁令压不住二十条人物指令，
  // 出来是人是景全看运气（她 2026-08-31 报的就是这个）。改走空景自己那条路。
  // ⚠️剥掉注释行再核：app.js 里那条说明本身就写着 buildPhotoPrompt，不剥会撞自己
  const bare = x => x.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(bare(bg).indexOf("buildPhotoPrompt") < 0, "还在走画人那条路，背景图里会冒出人来");
  assert.match(bg, /buildScenePrompt\(char, scene, \{\}\)/, "没走空景那条路");
  const sp = cut(R("engine.js"), "function buildScenePrompt(char, sceneDesc, opts) {", "\n}\n");
  assert.match(sp, /生成一张【纯空景图】/, "空景那条路第一句不是题目");
  assert.match(sp, /no people, no person, no human, no figure, no silhouette/, "无人那条铁律没中英双写");
  assert.match(sp, /场景描述里就算提到了某个人/, "没挡住场景描述自带的人味");
  // 人物那二十条一条都不许进来
  ["身体身份锁", "correct human hands", "体态自然挺拔", "参考照", "此刻穿着"].forEach(x =>
    assert.ok(sp.indexOf(x) < 0, "空景那条路混进了画人的指令：" + x));
  assert.match(bg, /imgApiReady\(\)\)\) \{ toast/, "没配图像 API 也往下画");
});

// ═══ v59.06 她 2026-08-31 看了实物之后提的四条 ═══
// 「如果馆生成后在侧边栏也显示主题吧，不然我一进去一脸懵」
// 「这个主题也不对吧怎么来来回回都是差不多的」
// 「我怎么结束这拍，或者删掉记录啊」
test("避重：已经想过的那几条原样发回去，题目和动过的东西都发", () => {
  const prior = [{ title: "未命名版本", premise: "他只是她写出来的模型", dim: "form" },
                 { title: "第一行私心", premise: "他是初代认知模型", dim: "他不再是人" }];
  const p = K.openPrompt("沈屿白", "Lisa", "", prior);
  assert.match(p, /【已经想过这几条，一条都不许再想】/);
  assert.match(p, /「未命名版本」：他只是她写出来的模型/, "旧那条没发回去");
  // 动过的那一样也要发回去，不然「同一样东西换个词说」认不出来
  assert.match(p, /｜动的是：他的形态/, "存量那几条的 dim 没翻译出来");
  assert.match(p, /｜动的是：他不再是人/, "新写法的 dim 没原样发回去");
  assert.match(p, /同一样东西变了、只是换个词说/, "只挡了字面重复");
  // 一条都没有时不发这一块（零 token）
  assert.ok(K.openPrompt("A", "B", "", []).indexOf("已经想过这几条") < 0);
  assert.ok(K.openPrompt("A", "B", "", null).indexOf("已经想过这几条") < 0);
});

// 她 2026-08-31：「这仨本质上还是给模型限制，用了去重的话那不就是每三轮轮一次一样的题材」。
// 有限清单 + 去重 ＝ 排好班的重复：第 N+1 条必然转回第一条。所以去重只许说
// 【这些不许再来】，绝不许说【那你去用剩下的那几个】。这条测的就是「没有剩下的那几个」。
test("避重不排班：没有清单，也不算还剩几格", () => {
  assert.equal(K.DIMS, undefined, "又把可动的东西列成一张导出的清单了");
  const many = ["他的形态", "他所处的时代", "他还记不记得你", "你俩那个岔路口", "他的语言"]
    .map((d, i) => ({ title: "t" + i, premise: "p" + i, about: "a" + i, dim: d }));
  const p = K.openPrompt("A", "B", "", many);
  // ⚠️「还剩几格没填」在提示词里是被【否掉】的那句，不能拿它当禁词（会撞自己）。
  // 挑的是只有排班才写得出来的说法。
  ["还剩哪", "没动过的", "里挑一样动", "都动过了", "四样"].forEach(x =>
    assert.ok(p.indexOf(x) < 0, "又在排班了，提示词里出现了：" + x));
  assert.match(p, /别顺着上面那几条往同一类里再找一个/, "没挡住「在近亲里挑下一个」");
  assert.match(p, /不是一张分类表、不是「还剩几格没填」/, "没说清这几条不是一张表");
  assert.match(p, /这一条要从 about 重新起头/, "没让它回到关系点重新起头");
  // dim 现在是模型自己写的一句话：存量 key 翻译得出来，新写法原样过
  assert.equal(K.dimZh("memory"), "他还记不记得你");
  assert.equal(K.dimZh("他忽然听得见我心里的话"), "他忽然听得见我心里的话");
  assert.equal(K.dimZh(""), "");
  // 存的时候只收口长度，不再拿清单校验——校验就等于又有了一张清单
  assert.ok(app.indexOf("window.IfKit.DIMS") < 0, "app 那端还在拿清单校验 dim");
  assert.match(app, /dim: String\(\(d && d\.dim\) \|\| ""\)\.replace\(\/\\s\+\/g, " "\)\.trim\(\)\.slice\(0, 12\)/, "dim 没收口就存了");
  assert.match(app, /K\.openPrompt\(char\.name, profile\.name \|\| "我", hint,\n            ifLinesRef\.current\.filter/, "开线时没把旧的那几条发回去");
});
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
// 她 2026-08-31：「如果只留 about 关系的那不是完全没机会给那种离谱的出场机会了，
// 比如如果你变成了小狗，如果你是外星人之类的」。
// 上一版把两根轴叠成了一根（「壳只是手段，不是目的」），筛壳的标准就变成「哪个壳最
// 合理地服务于这个关系点」，答案永远是最温和的那个。改成两根轴各管各的：
// about 管有没有分量，壳管有没有意思，谁都不派生谁；不许的只有「有壳没 about」。
test("about 和壳是两根轴，谁也不派生谁", () => {
  const p = K.openPrompt("A", "B", "");
  assert.match(K.IF_ABOUT, /about 和壳是两件事，两件都要有，谁也不是谁的仆人/, "又把壳降成手段了");
  assert.match(K.IF_ABOUT, /about 管这条线【有没有分量】，壳管这条线【有没有意思】/, "没说清两根轴各管什么");
  assert.match(K.IF_ABOUT, /或者先想到一个离谱的壳，再问它到底逼出了你俩之间的哪一点/, "没放开「从壳起头」这个方向");
  assert.match(K.IF_ABOUT, /只有一种不行：有壳、没 about/, "没挡住纯猎奇");
  assert.ok(K.IF_ABOUT.indexOf("只是把 about 那一点逼出来的手段，不是目的") < 0, "降格那句还在");
  // about 仍然必填，只是不再规定必须先想它
  assert.match(p, /但 about 空着一律作废/, "about 变成可选的了");
  assert.ok(p.indexOf("（先写这个）") < 0, "还在硬性规定先写 about");
  // ⚠️那个括号是旧四维度的残留：清单从判据表里删了，却在 IF_ABOUT 里留了个缩微版，
  // 等于清单没删、只是搬了个家——而且照样会被抄。
  ["他变成什么", "在哪个年代", "记不记得", "小狗", "外星人"].forEach(x =>
    assert.ok(K.IF_ABOUT.indexOf(x) < 0, "IF_ABOUT 里又把壳列成清单/举了例子：" + x));
  assert.match(K.OPEN_SHAPE, /^\{"about"/, "输出形状里 about 也得排头一个");
  // 方向给的是【一类】，不是让它照着填（prompt-no-content-samples）
  assert.match(K.IF_ABOUT, /方向是这一类，不是让你照着填/);
});
test("避重也认「同一个关系点」", () => {
  const prior = [{ title: "未命名版本", premise: "他只是她写出来的模型", dim: "form", about: "她一直在替他兜底" }];
  const p = K.openPrompt("A", "B", "", prior);
  assert.match(p, /｜探的是：她一直在替他兜底/, "避重块里没带上探的是什么");
  assert.match(p, /换了个壳、探的还是同一个关系点/, "没把这一种重复说出来");
  assert.match(p, /上面写着「探的是」的那几样，一个都不许再探/);
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
  const usSig = cut(scr, "function Us({", "}) {");
  const route = cut(scr, "return h(IfRoom, {", "onBack:");
  const ifSig = cut(scr, "function IfRoom({", "}) {");
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

// 她 2026-08-31：「好八股啊宝宝能不能把线下那一堆防八股喂进去」。
// 如果馆写的是【连续叙事正文】（旁白＋台词），跟线下、小剧场、同人文同一种文体。
// 真正治八股的那几刀（比喻限额、通用小动作、霸总腔、亲密反模板）全在 narrativeCore
// 里，那三处都吃着，只有如果馆当初只发了一条 ANTI_CLICHE——又是「一层只写一处，
// 别处没跟上」（.claude/rules/four-surfaces-same-context.md）。
test("如果馆吃线下那一整套反八股，不是只吃总则", () => {
  const open = cut(app, "  const ifOpen = async (char, hint) => {", "  const ifTranscript");
  const adv = cut(app, "  const ifAdvance = async (lineId, myBoxes) => {", "  const ifBg");
  [["开线", open], ["往下一拍", adv]].forEach(([zh, seg]) => {
    assert.match(seg, /narrativeCore\(\{ intimate: true \}\)/, zh + "那一次没吃 narrativeCore");
    // 光加不删就成了「在后面说前面是错的」：ANTI_CLICHE 已经在 narrativeCore 里，
    // 再单发一遍是同一段发两次
    assert.ok(!/^\s*ANTI_CLICHE \+ "\\n\\n" \+ ifCtx/m.test(seg), zh + "那一次还单发了一遍 ANTI_CLICHE");
  });
  // narrativeCore 里真的含那几刀，不是空壳（这条会跟着 engine 走，别冻死措辞）
  const eng = R("engine.js");
  const core = cut(eng, "function narrativeCore(opts) {", "\n}\n");
  ["ANTI_CLICHE", "OFFLINE_NARRATIVE_RUNTIME", "NARRATIVE_ANTI_CLICHE", "INTIMATE_ANTI_CLICHE"]
    .forEach(n => assert.ok(core.indexOf(n) > 0, "narrativeCore 里少了：" + n));
});

// 她 2026-08-31：「我发的消息没有名字，做跟角色名字一样，他们名字在框左上边我的在右上边」
test("她说的那一框也挂名字，挂在右上角", () => {
  const box = cut(scr, "function IfBox({", "\n}\n");
  assert.match(box, /mine \? \(uName \|\| "我"\) : charName/, "她那一框没拿她的名字");
  // ⚠️她那几框存下来时 who 是空的，跟旁白长得一模一样——只看 box 分不出来，
  // 必须看这一拍的 role，否则她说的话会被当成旁白（居中、灰、斜体、没名字）。
  assert.match(box, /const narr = !mine && !box\.who/, "还在拿 who 判旁白，她那几框会被当旁白");
  // ⚠️v59.14 名字牌不再是 absolute+left/right，改成一行 flex 里靠边——
  // 别把「怎么摆过去的」冻死，只核【她的在右、他的在左】这件事本身。
  assert.match(box, /justifyContent: mine \? "flex-end" : "flex-start"/, "左右没分开");
  assert.match(box, /narr \? "center" : mine \? "right" : "left"/, "她那一框的正文没靠右");
  // 传下去的那一段：role 是唯一分得出来的东西，uName 得从上面一路传进来
  // 当前那一框和上面那几框余影都得拿到 role 和名字——余影漏了，她说过的话在上面
  // 会变成没主的旁白
  // ⚠️她那几框存下来时 who 是空的，跟旁白一模一样——只有这一拍的 role 分得出来
  const body = cut(scr, "h(\"div\", { onClick: tap,", "// 我的回合");
  assert.match(body, /mine: bt\.role === "user"/, "调用处没把 role 传下去，她说的会变成旁白");
  assert.match(body, /uName: uName/, "调用处没把她的名字传下去");
  assert.match(scr, /function IfRoom\(\{ partner, lines, uName,/, "IfRoom 没收 uName");
  assert.match(scr, /uName: \(profile \|\| \{\}\)\.name \|\| "我"/, "路由没把她的名字传进如果馆");
});

// 她 2026-08-31：「可以做这种游戏对话框样式（不要照抄，我们自己设计一下样式）」
// 「回复键的样式也改一下」。v59.14 重做长相。
test("台词框长得像游戏对话框，不像它下面那个输入框", () => {
  const box = cut(scr, "function IfBox({", "\n}\n");
  // 原来台词框是【圆角 + 一圈细描边 + 半透明底】，跟输入框一模一样，一屏三种东西
  // 全是同一个观感。台词框现在实心 + 上沿一条高光 + 有阴影。
  assert.match(box, /background: narr \? "rgba\(16,13,26,\.55\)" : "rgba\(23,19,38,\.93\)"/, "台词框没做成实心");
  assert.match(box, /boxShadow: narr \? "none" :/, "台词框没有阴影，浮不起来");
  assert.match(box, /linear-gradient\(90deg,rgba\(141,118,201,\.9\)/, "上沿那条高光没了");
  // 旁白框必须一眼分得开：没有高光、没有名字牌
  assert.ok(/narr \? null : h\("div", \{\s*key: "lit"/.test(box), "旁白框也画了高光线，两种框就分不开了");
  assert.ok(/narr \? null : h\("div", \{\s*key: "who"/.test(box), "旁白框也挂了名字牌");
  // 「点一下继续」原来是底下一行灰字。改成右下角一个会跳的角标——那是游戏里的位置
  assert.match(box, /animation: "if-tick 1\.15s ease-in-out infinite"/, "没有那个会跳的小三角");
  assert.match(html, /@keyframes if-tick/, "小三角的动画没定义，它就是个不动的三角");
});

// v59.14 试过把说过的话堆成余影往上排，她当天就报：「余影太多的话会把后面的话
// 对话框显示不出来，而且太挡住后面的图了，取消了吧」。堆到五条就把当前那一框顶出
// 屏幕，背景图也被字糊死。上面那片空的本来就是留给背景图的，往前翻走侧栏。
test("正文只画当前那一框，不堆余影", () => {
  const room = cut(scr, "function IfRoom({", "\n}\n");
  const body = cut(room, 'h("div", { onClick: tap,', "// 我的回合");
  assert.equal((body.match(/h\(IfBox, \{/g) || []).length, 1, "又往上堆框了，当前那一框会被顶出屏幕");
  assert.ok(room.indexOf("const trail") < 0, "余影那段算式还留着");
  const box = cut(scr, "function IfBox({", "\n}\n");
  assert.ok(box.indexOf("past") < 0, "IfBox 里那条余影分支没删干净（撤掉东西要删掉）");
});

test("轮不到她的时候，那一整条输入区收起来", () => {
  const room = cut(scr, "function IfRoom({", "\n}\n");
  // 原来不管轮没轮到都占着一整条，只把 placeholder 换成「他还没说完」——
  // 占了半屏高度只为说一句话
  assert.match(room, /myTurn \? \[/, "输入区没按轮次收起来");
  assert.ok(room.indexOf('placeholder: myTurn ? "你说点什么') < 0, "还在用 placeholder 说「没轮到」");
  assert.match(room, /busy \? "他在写……" : line\.endedAt \? "这条已经收了" : "点一下继续"/, "收起来之后没留一行提示");
  // 三个控件同高同圆角——原来是圆角矩形 / 正圆 / 胶囊三种形状挤一行
  const row = cut(room, 'h("div", { key: "row"', "] : h(");
  assert.equal((row.match(/width: 42, height: 42, borderRadius: 12/g) || []).length, 2, "两个键没做成同高同圆角");
  assert.match(row, /minHeight: 42, maxHeight: 104, borderRadius: 12/, "输入框没跟两个键对齐");
  // 攒满了要看得出来，别默默不响应
  assert.match(row, /disabled: !typing\.trim\(\) \|\| drafts\.length >= \(\(window\.IfKit \|\| \{\}\)\.MY_BOXES_MAX \|\| 8\)/, "攒满了没灰掉");
});

// 她 2026-08-31：「以后任何情侣空间生的图都进情侣空间的合照墙吧」。
// ⚠️做成【一处存、一处读】：每加一个会生图的功能就去合照墙那儿再 concat 一次，
// 正是「一层写在三处，第四处没跟上」的长法。所以这条核的是那一份共用的存在，
// 不是「如果馆这一路接上了」。
test("情侣空间生的图统统落一处，合照墙只认那一处", () => {
  const eng = R("engine.js");
  // 存
  const add = cut(app, "  const addCoupleShot = row => {", "\n  };");
  assert.match(add, /if \(!row \|\| !row\.charId \|\| !\(row\.imgKey \|\| row\.imgUrl\)\)/, "没图没主也往里塞");
  assert.match(add, /\.slice\(0, COUPLE_SHOT_CAP\)/, "这一份没有上限，攒多了写满盘");
  assert.match(app, /saveJSON\("x_coupleShots", next\)/, "只在内存里，刷新就没了");
  assert.match(eng, /"x_coupleShots"/, "没登记进 durable，攒多了会把 localStorage 写满");
  // 读
  const duo = cut(app, "  const duoPhotosOf = cid => {", "  // 里程碑册");
  assert.match(duo, /coupleShotsRef\.current \|\| \[\]\)\.filter\(x => x\.charId === cid/, "合照墙不认这一份");
  assert.match(duo, /\.concat\([^)]*\bmine\b/, "算了却没并进墙里");
  // 如果馆这一路：生完就上墙，并且带得出是哪条线的背景
  const bg = cut(app, "  const ifBg = async lineId => {", "  // 收线。三个去处");
  assert.match(bg, /addCoupleShot\(\{ charId: char\.id, imgKey: bgKey, imgUrl: bgUrl/, "背景图没上墙");
  assert.match(bg, /from: "如果馆"/, "墙上看不出这张是哪儿来的");
});
