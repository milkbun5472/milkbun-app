const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const st = fs.readFileSync(path.join(__dirname, "..", "js", "study.js"), "utf8");
// 群里 2026-10-17：「能不能加一个 char 提醒我学习」——一起学里的该复习了，老师来聊天里催
test("一起学·到点让老师催复习：她打开才催、一门课一天一次、走主动消息那条", () => {
  assert.match(st, /remindReview: !on/);
  assert.match(app, /cu\.remindReview !== true \|\| slog\[cu\.id\] === dayKey/);
  assert.match(app, /remind: \{ title: "复习「" \+ \(cu\.subject \|\| cu\.title \|\| "这门课"\) \+ "」", note: n \+ " 道到点该复习了", src: "study" \}/);
  assert.match(app, /opts\.remind\.src === "study"/);
});
