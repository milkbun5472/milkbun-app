// 第三刀（她 2026-09-14「继续下一刀」）：券夹和纪念册。
//
// 原来两个 tab 是「还没兑」和「票根全本」，两条平铺的长列表。券一多就淹了——
// 同款堆在一起，真正想用的那张要往下翻很久。
// 收法两条：**没兑的按款叠起来**，**兑过的按月收进纪念册**。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const K = require(path.join(root, "js/gacha.js"));
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

const now = Date.UTC(2026, 8, 14, 12);
const c = (id, poolId, r, ts, extra) => Object.assign({ id, poolId, r, ts, name: poolId }, extra || {});
const pile = () => [
  c("a", "x_date", "SSR", now - 5000), c("b", "x_date", "SSR", now - 4000), c("c", "x_date", "SSR", now - 3000),
  c("d", "s_word", "SR", now - 2000), c("e", "s_drop", "SR", now - 1000),
  c("f", "r_note", "R", now - 900, { redeemedTs: now - 800, result: { title: "一条便签" } }),
  c("g", "r_photo", "R", now - 40 * 86400000, { redeemedTs: now - 40 * 86400000, result: { title: "一张照片" } })
];

test("同款叠成一叠，每张自己的抽取时间照旧留着", () => {
  const st = K.stackOpen(pile(), {});
  const date = st.find(g => g.poolId === "x_date");
  assert.equal(date.n, 3);
  assert.equal(date.cards.length, 3);
  assert.deepEqual(date.cards.map(x => x.ts), [now - 5000, now - 4000, now - 3000], "同款里没按先后排");
  // 先进先出：摆出来的那张是最早抽到的
  assert.equal(date.first.id, "a");
});

test("兑过的不进券夹，票根一张都不少", () => {
  const st = K.stackOpen(pile(), {});
  assert.ok(!st.some(g => g.poolId === "r_note"), "兑过的还留在券夹里");
  const al = K.albumOf(pile());
  assert.equal(al.reduce((n, m) => n + m.n, 0), 2);
});

test("按月收，新的月份在前，同月里新的在前", () => {
  const al = K.albumOf(pile());
  assert.equal(al.length, 2, "40 天前那张没被分到另一个月");
  assert.ok(al[0].key > al[1].key, "月份倒着排了");
  assert.match(al[0].zh, /月/);
});

test("筛甜的皮的：两面都占的那张两边都要出现", () => {
  const rows = [c("p", "s_drop", "SR", now), c("q", "s_dual", "SR", now), c("s", "s_word", "SR", now)];
  const tease = K.stackOpen(rows, { tone: "tease" }).map(g => g.poolId);
  const sweet = K.stackOpen(rows, { tone: "sweet" }).map(g => g.poolId);
  assert.ok(tease.indexOf("s_drop") >= 0 && tease.indexOf("s_dual") >= 0);
  assert.ok(sweet.indexOf("s_word") >= 0 && sweet.indexOf("s_dual") >= 0, "双面券该两边都在");
  assert.ok(sweet.indexOf("s_drop") < 0);
});

test("留到下次＝整叠别在最上面，而且不设到期", () => {
  const rows = K.setPinned(pile(), "s_word", true);
  assert.equal(K.stackOpen(rows, {})[0].poolId, "s_word", "别上去的没排到最前面");
  // 取下来还能回去
  assert.notEqual(K.stackOpen(K.setPinned(rows, "s_word", false), {})[0].poolId, "s_word");
  // ⚠️不许长出「到期」「快用掉」这类催促的字段
  const src = fs.readFileSync(path.join(root, "js/gacha.js"), "utf8");
  assert.doesNotMatch(src, /expire|expiry|dueSoon/i, "券长出到期了");
  assert.ok(K.setPinned(pile(), "r_note", true).every(x => !(x.id === "f" && x.pinned)), "兑过的也能别上去");
});

test("排序：默认稀的在前，也能换成最早抽到", () => {
  const st = K.stackOpen(pile(), {});
  assert.equal(st[0].r, "SSR");
  const old = K.stackOpen(pile(), { order: "old" });
  assert.equal(old[0].poolId, "x_date", "最早抽到那一叠没排到前面");
});

test("界面只负责画，叠和收都在那一份纯函数里（one-public-mechanism）", () => {
  assert.match(scr, /K\.stackOpen\(mine, \{ tone: tone, order: order \}\)/);
  assert.match(scr, /K\.albumOf\(mine\)/);
  // 页面里不许自己再写一套分组
  const ui = scr.slice(scr.indexOf("function Gacha({ partner"), scr.indexOf("const DRAWER_KIND"));
  assert.doesNotMatch(ui, /reduce\(\(.*\) => \{[\s\S]{0,80}poolId/, "页面里又分了一次组");
  assert.match(ui, /stackLeft: \(!on && g\.n > 1\) \? g\.n - 1 : 0/, "收起来的时候没标后面还有几张");
});

test("留到下次那一下真的落盘", () => {
  assert.match(app, /onGachaPin: \(poolId, on\) => \{/);
  assert.match(app, /window\.GachaKit\.setPinned\(gachaCardsRef\.current \|\| \[\], poolId, on\)/);
  assert.match(app, /saveJSON\("x_gachaCards", n\)/);
});

test("券夹和纪念册的数各算各的，别把兑过的算进券夹", () => {
  const ui = scr.slice(scr.indexOf('["open", "券夹 "'), scr.indexOf('["open", "券夹 "') + 200);
  assert.match(ui, /券夹 " \+ open\.length/);
  assert.match(ui, /纪念册 " \+ \(mine\.length - open\.length\)/);
});
