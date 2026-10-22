const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const st = fs.readFileSync(__dirname + "/../js/study.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("学习计划：日子由代码排（去掉不排的星期几），模型只填每天学什么；存在课身上、写进日历、到点问", () => {
  const fn = new Function("DAY_MS", st.slice(st.indexOf("function planDayKey("), st.indexOf("function planToday(")) + "\nreturn planDates;")(86400000);
  const from = new Date(2026, 9, 19).getTime();   // 周一
  const ds = fn("2026-10-25", [0, 6], from);
  assert.deepEqual(ds, ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
  assert.deepEqual(fn("2026-10-18", [], from), [], "死线在今天之前就是空");
  assert.match(st, /Object\.assign\(\{\}, fresh, \{ plan: plan, updated_at: Date\.now\(\) \}\)/);
  assert.match(st, /window\.__studyPlanCal\.sync\(curId,/);
  assert.match(app, /srcId: tag \}\]; \}\);/);
  assert.match(app, /remind: \{ title: "今天的「" \+ \(cu\.subject/);
  assert.match(st, /cell\("plan", "学习计划"/);
});
