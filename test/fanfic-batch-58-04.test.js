const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const fic = R("fanfic.js"), app = R("app.js");
const F = (() => {
  const a = fic.indexOf("  function fmtNum(n)"), b = fic.indexOf("  // cp token：charId");
  return new Function(fic.slice(a, b) + "\nreturn { ficHasMe };")();
})();

// ── 她 2026-08-30 点的三个 bug ──
test("点过♡、追到一半的文不许被清掉", () => {
  const i = fic.indexOf("  function protectedFic(f) {");
  assert.ok(i > 0, "protectedFic 不见了");
  const seg = fic.slice(i, i + 420);
  assert.match(seg, /f\.onShelf === true \|\| f\.source === "user" \|\| f\.liked === true/, "♡ 没算进保护");
  assert.match(seg, /const r = loadRead\(\)\[f\.id\]/, "读到哪一章没算进保护");
  assert.match(seg, /return !!\(r && r\.chap > 0\)/, "只翻到第一章不算追");
});

test("那个按钮不再叫「刷新」——它只删不生成，生成在齿轮里", () => {
  assert.doesNotMatch(fic, /function refreshTab\(\)/, "旧的 refreshTab 还在，撤东西要删掉");
  assert.doesNotMatch(fic, /\}, "刷新"\)/, "按钮还叫刷新");
  assert.match(fic, /function clearTab\(\)/);
  assert.match(fic, /\}, "清空"\)/);
  // 删之前得二次确认，且说清楚删几篇留几篇
  const i = fic.indexOf("    function clearTab() {");
  const seg = fic.slice(i, i + 1100);
  assert.match(seg, /requestAppConfirm\(/, "没有 App 内二次确认");
  assert.match(seg, /function \(\) \{ if \(persistFics\(/, "删除没有被关在确认回调里");
  assert.match(seg, /doomed\.length \+ " 篇/, "没说要删几篇");
  assert.match(seg, /kept \? "另外 " \+ kept/, "没说会留几篇");
  assert.match(seg, /要新的文请点齿轮生成/, "没说清清完是空的");
  assert.match(seg, /if \(!doomed\.length\)/, "一篇都没得删时还弹确认框");
});

test("两个累积层都封了顶（phone-data-layers：满了挤掉最旧的）", () => {
  assert.match(app, /const WALLET_LOG_KEEP = 500;/);
  assert.match(app, /const nl = \[entry, \.\.\.log\]\.slice\(0, WALLET_LOG_KEEP\);/, "钱包流水还是只进不出");
  assert.match(fic, /const FIC_KEEP = 150;/);
  // 受保护的不占额度
  const i = fic.indexOf("  function saveFics(list) {");
  const seg = fic.slice(i, i + 700);
  assert.match(seg, /\(protectedFic\(f\) \? keep : pool\)\.push\(f\)/, "收藏的也被算进额度了");
  assert.match(seg, /if \(pool\.length <= FIC_KEEP\) return saveJSON/);
  assert.match(seg, /return protectedFic\(f\) \|\| live\.has\(f\.id\)/);
});

// ── 功能 B ──
test("搜得到：标题／笔名／CP 里那几个人／标签，而且跨版搜", () => {
  assert.match(fic, /const \[q, setQ\] = useState\(""\)/);
  assert.match(fic, /const \[meOnly, setMeOnly\] = useState\(false\)/);
  const i = fic.indexOf("      const hay = function (f) {");
  const seg = fic.slice(i, i + 700);
  // ⚠️认的是【真的拼进那个待搜串】，不是「文件里出现过 cpNames」——
  // cpNames 在上面几行就声明了，光找名字的话把它从数组里删掉测试照样绿
  assert.match(seg, /return \[f\.title, f\.author \|\| ficPenName\(f\.id\), cpNames, \(f\.tags \|\| \[\]\)\.join\(" "\),/,
    "标题／笔名／CP 里的人／标签，有一样没拼进去");
  // 「按 CP 找」靠的就是把 CP 里的人名一起搜进去
  assert.match(seg, /const c = characters\.find\(function \(x\) \{ return x\.id === id; \}\)/);
  assert.match(fic, /if \(meOnly && !ficHasMe\(f\)\) return false/);
  assert.match(fic, /if \(kw\) return !f\.onShelf;/, "搜的时候没跨版——她多半不记得那篇在哪一版");
  assert.match(fic, /"跨版搜「" \+ q\.trim\(\) \+ "」· " \+ list\.length/, "搜出几篇要看得见");
  assert.ok(F.ficHasMe({ cp: ["c1", "me"] }) && !F.ficHasMe({ cp: ["c1", "c2"] }));
});

// ── 配角能被写进 CP ──
test("配角（npc）能选进 CP，但转发不列他们", () => {
  // ⚠️只看同人文那一段：下一段 weekly 名正言顺地用 liveChars，
  // 窗口开大一点就会误判（第一版就踩到）
  const a = app.indexOf('screen === "fanfic"');
  const blk = app.slice(a, app.indexOf('screen === "weekly"', a));
  assert.ok(a > 0 && blk.length > 100 && blk.length < 1400, "切不出同人文那一段");
  // 照 app 既有的约定：characters 一律是真人那份，要全量的显式再要一份 allChars
  // （test/npc.test.js 守着这条，名单是一处一处点名的）
  assert.match(blk, /characters: liveChars,/);
  assert.match(blk, /allChars: characters,/, "同人文没拿到含配角的那份");
  assert.match(fic, /const cast = props\.allChars \|\| characters;/);
  // CP 选择／名字解析／CP 预设走 cast，转发走真人那份
  assert.match(fic, /characters: cast, fwdChars: characters,/, "阅读页要两份：CP 名字用全量，转发用真人");
  assert.match(fic, /fwdOpen \? h\(FwdSheet, \{ characters: props\.fwdChars \|\| props\.characters,/);
  // 六个子页逐个点名——数个数的话，加一处就得回来改数字，坏了也说不出是哪一处
  [["h(Publish, { tabs: tabs, characters: cast,", "发布"],
   ["h(Mine, { characters: cast,", "我的"],
   ["h(RPApp, { fics: fics, tabs: tabs, characters: cast,", "跑团"],
   ["h(GenSheet, { tab: curTab, cps: cps, characters: cast,", "生成配置"],
   ["fic: f, characters: cast, userName: userName,", "作品卡"],
   ["characters: cast, fwdChars: characters,", "阅读页"]
  ].forEach(x => assert.ok(fic.indexOf(x[0]) > 0, x[1] + "那一处没换成 cast，配角在那儿还是看不见"));
  assert.match(fic, /function cpOptions\(characters, userName\)/);
  // 配角单独一组，且标出是谁身边的人
  const i = fic.indexOf("  function cpOptions(characters, userName) {");
  const seg = fic.slice(i, i + 900);
  assert.match(seg, /h\("optgroup", \{ key: "_npc", label: "配角" \}/);
  assert.match(seg, /String\(x\.id\) === String\(c\.ownerId\)/, "没标出这个配角是谁身边的");
  // 五处 CP 下拉全换成同一支，别有一处漏掉
  assert.equal((fic.match(/cpOptions\(characters, props\.userName\)/g) || []).length, 5, "有 CP 下拉没换过来");
  assert.doesNotMatch(fic, /characters\.map\(function \(c\) \{ return h\("option"/, "还有手写的下拉没收编");
  // 转发只列真人：配角没有自己的聊天窗口
  assert.match(fic, /\(props\.characters \|\| \[\]\)\.filter\(function \(c\) \{ return c && !c\.npc; \}\)/);
});

// ── 每篇一个剧情框 ──
test("生成几篇就有几个框，没填的明说自由发挥", () => {
  assert.match(fic, /const \[briefs, setBriefs\] = useState\(\[\]\)/);
  assert.match(fic, /Array\.from\(\{ length: n \}, function \(_, i\) \{\n\s*return h\("div", \{ key: i/, "框数没跟着篇数走");
  assert.match(fic, /props\.onConfirm\(n, chosenCP\(\), styleIds, twoRealChars\(\) && includeMe, briefs\.slice\(0, n\), authors\.filter/);
  assert.match(fic, /async function doGen\(n, cp, styleIds, includeMe, briefs, byAuthor\)/);
  assert.match(fic, /briefs: briefList,/);
  // 没填的那几篇必须明说，否则模型拿填了的去套没填的
  const i = fic.indexOf("    const briefs = Array.isArray(opts.briefs)");
  const seg = fic.slice(i, i + 900);
  assert.match(seg, /没点，自由发挥/);
  assert.match(seg, /别去套上面那几条/);
  assert.match(seg, /当成【这一篇的地基】写足/, "没说清不是结尾提一句就算");
  assert.match(seg, /别把她那句话原样抄进正文/);
  // 一条都没填就整块不发，不白花 token
  assert.match(seg, /briefs\.some\(function \(x\) \{ return String\(x \|\| ""\)\.trim\(\); \}\)/);
  // ⚠️长文风走的是一篇一交那条支路，那条也得带上梗
  assert.match(fic, /Object\.assign\(\{\}, opts, \{ briefs: \[briefList\[i\] \|\| ""\] \}\)/, "长文风那条支路上点的梗会静默失效");
});

// ── token 放开了写 ──
test("token 直接填，且内部那两道天花板跟着抬起来", () => {
  assert.match(fic, /const FIC_TOKEN_MAX = 60000;/);
  assert.match(fic, /function clampPerFic\(v\)/);
  assert.doesNotMatch(fic, /type: "range", min: 2000, max: 8000/, "还是那把 2000–8000 的滑杆");
  assert.match(fic, /type: "number", inputMode: "numeric", min: 500, max: FIC_TOKEN_MAX/);
  // 打字打到一半不许被回填
  assert.match(fic, /onChange: function \(e\) \{ patch\(\{ perFic: e\.target\.value === "" \? "" : Number\(e\.target\.value\) \}\); \}/);
  assert.match(fic, /onBlur: function \(e\) \{ patch\(\{ perFic: clampPerFic\(e\.target\.value\) \}\); \}/);
  // 不抬天花板的话她填多少都被静默吞掉
  assert.doesNotMatch(fic, /Math\.min\(30000, 6000 \+ n \* perFic\)/);
  assert.doesNotMatch(fic, /Math\.min\(24000, perFic \+ 10000\)/);
  assert.match(fic, /Math\.min\(FIC_TOKEN_MAX \* 4, 6000 \+ n \* perFic\)/);
  assert.match(fic, /Math\.min\(FIC_TOKEN_MAX \* 2, perFic \+ 10000\)/);
  // 存里可能是空串或旧值，读的时候也夹一次
  assert.equal((fic.match(/const perFic = clampPerFic\(opts\.perFic\)/g) || []).length, 2);
});

// ── prompt 体检 ──
test("提示词里不许塞具体的内容示范（施工规则/prompt-no-content-samples.md）", () => {
  // 判据：这个例子被逐字照抄，是对的还是错的？
  // 「破镜重圆」被抄＝每篇都挂这个标签；「前未婚夫妻」被抄＝每篇都是这个关系。
  assert.doesNotMatch(fic, /如『破镜重圆』/, "tags 那行还塞着四个现成标签");
  assert.doesNotMatch(fic, /（如 前未婚夫妻\/宿敌\/上下级）/, "premise 还塞着三个现成关系");
  // 换成【判据】和【维度】
  assert.match(fic, /这几个标签要能让人一眼判断【要不要点进去】/);
  assert.match(fic, /他俩是什么关系（谁欠谁、见面为什么别扭、这段关系卡在哪儿）/);
  // schemaHint 的占位值要是【说明】不是【样例内容】
  assert.match(fic, /\\"title\\":\\"标题\\"/);
  assert.match(fic, /\\"tags\\":\[\\"标签\\",\\"标签\\"\]/);
});

test("人设每人封顶 6000，和跑团那条链同一个额度", () => {
  assert.match(fic, /const FIC_PERSONA_CAP = 6000;/);
  assert.match(fic, /function personaOf\(c\) \{ return String\(\(c && c\.persona\) \|\| ""\)\.trim\(\)\.slice\(0, FIC_PERSONA_CAP\); \}/);
  const i = fic.indexOf("  function sideDesc(c) {");
  const seg = fic.slice(i, i + 500);
  assert.match(seg, /const p = personaOf\(c\);/);
  assert.doesNotMatch(seg, /c\.persona\.trim\(\)/, "还有一处直接用了未截断的人设");
});
