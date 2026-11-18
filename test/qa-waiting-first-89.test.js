// 群友 2026-11-18：问答小本「最新出的题在最前面，方便答题」「回答完再按顺序排」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ui = fs.readFileSync(path.resolve(__dirname, "..", "js/screens-ui.js"), "utf8");
test("等你写的排最前（新的在前），答完的按答完那一刻从早到晚", () => {
  const src = ui.match(/const qaWaiting = [^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n/)[0];
  const sortOf = new Function("entries", "partner", src + "return all;");
  const E = [
    { id: "a", characterId: 1, myAnswer: "x", answeredAt: 10 },
    { id: "w1", characterId: 1, sealed: true, byCharacter: true, answeredAt: 20 },
    { id: "b", characterId: 1, myAnswer: "y", answeredAt: 5, openedAt: 30 },
    { id: "w2", characterId: 1, sealed: true, byCharacter: true, answeredAt: 40 }
  ];
  assert.deepEqual(sortOf(E, { id: 1 }).map(e => e.id), ["w2", "w1", "a", "b"]);
});
test("揭开以后翻到它落下的那一页（最后一页）", () => {
  assert.match(ui, /onReveal\(e\.id, revealDraft\.text\)\) \{ setRevealDraft\(\{ id: "", text: "" \}\); setPageIdx\(9999\); \}/);
});
