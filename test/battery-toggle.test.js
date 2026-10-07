const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
test("右上角电池能关：设置里一格，存 x_hideBattery，当场生效", () => {
  assert.match(app, /hideBat \? null : h\("span"/);
  assert.match(app, /window\.addEventListener\("x-battery", on\)/);
  assert.match(scr, /title: "右上角电池"/);
  assert.match(scr, /localStorage\.setItem\("x_hideBattery", off \? "0" : "1"\)/);
});
