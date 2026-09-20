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
  assert.ok(/const rolled = window\.Axes \? window\.Axes\.roll\(GARDEN_AXIS, \[char\.id, "garden", past\.length, Date\.now\(\)\]\)/.test(seg),
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

// ⚠️她 2026-09-20 当场纠正（v72.13）：「有时候确实一种有纪念意义的花他就是会多选几次啊，
//   轴可以留着，我只是不想每次说的话都是一个意思换几个字」。
//   上一版我把【花名】当成了 avoid 单子——那等于顺手禁掉了「纪念」这件事。
//   要避的是那句话：同一种花随便种几次，但那句 why 不许是上一句的换字版。
test("避的是那句话，不是那种花", () => {
  assert.ok(/同一种花你完全可以再选一次/.test(seg), "又把同一种花禁掉了——她明确说过纪念性的花就是会重复选");
  assert.ok(!/这次换一种别的/.test(seg), "旧的「换一种别的」还在");
  assert.ok(/那句 why 不许是上面某一句的换字版/.test(seg), "没拦住换字版——她报的就是这一条");
  assert.ok(/说一件上面没说过的/.test(seg), "只说了不许，没给出口（要是又选同一种，他该说什么）");
  // 单子上必须带着【当时那句话】，不然模型无从知道自己上次说了什么
  assert.ok(/你们以前种过这些，以及你当时说的话/.test(seg), "avoid 单子只报了花名，没报当时那句话");
});

test("以前那几盆连话一起长期记着", () => {
  assert.ok(/gardenPastText\(past\)/.test(seg), "没把以前那几盆喂进去");
  const i = app.indexOf("  const gardenPastOf = g => {");
  assert.ok(i > 0, "抠不出 gardenPastOf");
  const fn = new Function("return (" + app.slice(i + "  const gardenPastOf = ".length, app.indexOf("\n  };", i) + 4) + ")")();
  // 老存档没有 said 这一格：干花册本来就存着 species + why，从那儿补
  assert.deepEqual(fn({ kept: [{ species: "茉莉", why: "那天阳台上就剩它还活着" }], species: "茉莉", why: "又是它" }),
    [{ species: "茉莉", why: "那天阳台上就剩它还活着" }, { species: "茉莉", why: "又是它" }],
    "同一种花的两句不同的话得都留着——这正是她要的那种重复");
  assert.deepEqual(fn({ said: [{ species: "茉莉", why: "a" }], kept: [{ species: "茉莉", why: "a" }], species: "" }),
    [{ species: "茉莉", why: "a" }], "一模一样的一条该合成一个");
  assert.deepEqual(fn(null), [], "空存档该给空单子");
  const k = app.indexOf("  const gardenKeep = charId => {");
  assert.ok(/said: gardenPastOf\(g\)/.test(app.slice(k, app.indexOf("\n  };", k))), "收干花时把 avoid 单子丢了");
  assert.ok(/said: gardenPastOf\(old\)\.concat/.test(seg), "新种下的这一盆没记进 avoid 单子");
  assert.ok(/\.slice\(-24\)/.test(seg), "avoid 单子没封长度");
});
