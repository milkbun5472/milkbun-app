const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const app = fs.readFileSync(require("node:path").join(__dirname, "../js/app.js"), "utf8");
const start = app.indexOf("  const saveExtractedGroupMemories =");
const code = app.slice(start, app.indexOf("\n  };", start) + 5);
const gate = require("../js/memory-extraction-gate.js");
function setup(interop = true) {
  const members = [{ id: "a", name: "甲" }, { id: "n", name: "配角", npc: true }];
  const ref = { current: [] };
  const ctx = {
    gsFor: () => ({ memoryInterop: interop }), memLibRef: ref,
    memOwners: ids => ids.filter(id => members.some(m => m.id === id && !m.npc)),
    uniqMemId: (ts, i) => ts + "_" + i,
    clampInt: (v, min, max, fallback) => Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback,
    isDupMem: (text, ids, batch) => (batch || ref.current).some(e => e.text === text),
    pruneSubsumed: list => list, saveMemLib: list => { ref.current = list; },
    window: { OpenLoopGate: require("../js/open-loop-gate.js") }
  };
  vm.createContext(ctx);
  vm.runInContext(code + "\nthis.save = saveExtractedGroupMemories;", ctx);
  return { ctx, ref, members, group: { id: "g", memberIds: ["a", "n"] } };
}
for (const tags of [["群聊", "测试群"], ["线下", "群聊"]]) {
  test(tags.join("/") + "共用归属、证据、去重和开环落库", () => {
    const { ctx, ref, members, group } = setup();
    // 群线上写 mid，群线下写 id；两种都由实际证据 ID 规则识别。
    const messages = [
      { role: "assistant", senderId: "a", senderName: "甲", mid: "online_1", content: "我喜欢散步", ts: 1 },
      { role: "assistant", senderId: "a", senderName: "甲", id: "offline_2", content: "一起去公园", ts: 2 }
    ];
    const items = [
      { text: "甲喜欢散步", who: ["甲", "配角"], evidence_message_ids: ["wrong"], evidence_quotes: ["我喜欢散步"], open: true },
      { text: "甲喜欢散步", who: ["甲"] },
      { text: "配角的事", who: ["配角"] },
      { text: "用户的事", who: ["用户"], evidence_message_ids: [], evidence_quotes: ["一起去公园"] }
    ].map(it => gate.normalizeEvidence(it, messages));
    ctx.save(group, members, items, tags);
    const rows = JSON.parse(JSON.stringify(ref.current));
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0].charIds, ["a"]);
    assert.deepEqual(rows[0].knownBy, ["a", "n"]);
    assert.deepEqual(rows[0].evidenceMessageIds, ["online_1"]);
    assert.deepEqual(rows[1].evidenceMessageIds, ["offline_2"]);
    assert.deepEqual(rows[0].tags, tags);
    assert.equal(rows[0].groupId, "g");
    assert.equal(rows[0].open, false);
    ctx.save(group, members, items, tags);
    assert.equal(ref.current.length, 2);
  });
}
test("封闭群的公共落库入口不写全局记忆", () => {
  const { ctx, ref, members, group } = setup(false);
  ctx.save(group, members, [{ text: "不外流", who: ["甲"] }], []);
  assert.equal(ref.current.length, 0);
});
test("两条抽取路径都传入真实消息窗口并调用公共落库", () => {
  for (const name of ["maybeAutoExtractGroup", "maybeAutoExtractGroupOffline"]) {
    const start = app.indexOf("  const " + name + " =");
    const body = app.slice(start, app.indexOf("\n  };", start));
    assert.match(body, /normalizeEvidence\(it, win\)/);
    assert.match(body, /saveExtractedGroupMemories\(group, members, items,/);
    assert.doesNotMatch(body, /let entry =|const nameToId/);
    assert.match(body, /!bgActiveRef.current/);
  }
});
