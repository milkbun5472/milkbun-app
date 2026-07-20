const test = require("node:test");
const assert = require("node:assert/strict");
const Material = require("../js/ambient-material.js");

test("动态素材按时间混合私聊、单人线下、所在群聊和群线下", () => {
  const rows = Material.collect("a", {
    chats: { a: [{ role: "user", content: "私聊", ts: 1 }] },
    offlines: { a: [{ msgs: [{ role: "char", content: "线下", ts: 2 }] }] },
    groups: [{ id: "g1", name: "朋友们", memberIds: ["a", "b"] }],
    groupChats: { g1: [{ role: "user", content: "群里说", ts: 3 }] },
    groupOfflines: { g1: [{ msgs: [{ role: "assistant", senderName: "阿屿", content: "一起吃饭", ts: 4 }] }] }
  }, { userName: "Lisa", charName: "阿屿" });
  assert.deepEqual(rows.map(x => x.text), ["私聊", "线下", "群里说", "一起吃饭"]);
  assert.match(Material.format(rows), /【群线下·朋友们】阿屿：一起吃饭/);
});

test("不在场的群、OOC、系统消息和截止时间之前的内容不进素材", () => {
  const rows = Material.collect("a", {
    chats: { a: [{ role: "user", content: "太旧", ts: 1 }, { role: "user", kind: "ooc", content: "场外", ts: 5 }] },
    groups: [{ id: "g2", memberIds: ["b"] }],
    groupChats: { g2: [{ role: "user", content: "不在场", ts: 6 }] },
    offlines: { a: [{ msgs: [{ role: "system", content: "系统", ts: 7 }, { role: "user", content: "可用", ts: 8 }] }] }
  }, { sinceTs: 4 });
  assert.deepEqual(rows.map(x => x.text), ["可用"]);
});
