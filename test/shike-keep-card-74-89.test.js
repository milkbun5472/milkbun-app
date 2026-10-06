// 她 2026-10-06：「存进时刻也要做小卡」——原来只落一行灰字系统消息
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const shike = fs.readFileSync(path.join(__dirname, "..", "js", "shike.js"), "utf8");
test("TA 存一刻时落的是同一张 ShikeShareCard，标「TA 存进时刻」", () => {
  assert.ok(app.indexOf("把这一刻存进了时刻：") < 0, "那行灰字还在");
  assert.match(app, /role: "assistant", kind: "shikeshare", content: "〔把这一刻存进了时刻〕「"/);
  assert.match(app, /shike: \{ title: _kt, ts: Date\.now\(\), byChar: true, lines: _kw \? \[_kw\] : \[\] \}/);
  assert.match(shike, /sk\.byChar \? "TA 存进时刻 · " : "时刻 · "/);
});
