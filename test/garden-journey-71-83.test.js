"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const host = fs.readFileSync("js/fairy-garden.js", "utf8");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");

// ⚠️v71.57 把模型压成 Draco 时写了 new DRACOLoader()，却【从没 import 过它】：
//   整个小世界从那一版起就卡在「正在准备小屋和林地…」，报错只在控制台里，
//   页面上一个字都不说，所以没人发现。这条扫的是【这一类】，不只是这一次。
test("从 vendor 里 new 出来的东西，必须真的 import 过", () => {
  const used = new Set((game.match(/new ([A-Z][A-Za-z0-9]*)\(/g) || [])
    .map(x => x.slice(4, -1)).filter(n => /Loader$/.test(n)));
  assert.ok(used.size, "一个 Loader 都没 new，这条就成了空转");
  for (const name of used)
    assert.match(game, new RegExp("import \\{[^}]*\\b" + name + "\\b[^}]*\\} from"),
      name + " 被 new 出来了却没 import——页面会卡在加载里，只有控制台报错");
});

// 她 2026-09-19：「每个庭院档连一个列车档连一个别的什么档」
test("一条记录装得下好几个世界，而且老档照样打得开", () => {
  assert.match(host, /const worldOf = \(rec, id\) => \{/, "没有那一处公共的取法");
  const fn = host.slice(host.indexOf("const worldOf = (rec, id) => {"), host.indexOf("const saveKeyOf = row =>"));
  assert.match(fn, /rec\.worlds\[w\]/, "不看新位置");
  assert.match(fn, /rec\.world/, "老档那一份读不出来了——她的日子会凭空没掉");
  assert.match(host, /worlds: \{ \.\.\.\(d\.worlds \|\| \{\}\), \[w\]: world \}/, "存的时候没往新位置写");
  assert.match(host, /world: w === "garden" \? world : d\.world/, "庭院那份不再写回老位置——回滚就丢进度");
});

test("跟着人走的那几样存在旅程层，世界档里那几份不算数", () => {
  assert.match(host, /journey: \{ \.\.\.\(d\.journey \|\| \{\}\)/, "旅程层没写进去");
  assert.match(game, /const WORLD='garden';/, "这一局不声明自己是哪个世界");
  assert.match(game, /host\.save\(saved,WORLD,takeJourney\(saved\)\)/, "存的时候没把旅程那一份挑出来");
  assert.match(game, /putJourney\(data,rec&&rec\.journey\)/, "读的时候没以旅程那一份为准");
});
