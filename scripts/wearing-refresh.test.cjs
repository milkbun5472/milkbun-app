const test = require("node:test");
const assert = require("node:assert/strict");
const WearingRefresh = require("../js/wearing-refresh.js");

test("schedule slot change requires a refresh", () => {
  const breakfast = WearingRefresh.scheduleKey({ time: "07:00", title: "早餐", location: "家里" }, "2026-08-23");
  const outing = WearingRefresh.scheduleKey({ time: "10:00", title: "出门办事", location: "市中心" }, "2026-08-23");
  assert.equal(WearingRefresh.evaluate({ scheduleKey: breakfast, acknowledgedKey: breakfast, hasWearing: true }).required, false);
  const gate = WearingRefresh.evaluate({ scheduleKey: outing, acknowledgedKey: breakfast, hasWearing: true });
  assert.equal(gate.required, true);
  assert.equal(gate.reason, "行程已切换");
});

test("explicit activity intent refreshes wearing without a schedule change", () => {
  const gate = WearingRefresh.evaluate({ scheduleKey: "same", acknowledgedKey: "same", hasWearing: true, latestUserText: "那你快去洗澡吧" });
  assert.equal(gate.required, true);
  assert.equal(gate.intent, "洗澡");
});

test("old anecdotes do not trigger a current clothing refresh", () => {
  assert.equal(WearingRefresh.intentReason("上次去健身的时候可累了"), "");
});

test("pending refresh stays sticky until wearing is returned", () => {
  const gate = WearingRefresh.evaluate({ scheduleKey: "same", acknowledgedKey: "same", hasWearing: true, pending: true });
  assert.equal(gate.required, true);
  assert.equal(gate.reason, "上轮换装刷新尚未完成");
});
