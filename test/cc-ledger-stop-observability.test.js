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

test("Stop hook 不再补投 outbox，独立推手负责确认后移票", () => {
  const source = fs.readFileSync(hook, "utf8");
  const flush = source.match(/async function flushOutbox\(\) \{([^}]*)\}/);
  assert.ok(flush, "找不到 outbox 的 Stop hook 入口");
  assert.equal(flush[1].replace(/\/\*[\s\S]*?\*\//g, "").trim(), "", "Stop hook 不能恢复网络补投");
  const push = fs.readFileSync(path.join(__dirname, "../scripts/cc-ledger-push.mjs"), "utf8");
  assert.match(push, /body: lines\.join\("\\n"\) \+ "\\n"/, "推手发送完整批次，不只发送首票");
  const confirmed = push.indexOf("if (!r.ok) throw");
  const remove = push.indexOf('writeFileSync(OUTBOX + ".tmp", rest)');
  assert.ok(confirmed > 0 && remove > confirmed, "确认收下之后才能移除本地票");
  assert.match(push, /const rest = now\.startsWith\(raw\) \? now\.slice\(raw\.length\) : now;/, "投递期间新增的票必须留下");
});
