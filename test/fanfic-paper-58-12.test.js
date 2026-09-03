const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fic = fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8");
const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
const F = (() => {
  const a = fic.indexOf("  const FIC_PAPERS = [");
  const b = fic.indexOf("  const CFG_DEFAULT", 0) > a ? fic.indexOf("  const CFG_DEFAULT") : fic.indexOf("  function loadCfg", a);
  const seg = fic.slice(a, fic.indexOf("\n  }", fic.indexOf("function ficPaperTheme(base, paper)")) + 4);
  const rgb = core.slice(core.indexOf("function skinRGB(hex)"), core.indexOf("// 299/587/114"));
  const dark = core.slice(core.indexOf("function skinIsDark(hex)"), core.indexOf("// 纹理表"));
  return new Function("const DEFAULT_THEME={bg:'#ece8e1',bg2:'#f6f4ef',ink:'#1b1a17',sub:'#4b493f',fog:'#96938a',line:'#ddd8cd',accent:'#c25a4a',tint:'#3f6d8c'};"
    + rgb + dark + seg + "\nreturn { FIC_PAPERS, ficPaper, ficPaperTheme, skinIsDark };")();
})();
const KEYS = ["bg", "bg2", "ink", "sub", "fog", "line", "accent", "tint"];

// 她 2026-08-30：「背景换成书页，设置加好几种预设书页包括深夜模式的可以轮换」
test("六张纸，每张都是【连纸带墨】一整套，没有半张", () => {
  assert.ok(F.FIC_PAPERS.length >= 5, "预设太少，谈不上轮换");
  const ids = F.FIC_PAPERS.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, "id 撞了");
  F.FIC_PAPERS.forEach(p => {
    assert.ok(p.label && p.hint, p.id + " 没有名字/说明");
    KEYS.forEach(k => assert.match(String(p[k]), /^#[0-9a-fA-F]{6}$/, p.id + " 的 " + k + " 不是合法色值"));
  });
  // 深夜那两张必须是【深底浅字】——只把底调黑、墨还是黑的话什么都看不见
  const night = F.FIC_PAPERS.filter(p => F.skinIsDark(p.bg));
  assert.ok(night.length >= 2, "至少要两张深夜纸");
  night.forEach(p => {
    assert.ok(!F.skinIsDark(p.ink), p.id + "：底是深的，墨也是深的——读不出来");
    assert.ok(F.skinIsDark(p.bg2), p.id + "：卡片底比纸还亮，深夜模式就废了");
  });
  // 浅纸反过来
  F.FIC_PAPERS.filter(p => !F.skinIsDark(p.bg)).forEach(p =>
    assert.ok(F.skinIsDark(p.ink), p.id + "：浅底浅字"));
});

test("换纸只换看得见的那几个色，别的继承她自己的主题", () => {
  const base = { bg: "#111", ink: "#eee", accent: "#f0f", weird: "keep-me", bubbleSkin: "x" };
  const th = F.ficPaperTheme(base, F.ficPaper({ paper: "night" }));
  KEYS.forEach(k => assert.equal(th[k], F.ficPaper({ paper: "night" })[k], k + " 没被纸覆盖"));
  assert.equal(th.weird, "keep-me", "把她主题里别的东西一起顶掉了");
  assert.equal(th.bubbleSkin, "x");
  // 认不出的 id 退回默认，不许是 undefined
  assert.equal(F.ficPaper({ paper: "不存在" }).id, "cream");
  assert.equal(F.ficPaper(null).id, "cream");
  assert.equal(F.ficPaper({}).id, "cream");
});

test("页底那个特大词去掉了（同人文这两页）", () => {
  // ⚠️认【这个文件里任何一处 pageSkin 都不许带 word】，不是查那两个旧字符串——
  // 只查旧串的话，换个词加回来测试照样绿（第一版就是这么漏的）
  const calls = fic.match(/pageSkin\([^;]*?\)\)?[,\s]/g) || [];
  // v61.12 卡片那一处 pageSkin 撤了（feed 改成目录页，条目不再自己上皮），剩最外层和阅读页
  assert.ok(calls.length >= 2, "pageSkin 的调用处找不全：" + calls.length);
  calls.forEach(c => assert.ok(c.indexOf("word") < 0, "还有一处带着页底大字：" + c.trim().slice(0, 90)));
  assert.doesNotMatch(fic, /wordLift/, "抬词那一层也该跟着撤干净");
  // 机制本身留着，别处还在用
  assert.match(core, /function skinWordLayer\(word, rgb, a, lift\)/);
});

