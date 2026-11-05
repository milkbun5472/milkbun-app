// 旁观群的回声带进单聊时标明她不在那个群（她 2026-11-04：TA 心里嘀咕「她能看到群消息的吧」）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
test("回声标签和说明", () => {
  assert.match(R("app.js"), /surface: "群「" \+ g\.name \+ "」" \+ \(groupSpectating\(g\) \? "·她不在这个群里" : ""\)/);
  assert.match(R("engine.js"), /标着「她不在这个群里」的那几个群，她不是成员、看不到里面说了什么/);
});
