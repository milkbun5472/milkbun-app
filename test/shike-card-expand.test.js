const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "shike.js"), "utf8");
// 她 2026-10-06：「这个时刻卡看不完啊而且还是很普通」
test("聊天里的时刻卡点一下能展开看全，不再写死两行", () => {
  const i = src.indexOf("function ShikeShareCard("), j = src.indexOf("g.ShikeShareCard = ShikeShareCard;", i);
  assert.ok(i > 0 && j > i, "抠不出 ShikeShareCard");
  const seg = src.slice(i, j);
  assert.match(seg, /const \[open, setOpen\] = useState\(false\);/);
  assert.match(seg, /onClick: \(\) => long && setOpen\(v => !v\)/);
  assert.match(seg, /open \|\| !long \? \{\} : \{ maxHeight: 80, overflow: "hidden" \}/);   // 收着时露三行横格（v75.309 换成纪念签后按行高收）
  assert.doesNotMatch(seg, /\.slice\(0, 2\)/, "又只摆两句了");
  assert.match(seg, /"data-wk": "shikeshare"/);
});
