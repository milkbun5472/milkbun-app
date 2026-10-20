// 日程照虚拟钟的日子排（她 2026-10-20：「开了虚拟钟能按虚拟日期来生成接下来一周」）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", f), "utf8");
const scr = R("js/screens.js"), app = R("js/app.js"), comp = R("js/components.js");
const SC = require("../js/schedule-clock.js");

// 把 screens.js 里那几支函数原样拿出来，接上一只假钟
const grab = name => scr.split("\n").find(l => l.startsWith("function " + name + "("));
const build = (cfg, map) => new Function("window", "vclockCfg", "vclockMap", "vclockYear",
  [grab("schedFollowOn"), grab("schedFrame"), grab("schedNowDate"), grab("schedLocalDayKey"),
   "return { schedFollowOn, schedLocalDayKey, schedNowDate };"].join("\n"));

test("钟上开了跟钟排：日程的那一天是虚拟那天；没开照现实", () => {
  const real = Date.UTC(2026, 9, 20, 4, 0);          // 现实 10-20
  const virt = Date.UTC(2031, 2, 7, 4, 0);           // 虚拟 2031-03-07
  const root = { ScheduleClock: SC, vclockCfg: () => cfg, vclockMap: () => virt };
  let cfg = { on: true, base: virt, schedFollow: true };
  global.vclockCfg = root.vclockCfg; global.vclockMap = root.vclockMap;
  const f = build()({ ScheduleClock: SC }, () => cfg, () => virt, y => y + "年");
  const ch = { id: "c1", tz: 0 };
  assert.equal(f.schedFollowOn("c1"), true);
  assert.equal(f.schedLocalDayKey(ch, real), "2031-03-07");
  cfg = { on: true, base: virt };                     // 关着：还是现实那天
  assert.equal(f.schedFollowOn("c1"), false);
  assert.equal(f.schedLocalDayKey(ch, real), "2026-10-20");
  delete global.vclockCfg; delete global.vclockMap;
});

test("接线：此刻那一段、找不到当天不退回现实那份、钟上有开关、日历跟着他那只钟", () => {
  assert.ok(/const f = schedFrame\(char\); return window\.ScheduleClock\.currentSeqIdx\(seqs, f && f\.virtual \? f\.minute/.test(scr));
  assert.ok(!/plans\[schedLocalDayKey\(char\)\] \|\| plans\[schedDayKey\(new Date\(\)\)\]/.test(app));
  assert.ok(/schedFollow: !!x/.test(comp) && /日程照这只钟的日子排/.test(comp));
  assert.ok(/const today = _viewChar && typeof schedNowDate === "function" \? schedNowDate\(_viewChar\) : new Date\(\);/.test(comp));
  assert.ok(/if \(vc && vc\.schedFollow\) return \{ date: d,/.test(scr));
});
