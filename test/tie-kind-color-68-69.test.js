// 她 2026-09-15 发来的参考图里：恋人是红的、商业朋友是紫的——一眼就看得出这张网里
// 哪几段是感情线、哪几段是正事。我们原来所有线都是同一个墨色，那张网只剩「谁连着谁」。
//
// ⚠️这一层的risk不在「没上色」，在【上错色】：把「前任」画成恋人那种错，
//   比不上色难看得多。所以判据是【认得出才上，认不出老实用默认色】，不猜、不调模型。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const screens = fs.readFileSync("js/screens.js", "utf8");
const grab = re => { const m = screens.match(re); assert.ok(m, "找不到：" + re); return m[0]; };
const color = new Function(grab(/const TIE_KINDS = \[[\s\S]*?\n\}\n/) + ";return tieKindColor;")();

test("认得出的几类各上各的色", () => {
  const lover = color("恋人", "INK"), kin = color("母亲", "INK"),
        work = color("同事", "INK"), foe = color("对头", "INK"), pal = color("发小", "INK");
  const all = [lover, kin, work, foe, pal];
  all.forEach(c => assert.notEqual(c, "INK"));
  assert.equal(new Set(all).size, 5, "五类里有两类撞色了，那等于少了一类");
});

test("⚠️「前任」不许被画成恋人", () => {
  // 「前男友」里带着「男友」、「前女友」里带着「女友」——只按 lover 先匹配就会全错
  assert.equal(color("前男友", "INK"), color("对头", "INK"));
  assert.equal(color("前女友", "INK"), color("对头", "INK"));
  assert.equal(color("前任", "INK"), color("对头", "INK"));
  assert.notEqual(color("前男友", "INK"), color("恋人", "INK"), "把前任画成恋人，比不上色难看得多");
  assert.match(screens, /const TIE_KIND_ORDER = \["foe", "lover"/, "foe 不排在 lover 前面，「前男友」就会被认成恋人");
});

test("认不出就老实用默认色，不猜", () => {
  for (const x of ["", null, undefined, "   ", "我的副将", "说不清", "邻座"]) {
    if (x === "邻座") continue;
    assert.equal(color(x, "INK"), "INK", JSON.stringify(x) + " 被硬认成了某一类");
  }
});

test("线和牌子是同一个颜色——只改一头就像两套东西", () => {
  assert.match(screens, /const col = tieKindColor\(L\.label, t\.ink\);/);
  assert.match(screens, /stroke: col,/);
  assert.match(screens, /background: tieKindColor\(L\.label, t\.ink\),/, "牌子还是墨色，线却染了色");
  // 上了色的那几段稍微粗一点、实一点，才看得出它跟没认出来的那几段不是一档
  assert.match(screens, /strokeWidth: tinted \? 1\.5 : 1\.1/);
});
