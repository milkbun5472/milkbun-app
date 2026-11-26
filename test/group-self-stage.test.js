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
test("动描里写「你来我往」这种成语、明摆着是舞台说明的，不当台词挪回气泡（她 2026-11-25）", () => {
  assert.equal(G.spokenAction("我靠在偏殿软阁的紫檀椅背上，转着手里的墨玉扳指，看着屏幕上这几人的你来我往，唇边泛起一丝笑意。"), false);
  assert.equal(G.spokenAction("低头看着两人你一言我一语地斗嘴"), false);
  assert.equal(G.spokenAction("你过来一下"), true, "真对着人说的照旧挪回");
  assert.equal(G.spokenAction("要不送你抱回家练臂力"), true);
});
