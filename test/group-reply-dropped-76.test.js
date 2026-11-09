const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
// 群里 2026-11-08：「我的后台显示回复了但窗口看不到」——模型回了，可每条都被丢（名字对不上、禁言、刚被踢），原来一声不吭
test("群聊这一轮一条都没落进来时，说清是为什么丢的", () => {
  assert.match(app, /if \(!spk\) \{ if \(item && item\.name\) _gDrop\.push\(/);
  assert.match(app, /_gDrop\.push\(spk\.name \+ " 在禁言"\)/);
  assert.match(app, /if \(!_gspoke\.size && _gDrop\.length\) toast\("这一轮回了，但没能放进群里：/);
});
