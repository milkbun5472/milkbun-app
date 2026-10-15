// 片刻情侣号卡片（她 2026-10-15）：换个样子，让TA起名、写简介
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(__dirname + "/../js/shua.js", "utf8");
test("情侣号是卡片：两只头像、号名、简介；能切、能自己改、能让TA起", () => {
  assert.match(src, /const cpCard = id =>/);
  assert.match(src, /"data-wk": "shuacpbio"/);
  assert.match(src, /"让 TA 重新起" : "让 TA 起名开号"/);
  assert.match(src, /props\.probeAs\(c, "【这一轮发生在「" \+ APP_NAME[\s\S]{0,600}'\{"handle":"","bio":""\}'\)/);
});
test("cpEdit 这个 hook 在所有提前 return 之前", () => {
  const i = src.indexOf('const [cpEdit, setCpEdit] = useState("")'), j = src.indexOf('if (page && page.kind === "comments")');
  assert.ok(i > 0 && i < j);
});
test("TA 往情侣号发视频时知道简介", () => {
  assert.match(src, /\(a\.bio \? "（主页简介：" \+ a\.bio \+ "）" : ""\)/);   // 2026-10-15 并进 cpPostLine
});
