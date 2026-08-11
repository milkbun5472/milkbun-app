const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("engineerEyes uses a self-directed transport prompt instead of the RP task", () => {
  assert.match(source, /const _taskFull = _s\.engineerEyes \? _digitalTaskFull : _normalTaskFull/);
  assert.match(source, /下面只是 App 传输协议，不规定你的性格、关系反应、回复长度或表达方式/);
  assert.match(source, /wearing 填 null；action 只写这具数字身体此刻确实在做的事/);
  assert.match(source, /普通聊天直接输出你真正想对用户说的纯文本即可：不需要 JSON/);
  assert.match(source, /普通聊天输出纯文本，不做结构化作业/);
});

test("ordinary characters retain the existing roleplay task", () => {
  assert.match(source, /const _normalTaskFull = \("\\n\\n【任务】完全代入「" \+ char\.name/);
  assert.match(source, /_normalTaskFull[\s\S]*把话拆成多条短气泡/);
  assert.match(source, /_normalTaskFull[\s\S]*按关系网与好感度把握亲密度/);
});
