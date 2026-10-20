// 日程照虚拟钟的日子排（她 2026-10-20：「开了虚拟钟能按虚拟日期来生成接下来一周」「为啥不能抽成公共的」）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", f), "utf8");
const scr = R("js/screens.js"), app = R("js/app.js"), comp = R("js/components.js"), core = R("js/char-day-core.js");
const SC = require("../js/schedule-clock.js");

test("planDay／planMinute：钟上开了跟钟排就是钟上那天那分，没开照现实", () => {
  const real = Date.UTC(2026, 9, 20, 4, 0);          // 现实 10-20 04:00 UTC
  const virt = Date.UTC(2031, 2, 7, 13, 30);         // 虚拟 2031-03-07 13:30 UTC
  let cfg = { on: true, base: virt, schedFollow: true };
  global.vclockCfg = () => cfg; global.vclockMap = () => virt;
  const ch = { id: "c1", tz: 0 };
  assert.equal(SC.planFollows(ch), true);
  assert.equal(SC.planDay(ch, real, 0), "2031-03-07");
  assert.equal(SC.planMinute(ch, real, 0), 13 * 60 + 30);
  assert.equal(SC.characterFrame(ch, real).sourceDay, "2031-03-07", "今天的日程那页也找虚拟那天");
  cfg = { on: true, base: virt };
  assert.equal(SC.planFollows(ch), false);
  assert.equal(SC.planDay(ch, real, 0), "2026-10-20");
  assert.equal(SC.planMinute(ch, real, 0), 4 * 60);
  delete global.vclockCfg; delete global.vclockMap;
});

test("接线：日程的哪天哪分只问 ScheduleClock 一处", () => {
  assert.ok(/function schedLocalDayKey\(char, at\) \{ return window\.ScheduleClock\.planDay\(/.test(scr));
  assert.ok(/currentSeqIdx\(seqs, window\.ScheduleClock\.planMinute\(/.test(scr));
  assert.ok(/const charLocalMin = char => window\.ScheduleClock\.planMinute\(/.test(app));
  assert.ok(!/schedFollowOn/.test(core), "今天的日程那页不另写一份判断");
  assert.ok(!/plans\[schedLocalDayKey\(char\)\] \|\| plans\[schedDayKey\(new Date\(\)\)\]/.test(app));
  assert.ok(/schedFollow: !!x/.test(comp) && /const today = _viewChar && typeof schedNowDate === "function" \? schedNowDate\(_viewChar\) : new Date\(\);/.test(comp));
});
