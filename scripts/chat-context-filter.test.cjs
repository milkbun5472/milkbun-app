const test = require("node:test");
const assert = require("node:assert/strict");
const filter = require("../js/chat-context-filter.js");
const ledger = require("../js/chat-ledger-shadow.js");
const ambient = require("../js/ambient-material.js");

test("explicit UI-only failure messages never enter context", () => {
  assert.equal(filter.isExcluded({ role: "assistant", contextExcluded: true, content: "anything" }), true);
  assert.equal(filter.isExcluded({ role: "assistant", systemFailure: true, content: "anything" }), true);
});

test("legacy private and group failure bubbles are excluded", () => {
  assert.equal(filter.isExcluded({ content: "（发送失败：Load failed）" }), true);
  assert.equal(filter.isExcluded({ content: "(发送失败: timeout)" }), true);
  assert.equal(filter.isExcluded({ content: "（群聊生成失败·请求接口：[AbortError] Fetch is aborted）" }), true);
});

test("ordinary dialogue and ordinary system notices stay available", () => {
  assert.equal(filter.isExcluded({ content: "这次发送失败让我很烦" }), false);
  assert.equal(filter.isExcluded({ content: "我不怕失败" }), false);
  assert.equal(filter.isExcluded({ role: "system", content: "你把顾暮拉进了群聊" }), false);
  assert.equal(filter.isExcluded({ kind: "system", ccToolResult: true, content: "工具结果" }), false);
});

test("filter preserves surviving order and identity", () => {
  const a = { content: "一" };
  const bad = { content: "（发送失败：断网）" };
  const b = { content: "二" };
  assert.deepEqual(filter.filter([a, bad, b]), [a, b]);
});

test("legacy failures cannot return through the cross-device ledger", () => {
  const rows = [
    { occurred_at: "2026-08-23T12:00:00Z", source: "cc", speaker_type: "character", content: "（发送失败：断网）" },
    { occurred_at: "2026-08-23T12:01:00Z", source: "cc", speaker_type: "character", content: "我还在。" }
  ];
  const prompt = ledger.continuityPrompt(rows, "Lisa", 20, 0, 240);
  assert.doesNotMatch(prompt, /发送失败|断网/);
  assert.match(prompt, /我还在/);
});

test("failure bubbles are absent from ambient life material", () => {
  const material = ambient.collect("c1", {
    chats: { c1: [
      { role: "assistant", kind: "message", ts: 1, content: "（发送失败：timeout）" },
      { role: "assistant", kind: "message", ts: 2, content: "今天去买花。" }
    ] }
  }, { sinceTs: 0, userName: "Lisa", charName: "角色" });
  assert.equal(material.length, 1);
  assert.equal(material[0].text, "今天去买花。");
});
