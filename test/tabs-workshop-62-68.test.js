// v62.68 药丸 tab 第二批（审美审计 2026-09-04 数出五处，v62.66 改了两处）：
// 文风台、主题工坊、地图。判据还是那一句：
// **这一组 tab 原样搬到另一个 app 里还成立吗？成立就是写坏了。**
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const nocom = x => x.split("\n").map(l => l.split("//")[0]).join("\n");
const SL = nocom(fs.readFileSync("js/style-lab.js", "utf8"));
const TS = nocom(fs.readFileSync("js/theme-studio-ui.js", "utf8"));
const MP = nocom(fs.readFileSync("js/map.js", "utf8"));

test("文风台：两栏是叠在打样台上的两张样张", () => {
  // 翻到哪一张，哪一张压在上面、纸色、往下探出一截，底边并进正文
  assert.match(SL, /borderRadius: "3px 3px 0 0"/);
  assert.match(SL, /zIndex: on \? 2 : 1/);
  assert.match(SL, /borderBottom: on \? "1px solid " \+ t\.bg2 : "1px solid " \+ t\.line/);
  assert.doesNotMatch(SL, /style: S\.chip\(tab === "build"\)/, "又用回通用药丸了");
  // 返回键补了 40px 可点区（原来是一个 19px 的「←」字符）
  assert.match(SL, /"aria-label": "返回"[\s\S]{0,200}width: 40, height: 40/);
});

test("主题工坊：三栏是三个抽屉的抽屉面", () => {
  assert.match(TS, /transform: on \? "translateY\(-3px\)" : "none"/, "拉开的那个没往外探");
  // 拉手：抽屉面正中那一道横杠，是抽屉最认得出的记号
  assert.match(TS, /width: 26, height: 3, borderRadius: 3, background: on \? t\.tint : t\.line/);
  assert.match(TS, /boxShadow: on \? "0 6px 12px -8px[\s\S]{0,60}inset 0 2px 5px -4px/, "没拉开的那几个要凹进去");
  assert.doesNotMatch(TS, /borderRadius: 16, textAlign: "left", background: section === id \? t\.ink/);
});

test("地图：类型选择是图例，而且记号是画出来的", () => {
  // ⌂ ▲ • ★ 这类符号在她机器上会渲成豆腐块（Unicode 当图标一律换 SVG）
  assert.doesNotMatch(MP, /KIND_GLYPH/, "那张符号表还在");
  assert.match(MP, /const KIND_PATH = \{/);
  assert.match(MP, /const kindMark = function \(kind, size, color, stroke\)/);
  // 三处共用同一份记号：图例、详情标题、图上的标注
  assert.ok((MP.match(/kindMark\(/g) || []).length >= 2, "记号没被共用，迟早三处长成三个样");
  assert.match(MP, /d: KIND_PATH\[nd\.kind\] \|\| KIND_PATH\.地标/, "图上的标注还在用符号字");
  // 图例条目：方角、只有一道边；圆角药丸是任何 app 的筛选器
  assert.match(MP, /borderRadius: 2,\s*\n?\s*fontFamily: F_BODY, fontSize: 12\.5, color: on2/);
});

test("三处的选中态都不只靠色差，可点区也不低于 40px", () => {
  assert.match(SL, /padding: on \? "11px 0 13px" : "9px 0 9px"/);
  assert.match(SL, /minHeight: 40/);
  assert.match(TS, /minHeight: 40/);
  assert.match(MP, /minHeight: 40/);
  // 主题工坊那三个抽屉：位置、底色、阴影、拉手颜色一起变
  assert.match(TS, /background: on \? t\.bg2 : "rgba\(127,127,127,\.07\)"/);
  assert.match(MP, /border: \(on2 \? "2px" : "1px"\) \+ " solid "/);
});
