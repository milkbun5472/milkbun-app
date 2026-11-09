// 动描开着的群里，「我坐在…，…着…」这种写错格子的动作挪回动作行（她 2026-11-05）
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../js/bubble-act-guard.js");
test("认得出那一个窄形状", () => {
  const r = G.split(["我坐在沙发扶手旁，手里端着刚洗好的小番茄，笑眯眯看着你们", "那太好啦^^"], { group: true, actOn: true });
  assert.deepEqual(r.acts, ["我坐在沙发扶手旁，手里端着刚洗好的小番茄，笑眯眯看着你们"]);
  assert.deepEqual(r.words, ["那太好啦^^"]);
});
test("像在说话的不动", () => {
  ["我坐在地铁上，等会儿到", "我坐在这儿等着你们呢", "我站在门口等着呢！你们快点"].forEach(w =>
    assert.equal(G.split([w], { group: true, actOn: true }).acts.length, 0, w));
});
test("动描关着的群一律不动", () => {
  assert.equal(G.split(["我坐在沙发扶手旁，手里端着刚洗好的小番茄，笑眯眯看着你们"], { group: true }).acts.length, 0);
});
