const test = require("node:test"); const assert = require("node:assert");
const src = require("fs").readFileSync(__dirname + "/../js/screens.js", "utf8");
test("Fish 模型能自己填，不是写死的下拉", () => {
  assert.match(src, /set\(\{ fishModel: e\.target\.value\.trim\(\) \}\), placeholder: "s1", list: "fish-models"/);
  assert.doesNotMatch(src, /"s1（推荐）"/);
});
