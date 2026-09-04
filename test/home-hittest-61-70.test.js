// v61.70 拖拽落点=矩形包含扫描（elementFromPoint 会被悬浮播放条/浮影挡住）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("不再用 elementFromPoint 找落点；用全量 data-appkey 矩形包含、取面积最小者", () => {
  const seg = src.slice(src.indexOf("v61.70 落点改用矩形包含扫描"), src.indexOf("const dragged = dragKeyRef.current;"));
  assert.ok(seg.length > 100);
  assert.match(seg, /querySelectorAll\("\[data-appkey\]"\)/);
  assert.match(seg, /area < bestArea/);
  assert.doesNotMatch(seg, /document\.elementFromPoint\(/);
});
