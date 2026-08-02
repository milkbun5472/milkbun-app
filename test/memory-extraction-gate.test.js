const test = require("node:test");
const assert = require("node:assert/strict");
const { inspect, normalizeEvidence } = require("../js/memory-extraction-gate.js");

const messages = [
  { mid: "u1", role: "user", content: "我下周五要去温哥华。" },
  { mid: "a1", role: "assistant", content: "好，我答应你到机场接你。" }
];

test("逐字证据成立且建议 accept 的事实可进入正式记忆", () => {
  const result = inspect({
    text: "Lisa 下周五要去温哥华",
    kind: "fact",
    proposed_action: "accept",
    evidence_message_ids: ["u1"],
    evidence_quotes: ["下周五要去温哥华"]
  }, messages);
  assert.equal(result.formal, true);
});

test("证据 ID、数组和逐字引文任一不成立都拒绝正式入库", () => {
  assert.equal(inspect({
    text: "错误事实", kind: "fact", proposed_action: "accept",
    evidence_message_ids: ["missing"], evidence_quotes: ["错误事实"]
  }, messages).formal, false);
  assert.equal(inspect({
    text: "错误事实", kind: "fact", proposed_action: "accept",
    evidence_message_ids: ["u1"], evidence_quotes: []
  }, messages).formal, false);
  assert.equal(inspect({
    text: "错误事实", kind: "fact", proposed_action: "accept",
    evidence_message_ids: ["u1"], evidence_quotes: ["从没说过"]
  }, messages).formal, false);
});

test("日常温度和 candidate 不升格成正式记忆", () => {
  assert.equal(inspect({
    text: "两人今天随口说了句好甜",
    kind: "temperature",
    proposed_action: "candidate",
    evidence_message_ids: ["a1"],
    evidence_quotes: ["好"]
  }, messages).formal, false);
  assert.equal(inspect({
    text: "Lisa 下周五要去温哥华",
    kind: "fact",
    proposed_action: "candidate",
    evidence_message_ids: ["u1"],
    evidence_quotes: ["下周五要去温哥华"]
  }, messages).formal, false);
});

test("明确承诺或关系里程碑不会因误标 temperature 被漏掉", () => {
  const result = inspect({
    text: "他答应 Lisa 到机场接她",
    kind: "temperature",
    proposed_action: "candidate",
    evidence_message_ids: ["a1"],
    evidence_quotes: ["我答应你到机场接你"]
  }, messages);
  assert.equal(result.formal, true);
  assert.equal(result.kind, "relationship");
  assert.equal(result.milestone, true);
});

test("消息 ID 抄坏但逐字引文唯一命中时可机械纠正", () => {
  const candidate = {
    text: "Lisa 下周五要去温哥华", kind: "fact", proposed_action: "accept",
    evidence_message_ids: ["模型抄坏的ID"], evidence_quotes: ["下周五要去温哥华"]
  };
  const fixed = normalizeEvidence(candidate, messages);
  assert.deepEqual(fixed.evidence_message_ids, ["u1"]);
  assert.equal(inspect(candidate, messages).formal, true);
});

test("逐字引文命中多条消息时绝不猜归属", () => {
  const ambiguousMessages = messages.concat({ mid: "u2", role: "user", content: "对，我下周五要去温哥华。" });
  const candidate = {
    text: "Lisa 下周五要去温哥华", kind: "fact", proposed_action: "accept",
    evidence_message_ids: ["坏ID"], evidence_quotes: ["下周五要去温哥华"]
  };
  assert.deepEqual(normalizeEvidence(candidate, ambiguousMessages).evidence_message_ids, ["坏ID"]);
  assert.equal(inspect(candidate, ambiguousMessages).formal, false);
});
