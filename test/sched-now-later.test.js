// 聊的是明天的安排，不许改今天此刻（群友 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("schedNow 标题或理由写着以后的日子就不动今天", () => {
  const m = app.match(/const SCHED_LATER_RE = (\/[^\n]+\/);/); assert.ok(m);
  const re = eval(m[1]);
  assert.ok(re.test("明天早上去图书馆 约好了"));
  assert.ok(re.test("陪她 下周一起去看展"));
  assert.ok(!re.test("留下来陪她吃饭 临时改了"));
  assert.match(app, /if \(SCHED_LATER_RE\.test\(String\(change\.title \|\| ""\) \+ " " \+ String\(change\.reason \|\| ""\)\)\) return;/);
});
test("schedNow 说明里写明：聊的是明天、以后的安排不填", () => {
  const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  assert.match(eng, /聊的是明天、以后的安排也不填，那不是此刻的事。';/);
});
