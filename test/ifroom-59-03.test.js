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
  assert.match(K.IF_SCALE, /岔路口换了方向/);
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
