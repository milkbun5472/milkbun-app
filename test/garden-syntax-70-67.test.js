"use strict";
// 合并之后 game.mjs 里出现过一对重复的 import，六千多条测试全绿（它们只 grep 源码）——
// 真跑起来才炸。这一条把每个 ESM 都真的解析一遍，别再靠浏览器烟雾才发现。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
test("庭院的每个模块都能被 node --check 解析（合并撞出来的重复 import 当场红）", () => {
  const dir = "apps/fairy-garden";
  for (const f of fs.readdirSync(dir).filter(x => /\.(mjs|js)$/.test(x) && !x.endsWith(".test.mjs"))) {
    try { execFileSync(process.execPath, ["--check", dir + "/" + f], { stdio: "pipe" }); }
    catch (e) { assert.fail(f + " 解析不过：" + String(e.stderr || e.message).split("\n").slice(0, 3).join(" ")); }
  }
  execFileSync(process.execPath, ["--check", "js/fairy-garden.js"], { stdio: "pipe" });
});
