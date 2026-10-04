// 星测加的六样（她 2026-10-05：「我觉得都可以宝宝做吧」）——都是算的，不调模型
const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
function load(store) {
  const win = {}; const ctx = { window: win, globalThis: win, React: { useState() {}, useMemo() {} }, loadJSON: (k, d) => (store && store[k]) ?? d, saveJSON() {}, h: () => null, console, Date, Math, JSON };
  vm.createContext(ctx); vm.runInContext(read("astro.js"), ctx); return win.Astro;
}
test("天象：2026 年 10 月的新月、满月、水逆开始落在对的那天", () => {
  const A = load(), on = d => A.skyOn(d).events.map(e => e.k);
  assert.ok(on("2026-10-10").includes("new"), "10 月 10 日新月");
  assert.ok(on("2026-10-26").includes("full"), "10 月 26 日满月");
  assert.ok(on("2026-10-24").includes("rxStart"), "10 月 24 日水星开始逆行");
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
