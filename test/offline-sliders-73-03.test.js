// 她 2026-09-22：「两边线下的 token 上限和最低字数的拉条都放开点吧。
// 上限也不是硬性规定，给他们多点输出的机会」。
//
// 拉条原来卡在 24000／32000，最低字数卡在 3000／4000 —— 而 max_tokens 是
// 【天花板】不是花销：按次计费，给宽了一分钱也多花不到，给窄了才会写一半停住
// （施工规则/max-tokens-floor）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const sp = fs.readFileSync(__dirname + "/../js/style-presets.js", "utf8");

test("两边线下的输出上限都拉到 OUT_CEILING", () => {
  assert.match(sp, /const OUT_CEILING = 65535;/, "天花板那个数变了，下面两条要跟着改");
  assert.equal((comp.match(/h\(Slider, \{ value: sMax, min: 1000, max: 65535, step: 1000/g) || []).length, 2,
    "单人线下和群线下，有一边没放开");
  assert.doesNotMatch(comp, /value: sMax, min: 400, max: 24000/, "单人线下还卡在 24000");
  assert.doesNotMatch(comp, /value: sMax, min: 800, max: 32000/, "群线下还卡在 32000");
});

test("两边的最低字数都拉到 8000", () => {
  assert.equal((comp.match(/h\(Slider, \{ value: sMinW, min: 0, max: 8000, step: 100/g) || []).length, 2,
    "单人线下和群线下，有一边没放开");
  // 下限 8000 字换算出来的预算仍在天花板之内（tokensFor：字数×3＋8000）
  const tokensFor = new Function("OUT_CEILING", "return " + /const tokensFor = (.+);/.exec(sp)[1] + ";")(65535);
  assert.equal(tokensFor(8000), 32000);
  assert.ok(tokensFor(8000) <= 65535);
});

test("界面上说清楚：上限是天花板，不是硬性要求", () => {
  assert.match(comp, /这是天花板不是硬性要求：给宽了不会逼着把简单场景写长/, "群线下没说");
  assert.match(comp, /给宽点只是让它有空间写完，不是硬性要求/, "单人线下没说");
});
