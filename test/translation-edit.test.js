const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("译文开头一串省略号、原文没有：画的时候剥掉（群友 2026-10-26）", () => {
  const i = comp.indexOf("  // 译文前头挂一串省略号"), line = comp.slice(comp.indexOf("\n", i) + 1, comp.indexOf("\n", comp.indexOf("\n", i) + 1));
  const run = (text, zhReady) => { eval(line); return zhReady; };
  assert.equal(run("I'll come get you", "…发位置去接你"), "发位置去接你");
  assert.equal(run("I'll come get you", "...发位置去接你"), "发位置去接你");
  assert.equal(run("...well", "……嗯"), "……嗯");
});
test("编辑消息能改译文，单聊群聊都接上；清空就去掉", () => {
  assert.match(comp, /function MsgEditSheet\(\{ init, zh, onCancel, onSave \}\)/);
  assert.match(comp, /onSave\(txt, zh != null \? zt : undefined\)/);
  assert.equal((app.match(/zh: m\.zh != null \? String\(m\.zh\) : undefined, onSave: \(nv, nz\)/g) || []).length, 2);
  assert.match(app, /zh: editMsg\.zh,/);
});
