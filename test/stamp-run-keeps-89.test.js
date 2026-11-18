// 群友 2026-11-18：远信打仗报「window.StampKeeps.forBattle is not a function」——全局信物栏 11-08 拆了，远信页还在调
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
test("远信只用这一趟的信物（battleFor 算好的 b.keeps），不再调已拆掉的全局方法", () => {
  const ui = R("js/stamp-run-ui.js"), duel = R("js/stamp-duel-ui.js");
  const used = [...ui.matchAll(/StampKeeps\.(\w+)\(/g)].map(m => m[1]);
  const keepsSrc = duel.slice(duel.indexOf("const Keeps = {"), duel.indexOf("window.StampKeeps = Keeps;"));
  used.forEach(fn => assert.match(keepsSrc, new RegExp("\\b" + fn + ":"), "远信调了 StampKeeps." + fn + "，可它不存在"));
  assert.match(R("js/stamp-run.js"), /const base = \{ keeps,/);
});
