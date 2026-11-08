const test = require("node:test"), assert = require("node:assert");
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const grab = n => { const i = src.indexOf("function " + n + "("); let d = 0, j = src.indexOf("{", i); for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}" && !--d) return src.slice(i, k + 1); } };
const vclockKeepHist = new Function(grab("vclockKeepHist") + "; return vclockKeepHist;")();
test("从没有过的钟头一回开（先歇着）也记一段「之前是现实」", () => {
  const now = 1762000000000;
  const out = vclockKeepHist({}, { m1: { on: true, base: now, at: now, speed: 0, rest: true } }, now);
  assert.deepStrictEqual(out.m1.hist, [{ until: now, real: true }]);
});
