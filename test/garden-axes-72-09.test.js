// 她 2026-09-20：「情侣空间的花房怎么每次都是同一种花说的话也差不多」。
//
// 病根是这一枪【没有任何约束】：只说「挑一种你会想跟 Ta 一起养的花」，
// 模型就塌回先验中心——茉莉、向日葵、薄荷，连那句 why 都长得一样。
// 照 施工规则/bans-make-it-dumber 的后半条来：掷约束、不掷答案（写死一张花名表
// 是相反的做法，那样天花板永远是我们当天想得到的那几种）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const Axes = require("../js/axes.js");

const seg = (() => {
  const i = app.indexOf("  const GARDEN_AXIS = [");
  assert.ok(i > 0, "抠不出花房那几根轴");
  const j = app.indexOf("    finally { setGardenGen(null); }", i);
  assert.ok(j > i, "抠不出 gardenPlantGen");
  return app.slice(i, j);
})();

test("挑花这一枪掷的是轴，不是一张写死的花名表", () => {
  assert.ok(/const rolled = window\.Axes \? window\.Axes\.roll\(GARDEN_AXIS, \[char\.id, "garden", seen\.length, Date\.now\(\)\]\)/.test(seg),
    "没走公共那份掷轴，或者种子里少了 char.id／Date.now()——少一个就会每次掷出同一组");
  assert.ok(/window\.Axes\.text\(rolled,/.test(seg), "掷完没拼成话");
  assert.ok(/\(axisText \? "\\n" \+ axisText : ""\)/.test(seg), "掷出来的落点没喂进这一枪的 instruction——掷了也白掷");
  assert.ok(/是给你的落点，不是给你的答案/.test(seg), "没说清这是落点不是答案——模型会把轴当成要写进句子的词");
  // ⚠️地板是代码的、天花板是模型的：一张写死的花名表就是把天花板换成我们的
  assert.ok(!/茉莉|向日葵|薄荷|满天星/.test(seg), "代码里出现了具体花名——那是掷答案，不是掷约束");
});

test("三根轴互相独立，而且每根都留得住「你自己想一个」", () => {
  const i = app.indexOf("  const GARDEN_AXIS = [");
  const arr = new Function("return " + app.slice(i + "  const GARDEN_AXIS = ".length, app.indexOf("\n  ];", i) + 4))();
  assert.equal(arr.length, 3, "轴的根数变了——改之前先想清楚哪一根被谁顶替了");
  arr.forEach(ax => {
    assert.ok(ax.key && ax.zh, "有一根轴没名字");
    assert.ok(ax.opts.length >= 6, "「" + ax.zh + "」这根轴的格子太少，掷不出分布");
    assert.equal(ax.opts.length, new Set(ax.opts).size, "「" + ax.zh + "」这根轴上有重复的格子");
  });
  // 轴自己是不带 free 格的：那一格由 Axes.roll 按概率还回去（DEFAULT.free）
  assert.ok(Axes.DEFAULT.free > 0 && Axes.DEFAULT.allFree > 0, "公共那份把自由格调成 0 了——代码就成了关死门");
});

test("真掷起来不会永远是同一组", () => {
  const i = app.indexOf("  const GARDEN_AXIS = [");
  const arr = new Function("return " + app.slice(i + "  const GARDEN_AXIS = ".length, app.indexOf("\n  ];", i) + 4))();
  const out = new Set();
  for (let k = 0; k < 60; k++) out.add(Axes.line(Axes.roll(arr, ["c1", "garden", 0, 1700000000000 + k * 97531]).rows));
  assert.ok(out.size >= 30, "六十次只掷出 " + out.size + " 种组合——种子选得不对（同一个 charId 每次都该不一样）");
});

// ⚠️「把已经出现过的记下来当 avoid 单子，而且长期记」——这个机制要越用越好，不是越用越旧
test("挑过的花长期记着，下次不许再挑", () => {
  assert.ok(/这几种你们已经养过了，这次换一种别的/.test(seg), "没有 avoid 单子");
  assert.ok(/seen\.slice\(0, 30\)/.test(seg), "avoid 单子没封长度");
  const i = app.indexOf("  const gardenSeenOf = g => {");
  assert.ok(i > 0, "抠不出 gardenSeenOf");
  const src = app.slice(i + "  const gardenSeenOf = ".length, app.indexOf("\n  };", i) + 4);
  const fn = new Function("return (" + src + ")")();
  // 老存档没有 seen 这一格：得从干花册和盆里现有那盆补出来，不然这条改动对她是空的
  assert.deepEqual(fn({ kept: [{ species: "茉莉" }, { species: "薄荷" }], species: "风信子" }), ["茉莉", "薄荷", "风信子"]);
  assert.deepEqual(fn({ seen: ["茉莉"], kept: [{ species: "茉莉" }], species: "" }), ["茉莉"], "重复的名字该合成一个");
  assert.deepEqual(fn(null), [], "空存档该给空单子");
  // 收干花会把盆清空——seen 不许跟着一起没
  const k = app.indexOf("  const gardenKeep = charId => {");
  assert.ok(/seen: gardenSeenOf\(g\)/.test(app.slice(k, app.indexOf("\n  };", k))), "收干花时把 avoid 单子丢了");
  assert.ok(/seen: gardenSeenOf\(old\)\.concat\(\[sp\]\)/.test(seg), "新种下的这一种没记进 avoid 单子");
});
