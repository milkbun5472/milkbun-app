const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "pomodoro.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const gacha = fs.readFileSync(path.join(__dirname, "..", "js", "gacha.js"), "utf8");
function loadLogic() {
  const ctx = { window: {}, Date, Math, JSON, localStorage: { removeItem() {} } };
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: "pomodoro.js" });
  return ctx.window.PomodoroLogic;
}
test("循环番茄：专注完进休息，第 4 轮长休，休息完进下一轮；专注时长累计", () => {
  const L = loadLogic(), t0 = 1e12;
  let s = { kind: "cycle", phase: "focus", round: 1, rounds: 0, doneFocusSec: 0, min: 25, endTs: t0 };
  s = L.nextCyclePhase(s, t0);
  assert.equal(s.phase, "break"); assert.equal(s.breakMin, 5); assert.equal(s.rounds, 1); assert.equal(s.doneFocusSec, 1500);
  assert.equal(L.focusedSec(s, t0 + 1000), 1500, "休息段不算专注");
  s = L.nextCyclePhase(s, t0 + 300000);
  assert.equal(s.phase, "focus"); assert.equal(s.round, 2);
  s = { ...s, round: 4 }; s = L.nextCyclePhase(s, t0);
  assert.equal(s.breakMin, 15, "第 4 轮长休");
});
test("正计时：已坐时长从零往上走", () => {
  const L = loadLogic(), t0 = 1e12;
  const s = { kind: "up", min: 1440, startTs: t0, endTs: t0 + 1440 * 60000 };
  assert.equal(L.focusedSec(s, t0 + 90000), 90);
});
test("TA也在忙、溜号、做完没、攒点、日历都接上了", () => {
  assert.match(src, /"【你这边】你也不是干坐着陪/);
  assert.match(src, /if \(away < 20000\) return;/);
  assert.match(src, /d\.reminders = \(d\.reminders \|\| \[\]\)\.map\(x => x && x\.id === rec\.memoId \? \{ \.\.\.x, done: true \} : x\)/);
  assert.match(src, /"data-wk": "pomcal"/);
  assert.match(app, /onEarn: charId => \{ try \{ return gachaEarn\(charId, "focus"\);/);
  assert.match(gacha, /focus: 40 \}/);
});
test("日历下面「让TA点评」：点了才调一次，按人存最近一句", () => {
  assert.match(src, /saveJSON\("x_pomoCalNote", n\)/);
  assert.match(src, /"data-wk": "pomcalask", onClick: askReview/);
});
