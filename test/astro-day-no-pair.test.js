const test = require("node:test");
const assert = require("node:assert");
const a = require("fs").readFileSync(__dirname + "/../js/astro.js", "utf8");
test("今日运势让 TA 看看时不带配对", () => {
  const i = a.indexOf('const key = "day|"'), seg = a.slice(i, i + 1200);
  assert.ok(!/配对指数|m\.aspect|m\.score/.test(seg));
});
test("再看看 is a reroll that shows the previous take as something to avoid", () => {
  assert.match(a, /const prev = notes\[key\] && notes\[key\]\.text;[\s\S]{0,300}别把同一番话换个说法再说/);
});
