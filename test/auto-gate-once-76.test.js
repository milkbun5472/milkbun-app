const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const g = fs.readFileSync(__dirname + "/../js/auto-gate.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
// 她 2026-11-08：「你看看别的自动的要不要也改改」——一期只试一次；日程一周一次，留着重试
test("自动的活一期只试一次，日程自己留三次", () => {
  assert.match(g, /const MAX_TRIES = 1;/);
  assert.match(app, /genScheduleWeek\(j\.c, \{ from: j\.from, count: j\.count, silent: true \}\), \{ maxTries: 3 \}\);/);
});
