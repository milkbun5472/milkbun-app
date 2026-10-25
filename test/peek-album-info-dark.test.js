const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const ui = fs.readFileSync(__dirname + "/../js/phone-ui.js", "utf8");
test("查手机相册详情：白字底下自己垫黑，美化把整页换浅色也看得清（群里 2026-10-26）", () => {
  assert.match(ui, /"data-wk": "palbuminfo", style: \{ padding: "20px 20px 30px", background: "#000", color: "#fff" \}/);
  assert.match(fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8"), /"palbuminfo"/);
});
