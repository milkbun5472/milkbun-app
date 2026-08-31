const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const start = screens.indexOf("// —— 情侣空间 app 拼贴");
const end = screens.indexOf("只属于你俩的私密层", start);
const collage = screens.slice(start, end);

test("情侣空间 app 区使用稳定六列错落拼贴，不退回四列方格", () => {
  assert.ok(start >= 0 && end > start, "应能截取情侣空间拼贴源码");
  assert.match(collage, /OUR LITTLE ROOMS/);
  assert.match(collage, /gridTemplateColumns: "repeat\(6,minmax\(0,1fr\)\)"/);
  assert.doesNotMatch(collage, /repeat\(4,1fr\)/);
});

// ⚠️别把每一格的 cols/rows 逐个冻死：调一次尺寸这条就红，而它想验的
// 「骨相不一样」根本没坏。直接验那件事——宽窄高低真的分了好几档。
test("首屏、整行与收尾入口保持不同骨相", () => {
  const spans = [...collage.matchAll(/cols: (\d+), rows: ([\w.() ?:|+]+?),/g)].map(m => m[1] + "x" + m[2].trim());
  assert.ok(spans.length >= 8, "抓不到几格，切歪了：" + spans.length);
  assert.ok(new Set(spans).size >= 4, "所有格子一个尺寸，那就是排得太工整了：" + [...new Set(spans)].join(" "));
  assert.ok(spans.some(x => x.indexOf("6x") === 0), "没有一整行宽的那一档");
  assert.ok(spans.some(x => x.indexOf("2x") === 0), "没有窄的那一档");
  // v59.21：emoji 全撤，换成大号水印汉字——十六个彩色小图标是最杂的那一层
  assert.ok(!/\be: "[^"]+", zh:/.test(collage), "又往格子上挂 emoji 了");
  assert.match(collage, /mark: "日"/, "水印字没了");
  // 底色统一成一张纸，颜色只留给真正该重的那两三块
  assert.match(collage, /const PAPER = "#fffdfa"/, "又回到一格一个糖果色了");
});

test("情侣空间原有 app 门没有在重排中丢失", () => {
  const keys = ["timeline", "album", "letters", "notes", "recall", "pacts", "makeup", "ifroom", "studio", "firsts", "drawer", "gacha", "qa", "capsule", "exdiary"];
  for (const key of keys) {
    assert.match(collage, new RegExp(`(?:tile\\(\\"${key}\\"|key: \\"${key}\\")`), `${key} 入口应保留`);
  }
});
