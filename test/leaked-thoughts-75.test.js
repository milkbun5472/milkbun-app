// 正文前面漏出来的英文思考切掉（群友新站子 2026-10-16）
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js/engine.js"), "utf8");
const a = src.indexOf("const LEAK_HEAD_RE"), b = src.indexOf("function assertNotUpstreamError");
const strip = new Function(src.slice(a, b) + "\nreturn stripLeakedThoughts;")();
test("开头英文自述 + 后面 JSON／中文：切掉前面；认不准就不动", () => {
  const leak = "**Refining the Draft**\n\nI'm now iterating on the final response. I'm focusing on blending acknowledgment.\n\n";
  assert.equal(strip(leak + '{"reply":["嗯"]}'), '{"reply":["嗯"]}');
  assert.equal(strip(leak + "你又熬夜追剧了？"), "你又熬夜追剧了？");
  assert.equal(strip(leak), leak);                       // 后面没有正文：不动
  assert.equal(strip('{"reply":["I\'m fine"]}'), '{"reply":["I\'m fine"]}');
  assert.equal(strip("I'm home 我回来了"), "I'm home 我回来了");  // 太短、像正经台词：不动
  assert.equal(strip("Okay but listen.\nThat was fun."), "Okay but listen.\nThat was fun.");
});
