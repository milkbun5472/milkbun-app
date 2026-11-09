// 日历「今天」不再盖成实心红，跟经期分得开（2026-11-01）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("月事本日历：今天是一圈框，底色照常", () => {
  assert.match(src, /background: pk \? PERIOD_COLORS\[pk\.t\] \+ "33" : "transparent", boxShadow: isT \? "inset 0 0 0 2px #c25a4a" : "none"/);
});
test("主屏日历：今天碰上经期颜色时画框", () => {
  assert.match(src, /border: isToday && pcol \? "2px solid " \+ t\.accent/);
});
