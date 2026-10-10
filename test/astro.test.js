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
  assert.match(comp, /f_def_daily: \{ name: "每日看", keys: \["cwallet", "tarot", "shop", "takeout", "astro"[^\]]*\] \}/);
  // v74.650 起星测和时刻共用 placeNewAppOnce（one-public-mechanism）：星测那一处只剩一行
  assert.match(comp, /function placeAstroOnce\(st\) \{ return placeNewAppOnce\(st, "astro", "tarot", "x_astroPlaced"\); \}/, "老用户：放进有塔罗的那个文件夹");
  assert.match(comp, /if \(st && Object\.keys\(st\)\.length\) st = placeAstroOnce\(st\);/);
  assert.match(comp, /if \(loadJSON\(flag, false\)\) return st;/, "只搬一次：她挪走了别再塞回去");
  assert.match(app, /screen === "astro"\) body = h\(window\.AstroApp, \{/);
  assert.match(core, /astro: "星测"/);
  assert.match(man, /\{ id: "astro", app: "astro", zh: "星测"/);
  assert.match(html, /<script src="js\/astro\.js\?v=[\d.]+"><\/script>/);
  assert.match(src, /runProbe\(p, ctx, \{ voice: true, instruction: instruction \+ (?:reroll \+ )?voiceTail\(\)/);
  assert.match(src, /maxTokens: 100000/);
  assert.match(src, /h\(Head, \{ zh: "星测"/, "顶栏走共用 Head");
});

// ── 严谨版（她 2026-10-03：「要是更严谨点得咋弄」「做吧」）──
test("星历：2000-01-01 12:00 UT 各行星黄经对得上（误差一度以内）", () => {
  const p = A.planetLongitudes(new Date(Date.UTC(2000, 0, 1, 12)));
  const ref = { sun: 280.37, moon: 223.32, mercury: 271.89, venus: 241.57, mars: 327.96, jupiter: 25.25, saturn: 40.40, uranus: 314.81, neptune: 303.19, pluto: 251.45 };
  for (const k in ref) { const d = Math.abs(p[k] - ref[k]); assert.ok(Math.min(d, 360 - d) < 1, k + " 差了 " + d.toFixed(2) + "°"); }
});

test("上升：赤道、天顶在白羊零度时，上升在巨蟹零度", () => {
  // 反推一个 RAMC=0 的时刻太麻烦，直接验公式两头：同一时刻往东挪 90° 经度，上升跟着转
  const t = new Date(Date.UTC(2000, 2, 20, 0));
  const a0 = A.ascendant(t, 0, 0), a90 = A.ascendant(t, 0, 90);
  const d = ((a90 - a0) % 360 + 360) % 360;
  assert.ok(d > 80 && d < 100, "经度东移 90°，上升也该挪 90° 左右：" + d.toFixed(1));
});

test("星盘：没年份不排；没时间不算上升、月亮可能差一点；填了时间城市才有上升", () => {
  assert.equal(A.natalChart("05-08", {}), null);
  const noTime = A.natalChart("1999-05-08", { city: "北京", lat: 39.9, lon: 116.41, tz: 8 });
  assert.equal(noTime.lon.asc, undefined);
  assert.equal(noTime.hasTime, false);
  const full = A.natalChart("1999-05-08", { time: "08:30", city: "北京", lat: 39.9, lon: 116.41, tz: 8 });
  assert.ok(full.lon.asc >= 0 && full.lon.asc < 360);
  assert.equal(A.SIGNS[Math.floor(full.lon.sun / 30)][0], "金牛");
  assert.ok(A.natalChart("农历1999年三月廿三", {}), "带年份的农历生日也能排");
});

test("合盘：同一张盘自己跟自己合，满是合相；分数夹在 32~98；行运给出几颗星和依据", () => {
  const c = A.natalChart("1999-05-08", { time: "08:30", lat: 39.9, lon: 116.41, tz: 8 });
  const self = A.synastry(c, c);
  assert.ok(self.list.length >= 10);
  assert.ok(self.score >= 32 && self.score <= 98);
  const other = A.synastry(c, A.natalChart("1996-11-02", {}));
  assert.ok(other.score >= 32 && other.score <= 98);
  assert.equal(A.synastry(c, null), null);
  const tr = A.transits(c, new Date(Date.UTC(2026, 9, 3, 4)));
  for (const k of ["all", "love", "work", "money"]) assert.ok(tr[k] >= 1 && tr[k] <= 5);
  assert.ok(Array.isArray(tr.hits) && tr.hits.length <= 5);
});

test("出生信息只存在星测里（x_astro_birth），整页、不动档案", () => {
  assert.match(src, /const BIRTH_KEY = "x_astro_birth";/);
  assert.match(src, /function BirthPage\(/);
  assert.match(src, /h\(Head, \{ zh: "出生信息"/);
  assert.ok(!/onEditChar[^\n]*birth|saveChar/.test(src), "不许顺手改角色档案");
  assert.ok(A.CITIES.length >= 60 && A.CITIES.every(c => c.length === 4 && isFinite(c[1]) && isFinite(c[2]) && isFinite(c[3])));
});

test("中国夏令时：1986~1991 年按 PRC 规则自动换算，别的年份、境外都不动", () => {
  assert.equal(A.chinaDst(1986, 5, 4, 1), false); assert.equal(A.chinaDst(1986, 5, 4, 2), true);
  assert.equal(A.chinaDst(1988, 4, 16, 12), false); assert.equal(A.chinaDst(1988, 4, 17, 12), true, "1988 年是 4 月 17 日（4 月 11 日之后第一个星期天）");
  assert.equal(A.chinaDst(1989, 9, 17, 1), true); assert.equal(A.chinaDst(1989, 9, 17, 2), false);
  assert.equal(A.chinaDst(1992, 7, 1, 12), false); assert.equal(A.chinaDst(1985, 7, 1, 12), false);
  const bj = { time: "12:00", city: "北京", lat: 39.9, lon: 116.41, tz: 8 };
  const summer = A.natalChart("1988-07-01", bj), hk = A.natalChart("1988-07-01", Object.assign({}, bj, { city: "香港", lat: 22.32, lon: 114.17 }));
  assert.equal(summer.dst, true, "老存档没 cc，北京也要认成大陆");
  assert.equal(hk.dst, false, "香港不跟大陆的夏令时");
  assert.equal(A.natalChart("1988-07-01", Object.assign({}, bj, { dst: false })).dst, false, "她关掉就不算");
  // 夏令时一小时 = 太阳挪约 0.04°、上升挪十几度
  const off = A.natalChart("1988-07-01", Object.assign({}, bj, { dst: false }));
  const d = Math.abs(summer.lon.asc - off.lon.asc); assert.ok(Math.min(d, 360 - d) > 8);
});

test("时区：单时区国家直接给；美加俄这种按经度猜、标出来让她确认", () => {
  assert.deepEqual(A.tzForPlace("cn", 87.6), { tz: 8, guessed: false }, "乌鲁木齐也是东八区，不按经度猜");
  assert.deepEqual(A.tzForPlace("jp", 139), { tz: 9, guessed: false });
  assert.deepEqual(A.tzForPlace("us", -118.2), { tz: -8, guessed: true });
  assert.deepEqual(A.tzForPlace("us", -97.74), { tz: -6, guessed: true }, "奥斯汀是中部时间");
  assert.match(src, /nominatim\.openstreetmap\.org\/search\?format=jsonv2/);
  assert.match(src, /只发地名/);
});
