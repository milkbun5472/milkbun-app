// 星测加的六样（她 2026-10-05：「我觉得都可以宝宝做吧」）——都是算的，不调模型
const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
function load(store) {
  const win = {}; const ctx = { window: win, globalThis: win, React: { useState() {}, useMemo() {} }, loadJSON: (k, d) => (store && store[k]) ?? d, saveJSON() {}, h: () => null, console, Date, Math, JSON };
  vm.createContext(ctx); vm.runInContext(read("astro.js"), ctx); return win.Astro;
}
// ⚠️这几个日子【按本机时区算】，不能写死（2026-10-04 抓到：这条在 UTC 的会话里绿、
//   在她本机 CDT 上红）。2026 年 10 月那次满月是 UTC 10-26 04:12 —— 温尼伯是
//   10-25 晚上 11 点多，所以 app 在她那儿标 10-25 才是对的，写死 26 的是测试。
//   改成从那个【真实时刻】换算出本机那一天再比，哪个时区跑都对。
const dayOf = (utcISO) => { const d = new Date(utcISO);
  const p = n => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
test("天象：2026 年 10 月的新月、满月、水逆开始落在对的那天（按本机时区）", () => {
  const A = load(), on = d => A.skyOn(d).events.map(e => e.k);
  assert.ok(on(dayOf("2026-10-10T15:50:00Z")).includes("new"), "新月那天");
  assert.ok(on(dayOf("2026-10-26T04:12:00Z")).includes("full"), "满月那天");
  assert.ok(on(dayOf("2026-10-24T12:00:00Z")).includes("rxStart"), "水星开始逆行那天");
  assert.match(A.skyNote(new Date(2026, 9, 28)), /水星逆行中/);
  assert.equal(A.skyNote(new Date(2026, 9, 5)), "", "平常日子什么都不说");
});
test("好日子：两张盘都有才算，最多三天、按日子排", () => {
  const A = load({ x_astro_birth: { me: { time: "08:00", city: "上海" }, c1: { time: "20:00", city: "北京" } } });
  const gd = A.pairGoodDays("1999-05-08", "c1", "1998-11-20", new Date(2026, 9, 1), 30);
  assert.ok(gd.length <= 3); gd.forEach((x, i) => { if (i) assert.ok(x.day > gd[i - 1].day); });
  assert.deepEqual(Array.from(A.pairGoodDays("05-08", "c1", "1998-11-20", new Date(2026, 9, 1), 30)), [], "没年份排不出盘就没有");
});
test("太阳回归落在生日前后；问星同一天同一问答案不变", () => {
  const A = load(), chart = A.natalChart("1999-05-08", {}), yr = A.solarReturn(chart, 2026);
  assert.match(yr.day, /^2026-05-0[789]$/);
  const a = A.askStars("这周适合表白吗", chart, 1, "2026-10-05"), b = A.askStars("这周适合表白吗", chart, 1, "2026-10-05");
  assert.equal(a.verdict, b.verdict); assert.equal(a.area, "感情");
});
test("天象和好日子接进日历与聊天那一行；群榜能发到群里", () => {
  const app = read("app.js"), comp = read("components.js"), astro = read("astro.js");
  assert.match(app, /window\.Astro\.skyNote\(today\)/); assert.match(app, /window\.Astro\.pairGoodDays\(profile/);
  assert.match(comp, /window\.Astro\.skyOn\(dk\)/); assert.match(app, /onShareToGroup: \(gid, text\)/);
  assert.match(astro, /\["chart", "星盘"\], \["group", "群榜"\], \["ask", "问星"\]/);
});
test("查手机里有星测：接真数据、不生成；日子取 TA 上次真打开那天（刷新、看TA玩点开）", () => {
  const phone = read("phone.js"), app = read("app.js"), astro = read("astro.js");
  assert.match(phone, /const PHONE_LIVE_KEYS = \[[^\]]*"astro"\]/);
  assert.match(phone, /if \(key === "astro"\) return/);
  assert.match(app, /opened\.indexOf\("astro"\) >= 0 && window\.Astro && window\.Astro\.markSeen/);
  assert.match(app, /整份刷新[\s\S]{0,120}window\.Astro\.markSeen\(char\.id\)/);
  assert.match(astro, /const seenDay = charId =>/);
});
test("今日签：手动抽和自动发同一份提示词；能转发回聊天；自动默认关", () => {
  const app = read("app.js"), astro = read("astro.js"), pol = read("auto-refresh-policy.js"), comp = read("components.js");
  assert.match(astro, /function signInstruction\(meName, facts\)/);
  assert.match(app, /window\.Astro\.signInstruction\(userName\(profile\), facts\)/);
  assert.match(app, /kind: "astroshare"/); assert.match(comp, /if \(kind === "astroshare"\) return window\.AstroSignCard/);
  assert.match(pol, /id: "astroSign"[^}]*globalDefault: false, charDefault: false/);
});
test("月亮日记写的心情就是健康 app 那一格；好日子头像光环、群里吵一架都有", () => {
  const astro = read("astro.js"), comp = read("components.js");
  assert.match(astro, /d0\.mood = Object\.assign\(\{\}, d0\.mood/); assert.match(astro, /H\.save\(d0\)/);
  assert.match(comp, /window\.Astro\.isGoodDay\(character\)/);
  assert.match(astro, /照着星盘吵一架给我看看/);
});
