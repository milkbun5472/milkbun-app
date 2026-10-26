const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("他自己生日前几天会主动提（她 2026-10-26）", () => {
  const i = app.indexOf("再过 \" + cdu + \" 天就是你自己的生日");
  assert.ok(i > 0);
  assert.ok(app.slice(i, i + 900).includes("不用等 \" + uName + \" 先问"));
});
