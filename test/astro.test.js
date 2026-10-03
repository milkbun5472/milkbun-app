const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const src = read("js/astro.js"), eng = read("js/engine.js");

// 她 2026-10-03 画在「每日看」里的那一格：星座配对指数 / 星宿关系 / 每日运势 / 幸运色。
function load() {
  const cut = (a, b) => eng.slice(eng.indexOf(a), eng.indexOf(b));
  const helpers = [
    cut("function parseMonthDay(", "// 常见公历固定节日"),
    cut("const LUNAR_INFO = [", "// 距下一次生日还有几天")
  ].join("\n");
  const window = {};
  const React = { useState: () => [], useMemo: f => f() };
  new Function("window", "React", "h", "loadJSON", "saveJSON", helpers + "\n" + src)(window, React, () => null, () => ({}), () => true);
  return window.Astro;
}
const A = load();

test("星座：边界日子落对宫", () => {
  const nm = (m, d) => A.SIGNS[A.signOf(m, d)][0];
  assert.equal(nm(3, 21), "白羊"); assert.equal(nm(4, 19), "白羊"); assert.equal(nm(4, 20), "金牛");
  assert.equal(nm(12, 22), "摩羯"); assert.equal(nm(1, 19), "摩羯"); assert.equal(nm(1, 20), "水瓶");
  assert.equal(nm(2, 18), "水瓶"); assert.equal(nm(2, 19), "双鱼"); assert.equal(nm(3, 20), "双鱼");
  assert.equal(A.signOf(13, 1), -1);
});

test("配对：同元素最高、四分相最低，两头对称", () => {
  const ari = 0, leo = 4, cancer = 3, libra = 6, gem = 2;
  assert.equal(A.signMatch(ari, leo).score, 90);
  assert.equal(A.signMatch(ari, cancer).score, 60);
  assert.equal(A.signMatch(ari, libra).aspect, "对宫");
  assert.equal(A.signMatch(ari, gem).aspect, "元素相生");
  assert.deepEqual(A.signMatch(leo, ari), A.signMatch(ari, leo));
  assert.equal(A.signMatch(-1, 3), null);
});

test("宿曜：正月初一室宿、八月初一角宿，没有牛宿", () => {
  assert.equal(A.SHUKU.length, 27);
  assert.ok(A.SHUKU.indexOf("牛") < 0);
  assert.equal(A.SHUKU[A.shukuOf(1, 1)], "室");
  assert.equal(A.SHUKU[A.shukuOf(8, 1)], "角");
  assert.equal(A.SHUKU[A.shukuOf(1, 2)], "壁");
  assert.equal(A.SHUKU[A.shukuOf(12, 1)], "虚");
});

test("宿曜关系：命／业胎／荣亲……两边说法对得上", () => {
  const a = A.shukuOf(1, 1);
  assert.equal(A.shukuRelation(a, a).pair, "命");
  const r1 = A.shukuRelation(a, (a + 1) % 27);
  assert.equal(r1.pair, "荣亲"); assert.equal(r1.mine, "荣"); assert.equal(r1.theirs, "亲"); assert.equal(r1.distance, "近距离");
  const r9 = A.shukuRelation(a, (a + 9) % 27);
  assert.equal(r9.pair, "业胎"); assert.equal(r9.mine, "业"); assert.equal(r9.theirs, "胎");
  // 反过来看，pair 一样、mine/theirs 互换
  const back = A.shukuRelation((a + 1) % 27, a);
  assert.equal(back.pair, "荣亲"); assert.equal(back.mine, "亲");
});

test("生日：农历直接出宿；公历没年份就说算不了宿，不瞎编", () => {
  const lu = A.birthInfo("农历腊月廿三");
  assert.equal(A.SHUKU[lu.shuku], A.SHUKU[A.shukuOf(12, 23)]);
  assert.ok(lu.sign >= 0 && lu.signApprox, "没年份的农历生日按今年换星座，标约");
  const so = A.birthInfo("3-15");
  assert.equal(A.SIGNS[so.sign][0], "双鱼");
  assert.equal(so.shuku, -1); assert.equal(so.shukuNeedsYear, true);
  const full = A.birthInfo("2000-01-01");
  assert.equal(A.SIGNS[full.sign][0], "摩羯");
  assert.ok(full.shuku >= 0, "带年份的公历生日能换成农历出宿");
  assert.equal(A.birthInfo(""), null);
});

test("每日：同一天同一星座永远同一份，换天会变", () => {
  const a = A.daily(5, "2026-10-03"), b = A.daily(5, "2026-10-03"), c = A.daily(5, "2026-10-04");
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  for (const k of ["all", "love", "work", "money"]) assert.ok(a[k] >= 1 && a[k] <= 5);
  assert.match(a.color.hex, /^#[0-9a-f]{6}$/);
  assert.equal(A.daily(-1, "2026-10-03"), null);
});

test("挂上了：主屏、每日看、路由、页名、手册；点评走 runProbe voice", () => {
  const comp = read("js/components.js"), app = read("js/app.js"), core = read("js/core.js"), man = read("js/assistant-manual.js"), html = read("index.html");
  assert.match(comp, /astro: \{ kind: "app", zh: "星测", G: window\.GAstro \|\| GTarot \}/);
  assert.match(comp, /f_def_daily: \{ name: "每日看", keys: \["cwallet", "tarot", "shop", "takeout", "astro"\] \}/);
  assert.match(comp, /indexOf\("tarot"\) >= 0; \}\)\[0\];/, "老用户：放进有塔罗的那个文件夹");
  assert.match(comp, /if \(st && Object\.keys\(st\)\.length\) st = placeAstroOnce\(st\);/);
  assert.match(comp, /if \(loadJSON\("x_astroPlaced", false\)\) return st;/, "只搬一次：她挪走了别再塞回去");
  assert.match(app, /screen === "astro"\) body = h\(window\.AstroApp, \{/);
  assert.match(core, /astro: "星测"/);
  assert.match(man, /\{ id: "astro", app: "astro", zh: "星测"/);
  assert.match(html, /<script src="js\/astro\.js\?v=[\d.]+"><\/script>/);
  assert.match(src, /runProbe\(p, ctx, \{ voice: true, instruction: instruction \+ voiceTail\(\)/);
  assert.match(src, /maxTokens: 65535/);
  assert.match(src, /h\(Head, \{ zh: "星测"/, "顶栏走共用 Head");
});
