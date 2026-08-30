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
  assert.ok(calls.length >= 3, "pageSkin 的调用处找不全：" + calls.length);
  calls.forEach(c => assert.ok(c.indexOf("word") < 0, "还有一处带着页底大字：" + c.trim().slice(0, 90)));
  assert.doesNotMatch(fic, /wordLift/, "抬词那一层也该跟着撤干净");
  // 机制本身留着，别处还在用
  assert.match(core, /function skinWordLayer\(word, rgb, a, lift\)/);
});

test("⚠️所有 return 都得包在纸里——阅读页那支是提前 return 的，最容易漏", () => {
  assert.match(fic, /const onPaper = function \(node\) \{ return h\(ThemeContext\.Provider, \{ value: t \}, node\); \};/);
  assert.match(fic, /return onPaper\(h\(Reader, \{/, "翻开一篇就掉回原来的主题了");
  assert.match(fic, /return onPaper\(\n\s*h\("div", \{ className: "h-full flex flex-col", style: pageSkin/);
  // t 得真的是纸算出来的，不是 useTheme() 直接来的
  assert.match(fic, /const appTheme = useTheme\(\);/);
  assert.match(fic, /const t = ficPaperTheme\(appTheme, ficPaper\(\{ paper: paperId \}\)\);/);
});

test("深色纸上的高对比卡不许是一大块亮色——那是把深夜模式做废", () => {
  const i = fic.indexOf("  function ficTone(dark, t) {");
  const seg = fic.slice(i, i + 900);
  assert.match(seg, /if \(skinIsDark\(t\.bg\)\) \{/, "深纸没有单独一支，会拿 ink 当底＝亮米色怼脸上");
  assert.match(seg, /bg: skinShade\(t\.bg, -0\.34\)/, "深纸上该比纸再沉一档");
  assert.match(fic, /function skinShade\(hex, k\)/);
  // 浅纸那一支照旧
  assert.match(seg, /return \{ onDark: true, bg: t\.ink, ink: t\.bg2/);
});

test("在设置里换一张，立刻重绘", () => {
  assert.match(fic, /const \[paperId, setPaperId\] = useState\(function \(\) \{ return \(loadCfg\(\) \|\| \{\}\)\.paper \|\| FIC_PAPER_DEFAULT; \}\);/);
  assert.match(fic, /onPaper: setPaperId,/, "设置页换了纸，外面不知道");
  assert.match(fic, /onClick: function \(\) \{ patch\(\{ paper: pp\.id \}\); props\.onPaper && props\.onPaper\(pp\.id\); \}/);
  assert.match(fic, /onPaper: props\.onPaper,/, "Mine 没把这条线透给设置页");
  // 小样用的就是那张纸自己的色，不是另配的示意色
  assert.match(fic, /background: pp\.bg, borderRadius: 11/);
  assert.match(fic, /color: pp\.ink, lineHeight: 1\.2 \} \}, pp\.label/);
});
