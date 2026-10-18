const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = (fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "..", "js", "fanfic-core.js"), "utf8"));
// 群友 2026-10-17：同人文里续写，U 的外貌又丢了——「他俩 × 我」那种文续写时把「我」整个挤出去了
test("「他俩 × 我」记在文上，续写那几枪都带上「我」和我的外貌", () => {
  assert.match(src, /cp: cp \|\| \[\], withMe: !!includeMe && !noCP,/);
  assert.match(src, /if \(fic && fic\.withMe && o\.includeMe == null\)/);
  assert.match(src, /meAppearance: \(me && me\.appearance\) \|\| ""/);
  assert.match(src, /opts\.meAppearance && String\(opts\.meAppearance\)\.trim\(\) \? "\\n外貌（务必贴合/);
});
