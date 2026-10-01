// 去处：不只他家和常去，地图上的地点、自己写的地方都能去（群友 2026-10-01）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const d = fs.readFileSync(path.join(__dirname, "..", "js", "dwell.js"), "utf8");

test("TA钉在架空世界里时，那张图上的地点都列出来，点了就写那一处", () => {
  assert.match(d, /window\.MapKit\.charRealm\(char, worlds\)/);
  assert.match(d, /realm\.kind === "world"/);
  assert.match(d, /"地图上的地方"/);
  assert.match(d, /onClick: function \(\) \{ gen\(m\.name, null\); \}/);
});

test("留一格自己写地方，写了名字就去", () => {
  assert.match(d, /"＋ 自己写一个地方"/);
  assert.match(d, /if \(nm\) gen\(nm, null\);/);
});

test("写地方的提示不再假定一定是行程里来的", () => {
  assert.doesNotMatch(d, /他行程里常出现的那个地方。"\)/);
});
