// 她 2026-09-07：「我让秋秋改梦境变白还是没有变化。其他的也只是能改顶框，这是对的吗」。
//
// 不对。查下来是两件事：
//   ① 顶栏能改，是因为顶栏走的是共用 Head（v65.17 刚统一），挂点长在它身上；
//      正文那些卡片、按钮、列表是各页自己内联写的，CSS 抓不住——那本来就该走 pagecolor。
//   ② 而【梦境】连 pagecolor 也不吃：它自己写死了一套夜色，压根不问主题要颜色。
//      逐页真跑量下来，这样的页一共七个。
//
// 这一版：梦境接上（她原本要的那件事），剩下六个登记进一张【会缩短的表】，
// 秋秋写到那几页当场被拒、她在工作台里挑到也看得见——不许再有「说改好了其实没变」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const dream = R("js/dream.js"), studio = R("js/theme-studio.js"), asst = R("js/assistant.js"), ui = R("js/theme-studio-ui.js");

test("梦境那套夜色变成【底稿】：真正发下去的那份过一道 themeFor", () => {
  assert.match(dream, /const NIGHT_BASE = \{/, "底稿那份没了");
  assert.match(dream, /const nightNow = \(\) => \(typeof window !== "undefined" && window\.ThemeStudio && window\.ThemeStudio\.themeFor\)\s*\n\s*\? window\.ThemeStudio\.themeFor\("dream", NIGHT_BASE\) : NIGHT_BASE;/,
    "没接到主题上（或者接的不是 dream 这一页）");
  // ⚠️每一处都得【现取】：在模块加载时算一次的话，她改完主题这一页不会跟着变
  assert.ok(!/const t = NIGHT;/.test(dream), "还有地方把那套夜色当常量拿");
  assert.equal((dream.match(/nightNow\(\)/g) || []).length, 6, "六处（四个组件 + 页底 + 定义）都要现取");
  // 页底那层星空也跟着走：底色和点缀色都从现取的那份来
  assert.match(dream, /const N = nightNow\(\);/);
  assert.match(dream, /pageSkin\("night", N, \{ base: N\.bg, tint: \(typeof skinRGB === "function" \? skinRGB\(N\.tint\)/);
});

test("自己写死配色的那几页记在一张表里，而且只有一份", () => {
  assert.match(studio, /const OWN_PALETTE = Object\.freeze\(\{/);
  ["tarot", "ledger", "weekly", "fanfic", "dreamjournal", "impression", "map"].forEach(k =>
    assert.match(studio, new RegExp("\\n    " + k + ": \""), "表里少了 " + k));
  // 梦境已经接上了，不该还在表里
  assert.ok(!/\n    dream: "/.test(studio), "梦境已经接上主题了，还留在表里就会被白白拒掉");
  assert.match(studio, /TOKENS, TOKEN_KEYS, OWN_PALETTE,/, "没导出去，秋秋和界面都拿不到");
  // ⚠️两处用同一份，不许各抄一份
  assert.match(asst, /\(ts\.OWN_PALETTE \|\| \{\}\)\[id\]/, "秋秋那边没问它要");
  assert.match(ui, /\(studio\.OWN_PALETTE \|\| \{\}\)\[page\]/, "工作台那边没问它要");
  assert.ok(!/tarot: "整页是那片夜空"/.test(asst) && !/tarot: "整页是那片夜空"/.test(ui), "有人又抄了一份表");
});

test("写到那几页当场被拒，而且说清是哪一页、为什么", () => {
  const pc = asst.slice(asst.indexOf("pagecolor: {"), asst.indexOf("memory: {"));
  assert.match(pc, /if \(own\) throw new Error/, "没拒");
  assert.match(pc, /不会有任何变化/, "没说清「改了也不会变」");
  assert.match(pc, /跟她说实话/, "没要求他照实说");
  // 提示词里也说了这件事，省得他反复试
  const note = asst.slice(asst.indexOf("function themeCssNote"), asst.indexOf("const SHAPE"));
  assert.match(note, /当场被拒并告诉你是哪一页/);
  assert.match(note, /别换个法子硬试/);
});

test("她自己在工作台里挑到那几页，也看得见为什么改不动", () => {
  const css = ui.slice(ui.indexOf('section === "css"'), ui.indexOf("这一页抓得住的挂点"));
  assert.match(css, /这一页换不了色/);
  assert.match(css, /它的颜色不是从主题里取的/);
  assert.match(css, /上面的页面 CSS 照旧能改它的顶栏、半窗这些共用件/, "没说清还能改什么");
});
