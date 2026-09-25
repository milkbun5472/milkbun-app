"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const src = fs.readFileSync("js/fairy-garden.js", "utf8");

const i = src.indexOf("root.FairyGardenApp = function FairyGardenApp(");
assert.ok(i > 0, "抠不出 FairyGardenApp");
const appFn = src.slice(i);

// 她 2026-09-19：「好像超过三个第四个存档删不掉」
// 病根不是「超过三个」：原来靠 row.key 认聊天里那间房的存档，而 key 只有
// 【扫回来的】那几档才带，于是同样是庭院房，一张有「删掉」一张没有。
test("每一档都删得掉，不许再按 row.key 分两种命", () => {
  assert.match(appFn, /onClick: \(\) => drop\(row\)/);
  assert.doesNotMatch(appFn, /row\.key && row\.key\.indexOf\("::room::"\)/,
    "又按 row.key 把删掉按钮藏起来了——那个字段只有扫回来的档才有");
});

// .claude/rules/never-say-delete-first.md：会让数据消失的动作，话里必须先带一句导出。
test("删档的确认里要先说导出", () => {
  const j = appFn.indexOf("const drop = row => requestAppConfirm"),
    k = appFn.indexOf("const pickForNew", j > 0 ? 0 : 0);
  assert.ok(j > 0, "抠不出 drop");
  const drop = appFn.slice(j, appFn.indexOf("// 挑人那一页", j));
  assert.ok(drop.length > 100 && drop.length < 1600, "drop 那段切歪了");
  assert.match(drop, /导出全部数据/, "没告诉她先导出一份就让她删");
  assert.match(drop, /const roomSave = row =>|roomSave\(row\)/);
});

// 她 2026-09-19：「第一个世界是一个 svg 填色房子在左边，然后后续第二个
// （可以先做一个圆圈占位）再做两个点之间有小脚印的线状连起来，以后第三个又在左边」
test("入口页是一条左右交替的小路", () => {
  assert.match(src, /const worldHouse = \(\) =>/, "房子没了");
  assert.match(src, /const worldSoon = \(\) =>/, "占位的空圈没了");
  assert.match(src, /const footTrail = \(toRight, key\) =>/, "脚印没了");
  assert.match(appFn, /const stops = WORLDS\.concat\(\[null\]\);/, "路的末尾不再留空圈");
  assert.match(appFn, /const left = i % 2 === 0;/, "站在哪一侧不再只看排第几");
  assert.match(appFn, /path\.push\(footTrail\(i % 2 === 1,/, "两站之间不再连脚印");
});

// ⚠️她 2026-09-18 把三个占位世界删了：「许的是三件谁都没在做的事」。
// 空圈可以留（是她要的），但它不许有名字、介绍，也不许点得进去。
test("占位那一站不许变成又一张空头支票", () => {
  const w = src.slice(src.indexOf("const WORLDS = ["), src.indexOf("const INDEX_KEY"));
  assert.equal((w.match(/\{ id:/g) || []).length, 2, "这里只开放已经接入的庭院和列车");
  const stop = appFn.slice(appFn.indexOf("const stop = (w, i) =>"), appFn.indexOf("const path = []"));
  assert.ok(stop.length > 200, "抠不出 stop");
  assert.match(stop, /return w\s*\?\s*h\("button"/, "能进的那一站不是按钮了");
  assert.match(stop, /:\s*h\("div", \{ key: "soon"/, "空圈变成点得进去的了");
  assert.match(stop, /w \? h\("div"[^]*?w\.note\) : null/, "空圈也发了介绍");
  assert.match(stop, /w \? h\("span"[^]*?"可以进"\) : null/, "空圈也挂了「可以进」");
});
