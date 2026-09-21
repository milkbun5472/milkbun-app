// 小红书群里读者 2026-09-21（她转来）：「感觉他记忆上面时间有点混乱，明明是前几天的事情
// 他就说是今天的，有啥方法可以改善一下不」。
//
// 查下来：记忆库每条【只在文本里自带「今天/昨天」这种相对词时】才会挂日期锚（TemporalAnchor.anchor）。
// 可绝大多数条目压根不带那种词（「一起吃了火锅」），于是喂过去的那一行【一点时间信息都没有】——
// 模型只能当成刚刚发生的。所以每条都得带一个「记于哪天·几天前」的戳。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const TA = require("../js/temporal-anchor.js");
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

const DAY = 86400000;
const now = new Date(2026, 8, 21, 10, 0, 0).getTime();   // 2026-09-21

test("每条都有戳，说清是哪天、隔了多久", () => {
  assert.match(TA.stamp(now, now), /〔记于 2026-09-21·就是今天〕/);
  assert.match(TA.stamp(now - DAY, now), /〔记于 2026-09-20·昨天〕/);
  assert.match(TA.stamp(now - 3 * DAY, now), /〔记于 2026-09-18·3 天前〕/);
  assert.match(TA.stamp(now - 40 * DAY, now), /·40 天前〕/);
});

test("跨天按【日历天】算，不是按 24 小时", () => {
  // 昨天深夜 23:50 → 今天清早 00:10：只隔 20 分钟，但那是「昨天」
  const lateLastNight = new Date(2026, 8, 20, 23, 50).getTime();
  const earlyToday = new Date(2026, 8, 21, 0, 10).getTime();
  assert.match(TA.stamp(lateLastNight, earlyToday), /昨天〕/, "按小时数算的话这会被说成今天");
});

test("脏时间戳不许胡说", () => {
  assert.equal(TA.stamp(0, now), "", "没时间戳就别编一个");
  assert.equal(TA.stamp(null, now), "");
  assert.equal(TA.stamp("abc", now), "");
  // 存档搬家/改过系统时间会留下未来的戳——不许说成「-3 天前」
  assert.match(TA.stamp(now + 3 * DAY, now), /存档时间对不上/);
});

test("记忆库每一条都挂上它，而且不顶掉原来那个相对词锚", () => {
  const i = engine.indexOf("function formatMemLib(entries) {");
  assert.ok(i > 0, "抠不出 formatMemLib");
  const seg = engine.slice(i, engine.indexOf("\n}", engine.indexOf("hasOpen", i)));
  assert.ok(/TemporalAnchor\.stamp\(e\.ts\)/.test(seg), "没给每条挂戳");
  assert.ok(/\(dateStamp \? " " \+ dateStamp : ""\) \+ \(dateAnchor \? " " \+ dateAnchor : ""\)/.test(seg),
    "两个戳不是并存——anchor 管的是「今天/昨天」这种词钉成绝对日期，stamp 管的是这条本身几时记的");
  // ⚠️只有一处格式化（四条注入路都从这儿过），所以这一句说给模型听的读法也只写这一处
  assert.ok(/说的是【这件事发生在那一天】，不是今天/.test(seg), "没告诉模型这个戳该怎么读");
  assert.ok(/绝不许把几天前的事说成今天刚发生的/.test(seg), "没拦住那件她报的事");
  assert.ok(/拿不准隔了多久就别硬安时间/.test(seg), "没给出口——不给的话它会硬编一个时间");
  // 一条戳都没有（老存档全是没 ts 的条目）时不许空挂一句读法
  assert.ok(/const hasStamp = arr\.some\(e => e && Number\(e\.ts\) > 0\);/.test(seg), "没戳的时候那句读法也照贴");
});
