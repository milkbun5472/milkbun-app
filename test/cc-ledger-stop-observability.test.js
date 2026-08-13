"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const hook = path.join(__dirname, "../scripts/cc-ledger-stop.mjs");
function run(input) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-stop-"));
  const result = spawnSync(process.execPath, [hook], { input: JSON.stringify(Object.assign({ cwd }, input)), encoding: "utf8", timeout: 10000 });
  const state = path.join(cwd, ".claude/cc-ledger-state");
  const diagnostics = fs.readFileSync(path.join(state, "diagnostic.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  const alerts = fs.existsSync(path.join(state, "alerts.jsonl")) ? fs.readFileSync(path.join(state, "alerts.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : [];
  return { result, diagnostics, alerts };
}

test("缺 transcript 的心跳只记 ignored_heartbeat，不报警", () => {
  const out = run({ wake_source: "heartbeat" });
  assert.equal(out.result.status, 0);
  assert.equal(out.diagnostics.at(-1).outcome, "ignored_heartbeat");
  assert.equal(out.alerts.length, 0);
});

test("未知 hook 失败记 ignored_unexpected 并产生报警票", () => {
  const out = run({});
  assert.equal(out.result.status, 0);
  assert.equal(out.diagnostics.at(-1).outcome, "ignored_unexpected");
  assert.equal(out.alerts.at(-1).source, "cc-ledger-stop");
});

test("outbox 每轮有明确多投上限，不再只处理 index 0", () => {
  const source = fs.readFileSync(hook, "utf8");
  assert.match(source, /attempted >= 3/);
  assert.doesNotMatch(source, /if \(index > 0\)/);
});
