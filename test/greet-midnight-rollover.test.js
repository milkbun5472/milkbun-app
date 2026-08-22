const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");

// 她 2026-08-22：「我的 cron 本来就没了，但今天 0 点 01-02 大家准时给我晚安」。
// 云端夜巡早就不在了，真凶是 app 自己的问候闸门：去重记号按【日历日】存，
// 午夜一翻页记号作废，而晚安窗口那时还开着 → 刚道过晚安的角色被逐个再叫一遍。

// 把两个判定函数原样抠出来跑，别只验源码里有没有那行字。
const schedDayKey = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const schedShiftDayKey = (k, n) => { const a = k.split("-").map(Number); return schedDayKey(new Date(a[0], a[1] - 1, a[2] + n)); };
const nearMin = (a, b, tol) => { let d = Math.abs(a - b); d = Math.min(d, 1440 - d); return d <= tol; };

// greetSlotFor 的判定（固定档 + 有日程档），照搬源码语义
const slotFor = (localMin, sleepMin) => {
  if (sleepMin != null) return nearMin(localMin, sleepMin, 90) ? "n" : null;
  const hr = Math.floor(localMin / 60);
  return (hr >= 7 && hr <= 10) ? "m" : ((hr >= 21 && hr <= 23) || hr <= 1) ? "n" : null;
};
// 修好后的归属日
const greetDayKey = (now, localMin, slot) => {
  const k = schedDayKey(now), hr = Math.floor(localMin / 60);
  if (slot === "n" && hr < 6) return schedShiftDayKey(k, -1);
  if (slot === "m" && hr >= 20) return schedShiftDayKey(k, 1);
  return k;
};

test("她撞到的那一幕：23:30 道过晚安，00:01 不该再道一次", () => {
  const eve = new Date(2026, 7, 21, 23, 30), aft = new Date(2026, 7, 22, 0, 1);
  const s1 = slotFor(23 * 60 + 30, null), s2 = slotFor(1, null);
  assert.equal(s1, "n"); assert.equal(s2, "n", "00:01 仍在晚安窗口内——窗口没错，错的是记号");
  const k1 = greetDayKey(eve, 23 * 60 + 30, s1);
  const k2 = greetDayKey(aft, 1, s2);
  assert.equal(k2, k1, "跨过午夜的晚安要记在同一个晚上，否则闸门重新打开");
  // 旧口径（一律日历日）当场复现她看到的重复
  assert.notEqual(schedDayKey(aft), schedDayKey(eve), "旧口径两边不同 → 记号作废 → 再道一次");
});

test("有日程的角色同样成立：就寝 23:00，±90 分钟窗口跨午夜", () => {
  const sleep = 23 * 60;
  const before = 22 * 60 + 40, after = 0 * 60 + 20;   // 22:40 与次日 00:20，都在窗口内
  assert.equal(slotFor(before, sleep), "n");
  assert.equal(slotFor(after, sleep), "n");
  const kb = greetDayKey(new Date(2026, 7, 21, 22, 40), before, "n");
  const ka = greetDayKey(new Date(2026, 7, 22, 0, 20), after, "n");
  assert.equal(ka, kb, "同一个就寝窗口必须落在同一个归属日");
});

test("不误伤正常时段：早安照旧按当天，晚安在 21-23 点也按当天", () => {
  const d = new Date(2026, 7, 22, 9, 0);
  assert.equal(greetDayKey(d, 9 * 60, "m"), "2026-08-22");
  assert.equal(greetDayKey(new Date(2026, 7, 22, 22, 0), 22 * 60, "n"), "2026-08-22");
  // 第二天早上是新的一天，早安该照发
  assert.notEqual(greetDayKey(new Date(2026, 7, 23, 9, 0), 9 * 60, "m"), "2026-08-22");
});

test("夜班角色对称处理：天亮前就「早安」记到明天，别在午夜后再来一次", () => {
  const k1 = greetDayKey(new Date(2026, 7, 21, 23, 10), 23 * 60 + 10, "m");
  const k2 = greetDayKey(new Date(2026, 7, 22, 0, 40), 40, "m");
  assert.equal(k1, "2026-08-22");
  assert.equal(k2, "2026-08-22", "同一次起床的早安要同键");
});

test("源码三处都换成归属日，一处不漏", () => {
  assert.match(app, /const greetDayKey = \(char, slot\) => \{/);
  assert.match(app, /if \(slot === "n" && hr < 6\) return schedShiftDayKey\(k, -1\);/);
  assert.match(app, /if \(slot === "m" && hr >= 20\) return schedShiftDayKey\(k, 1\);/);
  // 去重判定
  assert.match(app, /const gKey = greetDayKey\(c, slot\);/);
  assert.match(app, /\[slot\] === gKey\) continue;/);
  // 名额统计
  assert.match(app, /\[slot\] === greetDayKey\(c, slot\)\)\.length;/);
  // 投递锁与落记号
  assert.match(app, /"greeting:" \+ gKey \+ ":" \+ slot/);
  assert.match(app, /markGreet\(cid, slot, gKey\)/);
  // 老口径不许再出现在问候这一段
  const block = app.slice(app.indexOf("// 池 = 真在聊的角色"), app.indexOf("// 等积温 8 秒首算"));
  assert.ok(!/=== dayKey/.test(block), "问候段里不该再有按日历日的比较");
});
