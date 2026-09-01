"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

function load() {
  const previous = global.window;
  global.window = {};
  delete require.cache[require.resolve("../js/memory-v2-shadow.js")];
  require("../js/memory-v2-shadow.js");
  const module = global.window.MemoryV2Shadow;
  global.window = previous;
  return module;
}

test("四类原语把短期状态和人格假设挡在长期记忆之外", () => {
  const M = load();
  assert.deepEqual(M.PRIMITIVES, ["episode", "claim", "state", "hypothesis"]);
  assert.equal(M.routeCandidate({ kind: "temperature" }).primitive, "state");
  assert.equal(M.routeCandidate({ kind: "insight" }).primitive, "hypothesis");
  assert.equal(M.routeCandidate({ kind: "promise" }).primitive, "claim");
  assert.equal(M.routeCandidate({ kind: "fact", tags: ["重要事件"] }).primitive, "episode");
});

test("统一证据闸要求消息存在且引文逐字命中", () => {
  const M = load();
  const messages = [{ id: "m1", content: "今晚我会来接你。" }];
  const valid = { kind: "promise", text: "今晚会来接我", evidence_message_ids: ["m1"], evidence_quotes: ["我会来接你"] };
  const invalid = { ...valid, evidence_quotes: ["明天会来"] };
  assert.equal(M.inspectCandidate(valid, messages, [], { branchValid: true }).decision, "admit");
  assert.equal(M.inspectCandidate(invalid, messages, [], { branchValid: true }).decision, "reject");
  assert.deepEqual(M.inspectCandidate(invalid, messages, [], { branchValid: true }).reasons, ["quote_mismatch"]);
});

test("状态只进 TTL 状态层，洞察只进待评审层", () => {
  const M = load();
  const messages = [{ id: "m1", content: "我今天有点累。" }];
  const base = { text: "今天累", evidence_message_ids: ["m1"], evidence_quotes: ["今天有点累"] };
  assert.equal(M.inspectCandidate({ ...base, kind: "temperature" }, messages, []).decision, "state_only");
  assert.equal(M.inspectCandidate({ ...base, kind: "insight" }, messages, []).decision, "review");
});

test("上下文预算草案只按原块顺序计量，不重排也不改正文", () => {
  const M = load();
  const parts = ["【角色人设】\n" + "甲".repeat(100), "【最近对话】\n" + "乙".repeat(100)];
  const plan = M.planComposition(parts, 120);
  assert.equal(plan.orderPreserved, true);
  assert.deepEqual(plan.blocks.map(row => row.index), [0, 1]);
  assert.equal(parts[0].endsWith("甲".repeat(100)), true);
  assert.equal(plan.pressure, true);
});

test("召回收据只留 hash 与计数，不落 query 或正文", () => {
  const M = load();
  const entry = { id: "secret-id", text: "不能写进审计的正文", pinned: true, open: true };
  const receipt = M.makeRetrievalReceipt({ charId: "c1", queryText: "你记得我什么时候说的吗", source: "chat", pinned: [entry], relevant: [], picked: [entry] });
  const serialized = JSON.stringify(receipt);
  assert.equal(receipt.mode, "precise");
  assert.equal(receipt.pinnedSelectedCount, 1);
  assert.equal(receipt.openSelectedCount, 1);
  assert.doesNotMatch(serialized, /secret-id|不能写进审计|什么时候/);
});

test("影子模块接在最终召回、抽取与上下文入口，且统一进入审计", () => {
  const app = fs.readFileSync("js/app.js", "utf8");
  const engine = fs.readFileSync("js/engine.js", "utf8");
  const review = fs.readFileSync("js/shadow-review.js", "utf8");
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(app, /MemoryV2Shadow\.observeExtraction/);
  assert.match(engine, /MemoryV2Shadow\.observeRetrieval/);
  assert.match(engine, /空召回也是重要收据/);
  assert.match(engine, /MemoryV2Shadow\.observeComposition/);
  assert.match(review, /memoryV2:\s*window\.MemoryV2Shadow/);
  assert.match(html, /memory-v2-shadow\.js\?v=\d{2,3}\.\d{2,3}/);
});
