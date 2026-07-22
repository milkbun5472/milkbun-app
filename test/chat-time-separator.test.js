const test = require("node:test");
const assert = require("node:assert/strict");
const Time = require("../js/chat-time-separator.js");

test("跨日和同日长断档显示，连续聊天不刷时间条", () => {
  const t = new Date(2026, 6, 21, 23, 30).getTime();
  assert.equal(Time.shouldShow({ ts: t }, { ts: new Date(2026, 6, 22, 20, 13).getTime() }), true);
  assert.equal(Time.shouldShow({ ts: t }, { ts: t + 31 * 60000 }), true);
  assert.equal(Time.shouldShow({ ts: t }, { ts: t + 5 * 60000 }), false);
  assert.equal(Time.shouldShow({ ts: t, turnId: "x" }, { ts: t + 31 * 60000, turnId: "x" }), false);
});

test("时间标签区分今天、昨天和更早日期", () => {
  const now = new Date(2026, 6, 22, 20, 14).getTime();
  assert.equal(Time.label(new Date(2026, 6, 22, 20, 13).getTime(), now), "20:13");
  assert.equal(Time.label(new Date(2026, 6, 21, 23, 30).getTime(), now), "昨天 23:30");
  assert.equal(Time.label(new Date(2026, 6, 3, 8, 5).getTime(), now), "7月3日 08:05");
});
