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

test("首屏、整行与收尾入口保持不同骨相", () => {
  assert.match(collage, /tile\("timeline", \{ cols: 4, rows: 3/);
  assert.match(collage, /key: "album"[\s\S]*?gridColumn: "span 2", gridRow: "span 3"/);
  assert.match(collage, /tile\("ifroom", \{ cols: 6, rows: 2/);
  assert.match(collage, /tile\("studio", \{ e: "📷", zh: "照相馆", cols: 2, rows: 3/);
  assert.match(collage, /tile\("firsts", \{ e: "🏷", zh: "第一次们", cols: 4, rows: 3/);
  assert.match(collage, /tile\("capsule", \{ cols: 3, rows: 2/);
  assert.match(collage, /tile\("exdiary", \{ cols: 3, rows: 2/);
});

test("情侣空间原有 app 门没有在重排中丢失", () => {
  const keys = ["timeline", "album", "letters", "notes", "recall", "pacts", "makeup", "ifroom", "studio", "firsts", "drawer", "gacha", "qa", "capsule", "exdiary"];
  for (const key of keys) {
    assert.match(collage, new RegExp(`(?:tile\\(\\"${key}\\"|key: \\"${key}\\")`), `${key} 入口应保留`);
  }
});
