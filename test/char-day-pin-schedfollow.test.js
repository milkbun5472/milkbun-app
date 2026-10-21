const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
test("钟停着、日程照钟排：今天的日程读钟上那天，不被旧钉子盖掉", () => {
  const root = { vclockCfg: () => ({ speed: 0, at: 0, schedFollow: true }), vclockMap: () => Date.UTC(2026, 9, 18, 2, 5) };
  new Function("window", "globalThis", fs.readFileSync(__dirname + "/../js/schedule-clock.js", "utf8"))(root, root);
  root.ScheduleClock = root.ScheduleClock || globalThis.ScheduleClock;
  root.CharDayLink = { presentation: () => null };
  new Function("window", "globalThis", "root", fs.readFileSync(__dirname + "/../js/char-day-core.js", "utf8").replace(/\}\)\((?:typeof window[^)]*|window|globalThis|this)\);?\s*$/, "})(root);"))(root, root, root);
  const char = { id: "c1", tz: "8" };
  const st = root.CharDayCore.dayState(char, { "2026-10-18": { seqs: [{ seq: 1, time: "09:00", end: "12:00", title: "x" }] } }, Date.now(),
    { followVirtual: true, clockSource: { virtualAt: Date.UTC(2026, 9, 18, 2, 5), sourceDay: "2026-10-21" } });
  assert.equal(st.sourceDay, "2026-10-18"); assert.ok(st.hasPlan);
});
