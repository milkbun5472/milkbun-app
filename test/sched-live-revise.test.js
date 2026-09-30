const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const screens = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const engine = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
function load() {
  const pad2 = n => String(n).padStart(2, "0");
  const src = screens.slice(screens.indexOf("function schedSpliceNow"), screens.indexOf("function schedSleepCarry"));
  return new Function("pad2", src + "; return schedSpliceNow;")(pad2);
}
test("当场改的安排切进今天日程：之前的留着，被盖那段两头保留", () => {
  const f = load();
  const out = f([{ time: "09:00", end: "12:00", title: "上班" }, { time: "14:00", end: "18:00", title: "开会" }], 630, { title: "和你逛街", until: "15:00" });
  assert.deepStrictEqual(out.map(x => x.time + "-" + x.end + " " + x.title), ["09:00-10:30 上班", "10:30-15:00 和你逛街", "15:00-18:00 开会"]);
  assert.ok(out[1].deviation && out[1].deviation.plan.includes("上班"));
});
test("聊天和线下都把 schedNow 交给 applySchedChange", () => {
  assert.ok(app.includes("applySchedChange(charId, parsed.schedNow)"));
  assert.ok(app.includes("applySchedChange(charId, res.schedNow)"));
  assert.ok(app.includes("${SCHED_NOW_SPEC}"));
  assert.ok(engine.includes("${SCHED_NOW_SPEC}toy"));
  assert.ok(engine.includes("schedNow: (parsed.schedNow"));
});
