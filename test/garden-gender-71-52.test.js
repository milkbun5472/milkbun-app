"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const host = fs.readFileSync("js/fairy-garden.js", "utf8");
const comp = fs.readFileSync("js/components.js", "utf8");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");

// 她 2026-09-19：「为啥男的进去是默认女体我是男体」
test("两边都按性别配默认样貌，不再只管同行者", () => {
  assert.match(host, /g\.ensureLook\('companion', taOf\(c\),/, "同行者那一侧没接上");
  assert.match(host, /g\.ensureLook\('me',/, "她自己那一侧没接上");
  assert.doesNotMatch(host, /hair: ta === "她" \? 'wavy'/,
    "写死的那份发型还在——发型又在替身形说话了");
});

// ⚠️原来只在进门那一瞬间试一次：那会儿角色还没就位就永远错过。
test("角色或人设后来才就位时还要再补一次", () => {
  assert.match(host, /if \(loaded\) ensureLooks\(\);/, "只剩进门那一次了");
  assert.match(host, /\[loaded, entry\.partnerId\]\);/, "换了同行者之后不再补");
});

// 她 2026-09-19：「不要设置性别！！！男的不许玩！！！」
// ——她自己那一侧永远是女生，写死，不做成设置项也不读任何人设字段。
test("她自己永远是女生，而且不做成设置", () => {
  assert.match(host, /g\.ensureLook\('me', "她"\)/, "她自己那一侧不再写死成女生了");
  assert.doesNotMatch(host, /profile[^\n]*gender|me\.gender/, "又去读人设里的性别了");
  assert.doesNotMatch(comp, /gender/, "「我的面具」里又冒出性别这一项了");
});

// 施工规则/one-public-mechanism.md：换样貌只许有一处落点。
test("按性别补默认和手动换装走同一段", () => {
  assert.match(game, /const applyLook=\(who,look\)=>/, "没有公共的那一处");
  assert.match(game, /setLook:\(who,look\)=>applyLook\(who,look\)/, "手动换装另走一条路了");
  assert.match(game, /return applyLook\(who,\{\.\.\.lookForTa\(ta\)/, "按性别那条另走一条路了");
  assert.match(game, /if\(cur&&cur\.hair\)return false;/, "她挑过的样貌会被默认盖掉");
});
