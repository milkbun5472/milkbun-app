// 名片斜铺色：资料页出厂头像色（AV_COLORS[0]）不算「挑过」，让 cardTint 雾蓝出来（她 2026-11-17）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("HomeCard 不把出厂头像色当成挑过的颜色", () => {
  const i = src.indexOf("function HomeCard(");
  const body = src.slice(i, i + 2500);
  assert.match(body, /const pickedColor = profile\.color && String\(profile\.color\)\.toLowerCase\(\) !== String\(AV_COLORS\[0\]\)\.toLowerCase\(\)/);
  assert.match(body, /const accent = pickedColor \|\| t\.cardTint \|\| t\.accent;/);
});
