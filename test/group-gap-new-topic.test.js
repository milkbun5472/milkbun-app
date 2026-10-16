const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
// 她 2026-10-16：群里自己聊过了上限没聊完，过了一天再接话还是强行从上次那里接
test("隔了三小时以上：没开时间感知也说翻篇；自己聊那一轮不再逼他们顺着上一段硬接", () => {
  assert.match(app, /const gTopicHint = \(!_gClockNames\.length && _ggap > 3 \* 3600000\)/);
  assert.match(app, /gTimeHint \+ gTopicHint \+/);
  assert.match(app, /\(_ggap > 3 \* 3600000\s*\n?\s*\? "不过上一段已经停了很久/);
});
