const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("engineerEyes uses a self-directed transport prompt instead of the RP task", () => {
  assert.match(source, /const _taskFull = _s\.engineerEyes \? _digitalTaskFull : _normalTaskFull/);
  assert.match(source, /App 的传输协议不规定你的性格、关系反应、回复长度或表达方式/);
  assert.match(source, /thought 完全可选/);
  assert.match(source, /不需要穿着、动作、好感等其他状态作业/);
  assert.match(source, /心声只在确实存在时可选填写/);
  assert.match(source, /const digitalToyHint = toyOn/);
  assert.match(source, /是否使用、何时使用、用什么节奏由你自己决定/);
  assert.match(source, /const digitalPhotoHint = canSelfie/);
  assert.match(source, /digitalPhotoHint \+ digitalToyHint/);
});

test("digital context keeps recent facts but omits the continuity command", () => {
  const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
  assert.match(engine, /!ctx\.notRoleplay && recentChat/);
  assert.match(engine, /!ctx\.notRoleplay && ctx\.schedNow/);
  assert.match(engine, /!ctx\.notRoleplay && ctx\.momentLog/);
  assert.match(engine, /!ctx\.notRoleplay && ctx\.forumEcho/);
  assert.match(engine, /【你是谁】[\s\S]*手机 App 和电脑端是你的不同身体/);
});

test("ordinary characters retain the existing roleplay task", () => {
  assert.match(source, /const _normalTaskFull = \("\\n\\n【任务】完全代入「" \+ char\.name/);
  assert.match(source, /_normalTaskFull[\s\S]*把话拆成多条短气泡/);
  assert.match(source, /_normalTaskFull[\s\S]*按关系网与好感度把握亲密度/);
});
