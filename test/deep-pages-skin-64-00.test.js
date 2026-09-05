// 装修工单第一批深子页（她 2026-09-05：「来吧宝宝去扫一眼，特别是那些比较深的子页面」）。
//
// 扫下来的规律：**落地页大多做过了，进去一层还是米白**——随身物有柜门、记忆库有纸、
// 人格档案馆有纸，但线下的「往期回看」「赴约设置」、日历、写日记这几张，
// 一层平色到底。工单 C 那张单子也已经过期了（好几行早被别的窗口做掉、没人删）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const code = comp.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("线下那几层子页共用一份底，不是各写各的", () => {
  // 单人线下和群线下是两份代码：往期回看 + 赴约设置，一共四处。
  // 各写一份的话迟早只改一处——这个仓库最常犯的病。
  assert.match(code, /function offlineSubSkin\(t\) \{/);
  assert.equal((code.match(/style: offlineSubSkin\(t\)/g) || []).length, 4,
    "线下子页应当有四处都吃到这一份（单人往期/单人赴约/群往期/群赴约）");
  assert.ok(!/absolute inset-0 z-20 flex flex-col", style: \{ background: t\.bg, paddingTop/.test(code),
    "还有子页留着平色的老写法");
  const fn = code.slice(code.indexOf("function offlineSubSkin(t)"), code.indexOf("function SettingSection("));
  assert.match(fn, /pageSkin\("lined", t, \{ corner: false, strength: \.8 \}\)/, "挑的不是信纸");
  assert.match(fn, /paddingTop: safeTop\(0\)/, "顶部安全区丢了，会顶到刘海");
  assert.match(fn, /typeof pageSkin === "function" \? .* : \{ background: t\.bg \}/s, "没有兜底：pageSkin 没加载就整页透明");
});

test("日历铺纸，而且【故意】没铺方格", () => {
  const i0 = code.indexOf("function Calendar({ characters");
  assert.ok(i0 > 0, "找不到日历");
  const seg = code.slice(i0, code.indexOf("function CalWidget(", i0) > 0 ? code.indexOf("function CalWidget(", i0) : i0 + 40000);
  assert.match(seg, /pageSkin\("paper", t, \{ base: t\.bg2, strength: 1\.2 \}\)/);
  // ⚠️这一页自己就是一张七列的网格：再铺 23px 的方格纸，两套间距对不上，
  //   看着是两张网叠在一起。底纹是给【没有结构】的页面补结构的。
  assert.ok(!/pageSkin\("grid", t, \{ base: t\.bg2/.test(seg), "又铺回方格纸了，会和日期表那张网撞");
  assert.ok(!/className: "h-full flex flex-col", style: \{ position: "relative", background: t\.bg2 \}/.test(code),
    "日历外壳还留着平色");
});

test("写日记铺信纸——一页纸上写字，纸得有纹理", () => {
  const i = scr.indexOf("function MyDiaryCompose(");
  assert.ok(i > 0);
  const seg = scr.slice(i, i + 2600);
  assert.match(seg, /pageSkin\("lined", t, \{ base: t\.bg2, corner: false, strength: \.7 \}\)/);
  assert.ok(!/return h\("div", \{ className: "h-full flex flex-col", style: \{ background: t\.bg2 \} \},/.test(seg),
    "还留着平色的老写法");
});
