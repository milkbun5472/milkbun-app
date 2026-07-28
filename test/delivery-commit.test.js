const test = require("node:test");
const assert = require("node:assert/strict");
const { afterDelivered, once } = require("../js/delivery-commit.js");

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

test("同类主动任务发送中只允许一条，完成后释放占位", async () => {
  let release;
  let sends = 0;
  const first = once("greeting:today:morning", async () => {
    sends += 1;
    await new Promise(resolve => { release = resolve; });
    return true;
  }, () => {});
  await new Promise(resolve => setImmediate(resolve));

  const duplicate = await once("greeting:today:morning", async () => {
    sends += 1;
    return true;
  }, () => {});
  assert.equal(duplicate, false);
  assert.equal(sends, 1);

  release();
  assert.equal(await first, true);
  assert.equal(await once("greeting:today:morning", async () => true, () => {}), true);
});
