// 群友 2026-11-26 许愿：一起听界面实时记录听了多久
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), su = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
test("一起听：放着歌才计时，换人清零，界面上写着", () => {
  assert.match(ap, /togetherMs: \(Number\(p\.togetherMs\) \|\| 0\) \+ 30000/);
  assert.match(ap, /charId !== p\.partnerId \? \{ togetherMs: 0 \}/);
  assert.match(su, /"data-wk": "listentogether"/);
});
