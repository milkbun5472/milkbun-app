// 她 2026-09-03：「小游戏的界面还是有点普通无聊」。
//
// 原来这一屏是一列一模一样的圆角卡：emoji + 名字 + 一句说明。
// 判据（.claude/rules/tabs-not-plain-pills.md）：原样搬到另一个 app 里还成立吗？
// 成立——那就是一张设置页的功能列表。而 emoji 是最省事也最不说明问题的图。
// 先问「这个 app 在现实里是什么」：一架桌游盒。每一盒的封面画的就是那副游戏本身。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");

const shelf = (() => {
  const a = src.indexOf("  // ============================================================\n  // 游戏盒面");
  const b = src.indexOf("  // ============================================================\n  // 开局配置");
  assert.ok(a > 0 && b > a, "抠不出游戏架那一段");
  return src.slice(a, b);
})();
const gameKeys = [...src.matchAll(/\{ key: "([a-z0-9]+)", emoji:/g)].map(m => m[1]);

test("每一盒都有自己的封面，而且是画出来的", () => {
  assert.ok(gameKeys.length >= 8, "GAMES 里的游戏找不全了");
  const lid = src.slice(src.indexOf("  const LID = {"), src.indexOf("  function GameLid("));
  // ⚠️新加一个游戏却忘了画封面，架子上就会冒出一个跟别人不一样的盒子——
  //   这条就是拦这个的。
  gameKeys.forEach(k => assert.ok(new RegExp("^\\s*" + k + ":", "m").test(lid), "「" + k + "」没有盒面"));
  // 真的是画的：每一盒都得有若干个 svg 图元
  const art = shelf.slice(shelf.indexOf("const art = {"), shelf.indexOf("return h(\"svg\""));
  // ⚠️别去数源码里的图元：25 问和 UNO 是用循环画的，源码里只有两三行，
  //   实际画出来是二十五个格子、四张牌。数源码会把它们冤枉成「潦草」。
  //   也别只在 h 被调用时记一笔：art 那个对象是【一次性全建出来】的，
  //   随便画哪一盒都会把八盒的图元全记一遍，八个盒子一律 96 个，这条就废了。
  //   正确的数法：接住 GameLid 返回的那棵树，从 svg 根往下走。
  const draw = k => {
    const hh = (tag, at, kids) => ({ __t: tag, __k: (Array.isArray(kids) ? kids : [kids]).flat(9).filter(x => x && x.__t) });
    const F = new Function("h", shelf.slice(shelf.indexOf("  const LID = {"), shelf.indexOf("\n  function Games(")) + "\nreturn GameLid;")(hh);
    const walk = n => [n.__t].concat((n.__k || []).reduce((acc, x) => acc.concat(walk(x)), []));
    return walk(F({ k: k })).slice(1);   // 去掉 svg 自己
  };
  gameKeys.forEach(k => {
    const els = draw(k);
    assert.ok(els.length >= 4, "「" + k + "」那一盒只画了 " + els.length + " 个东西，太潦草");
    assert.ok(new Set(els).size >= 2, "「" + k + "」整盒只有一种图元，看不出画的是什么");
  });
  assert.match(shelf, /viewBox: "0 0 120 84"/);
});

test("架上不再摆 emoji——那是最省事也最不说明问题的图", () => {
  // GAMES 里的 emoji 字段留着（别处存档条之类还认它），但这一屏不许再拿它当封面
  assert.doesNotMatch(shelf, /g\.emoji/, "架子上还在摆 emoji");
  assert.doesNotMatch(shelf, /def\.emoji/, "还摊在桌上那几条还在摆 emoji");
  assert.match(shelf, /h\(GameLid, \{ k: g\.key \}\)/, "盒面没接上");
  assert.match(shelf, /h\(GameLid, \{ k: r\.k \}\)/, "还摊在桌上那几条没用盒面");
});

test("它是一个盒子，坐在架子上——不是一张卡", () => {
  // 盒子有厚度（底下那道深边），一排两个，每排底下压一条木架线
  assert.match(shelf, /boxShadow: "0 3px 0 " \+ c\.band/, "盒子没有厚度，那就还是一张卡");
  assert.match(shelf, /for \(let i = 0; i < GAMES\.length; i \+= 2\) rows\.push\(GAMES\.slice\(i, i \+ 2\)\);/, "不是一排两个");
  assert.match(shelf, /木架线/);
  assert.match(shelf, /background: t\.line/, "架子线没跟着主题走");
  // 名字压在盒面下缘那条带上，跟真的桌游盒一样
  assert.match(shelf, /background: c\.band, padding: "6px 8px 7px"/);
});

test("两个深色盒的名字带要单列，不然整架就它俩反过来", () => {
  const lid = src.slice(src.indexOf("  const LID = {"), src.indexOf("  function GameLid("));
  // 拿 ink 当带子色的话：狼人杀 ink 是浅灰，深盒底下会挂一条浅带
  ["werewolf", "uno"].forEach(k => {
    const row = new RegExp(k + ':\\s*\\{[^}]*band: "(#[0-9a-f]{6})"[^}]*\\}', "i").exec(lid);
    assert.ok(row, k + " 没有单列 band");
    const band = row[1].toLowerCase();
    const ink = new RegExp(k + ':\\s*\\{[^}]*ink: "(#[0-9a-f]{6})"', "i").exec(lid)[1].toLowerCase();
    assert.notEqual(band, ink, k + " 的带子还在拿 ink 当色，深盒底下会挂一条浅带");
    // 深盒的带子得比盒面还深
    const lum = c => parseInt(c.slice(1, 3), 16) + parseInt(c.slice(3, 5), 16) + parseInt(c.slice(5, 7), 16);
    assert.ok(lum(band) < 200, k + " 的带子不够深（" + band + "）");
  });
  // 每一盒五个色都得齐，缺一个就会渲染出 undefined
  gameKeys.forEach(k => {
    const row = new RegExp(k + ":\\s*\\{([^}]*)\\}", "i").exec(lid);
    assert.ok(row, k + " 没有配色");
    ["paper", "ink", "hot", "band", "bandInk"].forEach(f =>
      assert.ok(row[1].indexOf(f + ":") >= 0, k + " 缺 " + f));
  });
});

test("封面的颜色是故意写死的，而且写清了为什么", () => {
  // 它是一张画，不是界面：八个盒子各有各的色，摆在一起才像一架收藏。
  assert.match(shelf, /盒面的颜色是【故意写死】的：它是一张画，不是界面/);
  // 而界面那部分照旧跟主题走
  assert.match(shelf, /color: t\.fog/);
  assert.match(shelf, /color: t\.ink/);
});

test("没打完的那几局是「还摊在桌上」，不是一条通用横幅", () => {
  assert.match(shelf, /还摊在桌上/);
  assert.match(shelf, /transform: "rotate\(-7deg\)"/, "盒盖没掀开");
  assert.match(shelf, /"接着玩"/);
  assert.match(shelf, /"收了"/);
  // 狼人杀和别的游戏走同一条渲染，不再各写一遍
  assert.equal((shelf.match(/"还摊在桌上"/g) || []).length, 1, "两种存档条又被抄成两份了");
  assert.match(shelf, /if \(wolfSave\) rows\.push\(/);
  assert.match(shelf, /Object\.keys\(gSaves\)\.forEach/);
});
