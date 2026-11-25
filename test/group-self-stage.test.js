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
test("动描关着的群：不挪进动描，就地收进（）（她 2026-11-25）", () => {
  const r = G.split(["呵", "我靠在偏殿软阁的紫檀椅背上，转着手里的墨玉扳指，看着屏幕上这几人的你来我往，唇边泛起一丝笑意。", "省得他天天在京城里野得没边"], { group: true });
  assert.equal(r.acts.length, 0);
  assert.deepEqual(r.words, ["呵", "（我靠在偏殿软阁的紫檀椅背上，转着手里的墨玉扳指，看着屏幕上这几人的你来我往，唇边泛起一丝笑意。）", "省得他天天在京城里野得没边"]);
  assert.deepEqual(G.split(["我坐在地铁上，等会儿到"], { group: true }).words, ["我坐在地铁上，等会儿到"], "像在说话的不动");
});
