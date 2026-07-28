const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "../js/screens.js"), "utf8");

test("时间、低召回和情绪变淡不能批量关闭 open", () => {
  assert.equal(app.includes("autoClosedTs"), false);
  assert.equal(app.includes("staleOpenLoops"), false);
  assert.equal(app.includes("reviewOpenLoops"), false);
});

test("设置页明确告诉用户 open 只能凭真实解决，而非时间降级", () => {
  assert.ok(screens.includes("时间过去、想起变少或情绪缓和都不算解决"));
  assert.equal(screens.includes("陈年开环降级"), false);
});

test("群线下批量直写也必须经过统一开环资格闸", () => {
  assert.match(app, /群线下是批量直写[\s\S]{0,180}OpenLoopGate\.normalize\(entry\)/);
});
