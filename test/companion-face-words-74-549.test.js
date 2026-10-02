// 她 2026-10-02：「抓耳挠腮」认成了平常——表情词典再加一批
const test = require("node:test");
const assert = require("node:assert");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js/companion.js"), "utf8");
const R = new Function("return " + src.slice(src.indexOf("const FACE_RULES = ") + 19, src.indexOf("const FACE_ZH")).trim().replace(/;$/, ""))();
const face = l => { for (const [k, r] of R) if (r.test(l)) return k; return "default"; };
test("新词认得出", () => {
  assert.equal(face("抓耳挠腮"), "surprise");
  assert.equal(face("手足无措"), "surprise");
  assert.equal(face("吃味"), "irritated");
  assert.equal(face("心花怒放"), "amazed");
  assert.equal(face("眉开眼笑"), "happy");
  assert.equal(face("心软"), "cozy");
  assert.equal(face("出神"), "relax");
  assert.equal(face("七上八下"), "gloomy");
  assert.equal(face("不开心"), "gloomy");
});
