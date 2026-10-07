const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const src = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("视频顶上那块只压渐变，不再毛玻璃", () => {
  const i = src.indexOf("const litPlate = (from, to) =>");
  const seg = src.slice(i, src.indexOf("} : null;", i));
  assert.doesNotMatch(seg, /backdropFilter/);
  assert.match(seg, /linear-gradient\(180deg/);
});
