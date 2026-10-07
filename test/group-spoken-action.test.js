const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const G = require("../js/bubble-act-guard.js");

test("动描里写的台词认得出来", () => {
  assert.ok(G.spokenAction("要不送你抱回家练臂力"));
  assert.ok(G.spokenAction("真的假的？"));
  assert.ok(G.spokenAction("走了啊"));
});

test("真的动作照旧是动描", () => {
  assert.ok(!G.spokenAction("我靠在门边刷手机"));
  assert.ok(!G.spokenAction("我把箱子往地上一放"));
  assert.ok(!G.spokenAction(""));
});

test("群聊把台词挪回气泡、不摆动描", () => {
  const src = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
  const at = src.indexOf("const gRescuedActs = _gGuard.acts;");
  const seg = src.slice(at, src.indexOf("const gThought =", at));
  assert.match(seg, /spokenAction\(_rawGAction\)/);
  assert.match(seg, /gBubbles = \[_said, \.\.\.gBubbles\]/);
  assert.match(seg, /gActionNow = ""/);
});
