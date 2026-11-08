const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

// 群里 2026-11-08：「有时候莫名其妙就取关，也没闹别扭」
test("取关只认冲着人的心情，半天内报的，连着两个钟头才掷一次", () => {
  const re = eval(app.match(/const FORUM_SULK_RE = (\/[^\n]*\/);/)[1]);
  ["生气", "有点委屈", "吃醋", "赌气"].forEach(x => assert.ok(re.test(x), x));
  ["低落", "孤独", "烦躁", "疲惫", "难过"].forEach(x => assert.ok(!re.test(x), x));
  assert.match(app, /Date\.now\(\) - \(Number\(_md\.ts\) \|\| 0\) <= 12 \* 3600000/);
  assert.match(app, /now - b\.sulkSince >= 2 \* 3600000/);
  assert.match(app, /const off = Math\.random\(\) < 0\.5;/);
});
