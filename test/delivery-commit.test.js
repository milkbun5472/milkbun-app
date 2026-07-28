const test = require("node:test");
const assert = require("node:assert/strict");
const { afterDelivered } = require("../js/delivery-commit.js");

test("delivered=true 后才提交已发戳", async () => {
  let commits = 0;
  const ok = await afterDelivered(async () => true, () => { commits += 1; });
  assert.equal(ok, true);
  assert.equal(commits, 1);
});

test("发送被闸拦住时不提交已发戳", async () => {
  let commits = 0;
  const ok = await afterDelivered(async () => false, () => { commits += 1; });
  assert.equal(ok, false);
  assert.equal(commits, 0);
});

test("发送异常时不提交已发戳且不制造未处理拒绝", async () => {
  let commits = 0;
  const ok = await afterDelivered(async () => { throw new Error("network"); }, () => { commits += 1; });
  assert.equal(ok, false);
  assert.equal(commits, 0);
});