test("⚠️所有 return 都得包在纸里——阅读页那支是提前 return 的，最容易漏", () => {
  // ⚠️FanficApp 里【每一个 return】都得罩着一层纸。认法：把所有 return 捞出来数，
  // 一个都不许是裸的——只钉某一处的写法，下次换个写法又漏（v58.12 就是这么漏的阅读页）。
  const body = fic.slice(fic.indexOf("  function FanficApp(props) {"), fic.indexOf("  window.FanficApp = FanficApp;"));
  // 缩进 4~6 格、真的吐出一个元素的那几个 return（阅读页那支是 6 格，别只捞 4 格）
  const rets = (body.match(/^ {4,6}return (h\(|onPaper\()[^\n]*/gm) || []);
  assert.ok(rets.length >= 2, "捞不到 FanficApp 的 return：" + rets.length + " → " + rets.join(" ｜ "));
  rets.forEach(r => assert.match(r, /onPaper\(|ThemeContext\.Provider/, "这个 return 没罩纸：" + r.trim()));
  assert.match(fic, /const onPaper = function \(node\) \{ return h\(ThemeContext\.Provider, \{ value: t \}, node\); \};/);
  // t 得真的是纸算出来的，不是 useTheme() 直接来的
  assert.match(fic, /const appTheme = useTheme\(\);/);
  assert.match(fic, /const t = ficPaperTheme\(appTheme, ficPaper\(\{ paper: paperId \}\)\);/);
});

// v61.12 起 feed 不再有「高对比的深色卡」——她点名去掉框，改成翻开这一本的目录页，
// ficTone 整个删掉了。深纸上的读感现在由纸本身（ficPaperTheme）负责，这条测试随之撤掉。

test("在设置里换一张，立刻重绘", () => {
  assert.match(fic, /const \[paperId, setPaperId\] = useState\(function \(\) \{ return \(loadCfg\(\) \|\| \{\}\)\.paper \|\| FIC_PAPER_DEFAULT; \}\);/);
  assert.match(fic, /onPaper: setPaperId,/, "设置页换了纸，外面不知道");
  assert.match(fic, /onPick: function \(\) \{ patch\(\{ paper: pp\.id \}\); props\.onPaper && props\.onPaper\(pp\.id\); \}/);
  assert.match(fic, /onPaper: props\.onPaper,/, "Mine 没把这条线透给设置页");
  // 小样用的就是那张纸自己的色，不是另配的示意色
  assert.match(fic, /background: pp\.bg, borderRadius: 11/);
  assert.match(fic, /color: pp\.ink, lineHeight: 1\.2 \} \}, pp\.label/);
});

// 她 2026-08-30 追加：「纸页设置放同人文文章里面每一篇可以单独设置，
// 然后 example 不要写裴照川x我，写 AxB 就行。」
test("每一篇可以有自己的纸；没设的跟着默认走", () => {
  const seg = fic.slice(fic.indexOf("  function ficPaperFor(fic, cfg) {"), fic.indexOf("  function ficPaperFor(fic, cfg) {") + 380);
  assert.match(seg, /if \(fic && fic\.paper && FIC_PAPERS\.some\(/, "篇上那张没被认");
  assert.match(seg, /return ficPaper\(cfg\);/, "没设的该退回默认那张");
  // 阅读页用【这一篇】那张，外层 Provider 和传下去的必须是同一张
  assert.match(fic, /const fPaper = ficPaperFor\(f, \{ paper: paperId \}\);/);
  // v61.20 中间多了一层翻页动画的壳（fic-open-book），认的还是「同一张 fPaper」
  assert.match(fic, /h\(ThemeContext\.Provider, \{ value: ficPaperTheme\(appTheme, fPaper\) \}[\s\S]{0,260}?h\(Reader, \{\n\s*paper: fPaper,/,
    "外层套的纸和传给 Reader 的不是同一张，头上那个小色块会跟正文对不上");
  // 换纸只写这一篇
  assert.match(fic, /onSetPaper: function \(pid\) \{ updateFic\(f\.id, function \(x\) \{ x\.paper = pid; return x; \}\); \}/);
  // 撤掉单独设置＝跟着默认走，不是再选一张
  assert.match(fic, /f\.paper \? h\("button", \{[\s\S]{0,200}?onSetPaper && props\.onSetPaper\(""\)/);
  assert.match(fic, /\}, "跟着默认书页走"\) : null/);
  // 阅读页头上那个入口
  assert.match(fic, /"aria-label": "换书页"/);
  assert.match(fic, /background: _paper\.bg, border: "1\.5px solid " \+ t\.line/, "那个小色块该就是那张纸本身的颜色");
});

test("小样的示范写「A × B」——那是格式示范，不是内容示范", () => {
  // 跟 prompt-no-content-samples 同一条判据：这个例子被逐字照抄，是对的还是错的？
  // 「裴照川 × 我」照抄就是把某一对钉死在一张纸的说明里；小样是看纸和墨的。
  assert.match(fic, /\}, "A × B"\)\);/);
  assert.doesNotMatch(fic, /"裴照川 × 我"/, "小样里还写着具体的人");
  // 两处（设置页 + 阅读页那个 sheet）用的是同一个组件，别画两遍
  assert.match(fic, /function PaperSwatch\(props\)/);
  assert.equal((fic.match(/h\(PaperSwatch, \{/g) || []).length, 2, "设置页和阅读页各一处");
  assert.equal((fic.match(/"灯芯爆了一下。"/g) || []).length, 1, "小样只该有一份");
});

test("设置里那一档改叫【默认书页】，并说清哪儿能单独换", () => {
  assert.match(fic, /\}, "默认书页"\)/);
  assert.doesNotMatch(fic, /marginBottom: 9, lineHeight: 1\.5 \} \},\n\s*"换纸连墨一起换：深夜那两张是浅字深底，关灯读不刺眼。只影响同人文这几页。"/);
  assert.match(fic, /点右上角那个小色块可以单独给那一篇换/);
});
