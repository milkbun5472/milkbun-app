const test = require("node:test");
const assert = require("node:assert/strict");
const BG = require("../js/background-generation.js");

test("后台任务离开订阅者后仍完成，重进可读取结果", async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let notices = 0;
  const off = BG.subscribe("fanfic:test", () => { notices += 1; });
  const p = BG.start("fanfic:test", { label: "同人文生成中" }, async () => { await gate; return ["完成"]; });
  off(); // 模拟离开页面
  assert.equal(BG.state("fanfic:test").busy, true);
  release();
  await p;
  assert.equal(BG.state("fanfic:test").status, "done");
  assert.deepEqual(BG.state("fanfic:test").result, ["完成"]);
  assert.ok(notices >= 1);
});

test("同一 key 运行中重复启动只执行一次", async () => {
  let calls = 0;
  const first = BG.start("fanfic:dedupe", {}, async () => { calls += 1; return "ok"; });
  const second = BG.start("fanfic:dedupe", {}, async () => { calls += 1; return "duplicate"; });
  assert.equal(first, second);
  assert.equal(await second, "ok");
  assert.equal(calls, 1);
});
