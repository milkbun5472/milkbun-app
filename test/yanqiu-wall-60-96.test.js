// v60.96 秋声精装（她 2026-09-02 夜：「把你的秋声精装一下好看点」）
// 这面墙是一面钉字条的墙：图钉、歪纸、心情戳、压叶点赞、纸边批注。
// 钉住的是【铁律】：整页不半窗、紧凑顶栏、正文唯一滚动容器、颜色走主题 token、点得着。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "yanqiu.js"), "utf8");

test("整页骨架：h-full flex-col，顶栏 shrink-0，正文 flex-1 min-h-0 overflow-y-auto，不用 Sheet", () => {
  assert.match(src, /className: "h-full flex flex-col"/);
  assert.match(src, /className: "shrink-0 flex items-center px-4 pb-2", style: \{ paddingTop: safeTop\(10\)/);
  assert.match(src, /className: "flex-1 min-h-0 overflow-y-auto"/);
  assert.doesNotMatch(src, /h\(Sheet/);
});

test("颜色全走主题：useTheme，不写死背景白/黑；深色主题下按钮字色用 t.bg2", () => {
  assert.match(src, /const t = useTheme\(\);/);
  assert.doesNotMatch(src, /"#fff"|"#ffffff"|"#000"|"#000000"/i);
  assert.doesNotMatch(src, /bg: "#ece8e1"/, "旧的写死配色不许留");
  assert.match(src, /color: t\.bg2, background: tint/);
});

test("墙的零件都在：图钉、歪纸、心情戳、压叶点赞（热区 ≥40）、纸边批注", () => {
  assert.match(src, /function Pin\(/);
  assert.match(src, /const TILTS = \[/);
  assert.match(src, /transform: "rotate\(-7deg\)"/, "心情戳");
  assert.match(src, /minHeight: 40/, "点赞热区");
  assert.match(src, /window\.GYanqiuLeaf, \{ size: 22, color: liked \? tint : t\.fog, fill: liked \? tint : "none" \}/);
  assert.match(src, /borderLeft: "2px solid " \+ tint/, "批注的墨线");
});

test("选中态不只靠颜色：叶子压上去还会转一个角度", () => {
  assert.match(src, /transform: liked \? "rotate\(18deg\) translateY\(1px\)" : "rotate\(0deg\)"/);
});
