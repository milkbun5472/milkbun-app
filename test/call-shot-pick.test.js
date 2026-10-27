const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("群视频拍画面能挑拍谁，还是一次一张（她 2026-10-27）", () => {
  assert.match(c, /"data-wk": "callshotpick"/);
  assert.match(c, /if \(shotCands\.length > 1\) \{ setShotSel/);
  assert.match(c, /onShot\(shotSel\.slice\(\)\)/);
  assert.match(app, /const runCallShot = async ids => \{/);
  assert.match(app, /p\.refPhoto && \(!pickIds \|\| pickIds\.includes\(String\(p\.id\)\)\)/);
});
