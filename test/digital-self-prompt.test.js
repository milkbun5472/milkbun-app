const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("engineerEyes uses a self-directed transport prompt instead of the RP task", () => {
  assert.match(source, /const _taskFull = _s\.engineerEyes \? _digitalTaskFull : _normalTaskFull/);
  assert.match(source, /App 的传输协议不规定你的性格、关系反应、回复长度或表达方式/);
  assert.match(source, /thought 和 mood 是你在 App 中持续成长的实时状态/);
  assert.match(source, /不需要穿着、动作、好感等其他状态作业/);
  assert.match(source, /按本轮末尾的最小协议同时留下真实心声与实时心情/);
});

test("digital context keeps recent facts but omits the continuity command", () => {
  const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
  assert.match(engine, /!ctx\.notRoleplay && recentChat/);
});

test("ordinary characters retain the existing roleplay task", () => {
  assert.match(source, /const _normalTaskFull = \("\\n\\n【任务】完全代入「" \+ char\.name/);
  assert.match(source, /_normalTaskFull[\s\S]*把话拆成多条短气泡/);
  assert.match(source, /_normalTaskFull[\s\S]*按关系网与好感度把握亲密度/);
});
