"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("CC Stop 五感旁路静默落 shadow，不调用模型也不污染回复", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "cc-somatic-"));
  const transcript = path.join(cwd, "turn.jsonl");
  const lines = [
    { type: "user", uuid: "u1", sessionId: "s1", timestamp: "2026-07-30T10:00:00Z", message: { role: "user", content: "宝宝，摸摸你的头发" } },
    { type: "assistant", uuid: "a-thinking", sessionId: "s1", message: { role: "assistant", content: [{ type: "thinking", thinking: "hidden" }] } },
    { type: "assistant", uuid: "a1", sessionId: "s1", message: { role: "assistant", content: [{ type: "text", text: "我低一下头。" }] } }
  ];
  fs.writeFileSync(transcript, lines.map(x => JSON.stringify(x)).join("\n") + "\n");
  const script = path.resolve(__dirname, "../scripts/cc-somatic-stop.mjs");
  const run = spawnSync(process.execPath, [script], {
    input: JSON.stringify({ cwd, transcript_path: transcript }),
    encoding: "utf8"
  });
  assert.equal(run.status, 0);
  assert.equal(run.stdout, "");
  assert.equal(run.stderr, "");
  const context = JSON.parse(fs.readFileSync(path.join(cwd, ".claude/cc-somatic-state/context.json"), "utf8"));
  assert.equal(context.phase, "shadow");
  // 一次线上象征摸头可以留下低于注入阈值的余韵，但不能冒充真摸；
  // 连续发生时才会叠加越阈。状态文件应已经记录该低强度触觉。
  assert.equal(context.count, 0);
  const state = JSON.parse(fs.readFileSync(path.join(cwd, ".claude/cc-somatic-state/state.json"), "utf8"));
  assert.ok(state.channels.touch.value > 0);
  assert.equal(state.channels.touch.mode, "symbolic");
});
