const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const src = (fs.readFileSync(__dirname + "/../js/fanfic.js", "utf8") + "\n" + fs.readFileSync(__dirname + "/../js/fanfic-core.js", "utf8"));
const gb = src.slice(src.indexOf("  async function genBatch("), src.indexOf("  // ── 记进房间"));
test("完结短篇那一段压在提示词最后，endHook 不再要悬念", () => {
  assert.match(gb, /FANFIC_ANTI_CLICHE_TAIL\) \+ oneShotBlock \+ briefTail;/);
  assert.doesNotMatch(gb, /briefBlock \+ oneShotBlock/);
  assert.match(gb, /one \? "这篇在哪儿收的尾/);
  assert.match(gb, /one \? "写 " \+ n \+ " 篇完结短篇/);
});
test("要几篇就补齐几篇，补的跟已写的不一样", () => {
  assert.match(gb, /kept\.length < n && !opts\._fill/);
  assert.match(gb, /fillAvoid/);
  assert.match(gb, /if \(x\._done\)/);
});
test("完结短篇落库带「完结」标签", () => {
  assert.match(src, /tags: oneShot \? \["完结"\]/);
});
test("完结短篇不掷开放式收法，先定结局再写", () => {
  assert.match(src, /function ficAxesBlock\(n, nonce, oneShot\)/);
  assert.match(src, /oneShot \? FIC_AXES\.filter\(function \(a\) \{ return a\.key !== "close"; \}\)/);
  assert.match(gb, /one \? "\\"ending\\":/);
  assert.match(gb, /停在一个正要发生的动作/);
});

test("点了梗：不截断、动笔前再念一遍、最后那句不再逼着换基调", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "fanfic-core.js"), "utf8");
  require("node:assert").ok(!/b\.slice\(0, 600\)/.test(src));
  require("node:assert").match(src, /【动笔前再看一眼】/);
  require("node:assert").match(src, /梗里说了的世界、时代、关系和基调压过板块的世界观/);
  require("node:assert").match(src, /allBriefed \? \(n > 1 \? "每篇照各自点的梗写，" : "照点的梗写，"\)/);
});
