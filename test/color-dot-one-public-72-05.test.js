// 色圈全 App 只有一颗（她 2026-09-20：「其他地方的这种颜色硬编码也收到公共的
// 全都改成色圈，这样以后不会改一处坏一处」）
//
// 原来六处各画各的取色器：庭院染色、角色底色、主题那八支色、「这一页单独换几支色」、
// 装饰的底与强调色、气泡皮肤那一排手打色号。现在都走 components.js 的 ColorDot。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const JS = fs.readdirSync(path.join(root, "js")).filter(f => f.endsWith(".js"));

test("原生取色器全库只许出现在 ColorDot 里", () => {
  const hits = [];
  JS.forEach(f => {
    read("js/" + f).split("\n").forEach((line, i) => {
      if (/type: *"color"/.test(line) && !/^\s*\/\//.test(line)) hits.push(f + ":" + (i + 1));
    });
  });
  assert.deepEqual(hits.length, 1, "又有人自己开了一个取色器：" + hits.join(" / "));
  assert.match(hits[0], /^components\.js:/);
});

test("那六处都在用同一颗色圈", () => {
  const sites = [
    ["js/components.js", /h\(ColorDot, \{ value: gCol/, "装饰的底"],
    ["js/components.js", /h\(ColorDot, \{ value: accent/, "装饰的强调色"],
    ["js/components.js", /h\(ColorDot, \{ value: s\[key\]/, "气泡皮肤那几栏"],
    ["js/screens.js", /h\(ColorDot, \{ value: color, onChange: setColor/, "角色底色"],
    ["js/screens.js", /h\(ColorDot, \{\n?\s*value: th\[k\]/, "主题那八支色"],
    ["js/theme-studio-ui.js", /h\(ColorDot, \{ value: val/, "这一页单独换几支色"],
    ["js/fairy-garden.js", /h\(ColorDot, \{ value: hex/, "庭院染色"]
  ];
  sites.forEach(([f, re, name]) => assert.match(read(f), re, name + "没接上公共色圈"));
});

// 这三条原来分散在各处（情侣卡那份钉过彩虹圈和「取色器盖满色块」，主屏装饰那份钉过
// aria 名字）。搬进公共色圈之后它们只在这儿钉一次。
test("色圈就是取色器本身：盖满那块色，不在旁边另开一个小按钮", () => {
  const comp = read("js/components.js");
  const i = comp.indexOf("function ColorDot(");
  const j = comp.indexOf("function BubbleSkinPresets(", i);
  assert.ok(i > 0 && j > i, "抠不出 ColorDot");
  const dot = comp.slice(i, j);
  assert.match(dot, /position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0/);
  assert.match(dot, /conic-gradient/, "用着自定义色时没有那圈彩虹，看不出「现在不是预设」");
  assert.match(dot, /"aria-label": "自定义" \+ \(label \|\| "颜色"\)/);
});

test("色圈只有一份实现", () => {
  const all = JS.map(f => read("js/" + f)).join("\n");
  assert.equal((all.match(/function ColorDot\(/g) || []).length, 1);
  assert.equal((all.match(/function colorDotHex\(/g) || []).length, 1);
});

// 值不是六位色号时（渐变、留空、"跟随全局"）喂给原生取色器的那一份要兜得住，
// 抠色号只许用 skinFirstHex 那一份（施工规则/one-public-mechanism.md）。
test("colorDotHex：渐变抠第一个色号，废值退回兜底色", () => {
  const comp = read("js/components.js");
  const i = comp.indexOf("const COLOR_DOT_FALLBACK = ");
  const j = comp.indexOf("const colorDotItem = ", i);
  assert.ok(i > 0 && j > i, "抠不出 colorDotHex 那一段");
  const k = comp.indexOf("function skinFirstHex(");
  const m = comp.indexOf("function skinLum(", k);
  assert.ok(k > 0 && m > k, "抠不出 skinFirstHex");
  const f = new Function(comp.slice(i, j) + "\n" + comp.slice(k, m) + "\nreturn colorDotHex;")();
  assert.equal(f("#A8C8E8"), "#a8c8e8");
  assert.equal(f("linear-gradient(180deg, #CDE2F8 0%, #E4EFFB 100%)"), "#cde2f8");
  assert.equal(f("#abc"), "#aabbcc");
  assert.equal(f("", "#123456"), "#123456");
  assert.equal(f("跟随全局"), "#f3ece0");
  assert.equal(f(null), "#f3ece0");
});
