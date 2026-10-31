// 名片封面不被样式面板的底图盖住（2026-10-31 群里：「明明点了更换，咋还是换不了」）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("GlassCard：卡自己铺了图就不叠底图", () => {
  assert.match(src, /\.\.\.\(style && \/url\\\(\/\.test\(String\(style\.backgroundImage \|\| ""\)\) \? \{\} : \(t\.homeWidgetGroundStyle/);
});
