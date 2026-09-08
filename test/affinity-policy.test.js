const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
const grab = (from, to) => {
  const i = app.indexOf(from), j = app.indexOf(to, i);
  assert.ok(i > 0 && j > i, from);
  return app.slice(i, j);
};
const src = grab("  const setAff =", "  const setMoodFor =");
// 存档形状来自 setAff/saveRel 的 x_affinities[id] 数字与 x_rels[key].label 写入方。
function fixture(initial = {}, relationships = {}) {
  let state = { ...initial };
  const writes = [];
  const F = new Function("setAffinities", "saveJSON", "rels", "affinities", src +
    "\nreturn { setAff, bumpAff, affinityStep, affRebase, baseAffIn, affOf };")(
      update => { state = update(state); },
      (key, value) => writes.push({ key, value }), relationships, state);
  return { ...F, state: () => state, writes };
}

test("关系基线按存档两个方向取最高，别的角色不串入", () => {
  const f = fixture();
  assert.equal(f.baseAffIn({}, "c1"), 50);
  for (const rels of [
    { "me->c1": { label: "恋人" } },
    { "c1->me": { label: "我的恋人" } },
    { "me->c1": { label: "朋友" }, "c1->me": { label: "恋人" } },
    { "me->c1": { label: "恋人" }, "c1->me": { label: "朋友" } }
  ]) assert.equal(f.baseAffIn(rels, "c1"), 80);
  assert.equal(f.baseAffIn({ "me->c2": { label: "恋人" } }, "c1"), 50);
});
test("0、缺省与非法幅度不写盘，心情不参与好感", () => {
  const f = fixture({ c1: 61.234 });
  for (const delta of [0, null, undefined, NaN, Infinity, -Infinity, "5", {}]) {
    f.bumpAff("c1", delta, "累、烦、开心");
  }
  assert.deepEqual(f.state(), { c1: 61.234 });
  assert.equal(f.writes.length, 0);
});
test("非零幅度按 0.2 换算、正负对称、单次封顶 1", () => {
  const f = fixture();
  for (const [delta, expected] of [[1, .2], [2, .4], [5, 1], [100, 1], [.5, .1]]) {
    assert.equal(f.affinityStep(delta), expected);
    assert.equal(f.affinityStep(-delta), -expected);
  }
});
test("批量更新读取最新状态，不互相覆盖；保存三位小数", () => {
  const f = fixture({ c1: 50.123, c2: 73 });
  for (let i = 0; i < 5; i++) f.bumpAff("c1", 1);
  assert.deepEqual(f.state(), { c1: 51.123, c2: 73 });
  assert.equal(f.writes.length, 5);
  assert.equal(f.writes[4].key, "x_affinities");
  assert.deepEqual(f.writes[4].value, f.state());
});
test("未存好感从实际关系起步，封顶封底且无非法数入库", () => {
  const f = fixture({}, { "me->c1": { label: "恋人" } });
  f.bumpAff("c1", 1);
  assert.equal(f.state().c1, 80.2);
  f.setAff("c1", 99.9); f.bumpAff("c1", 5);
  assert.equal(f.state().c1, 100);
  f.setAff("c1", .1); f.bumpAff("c1", -5);
  assert.equal(f.state().c1, 0);
  f.setAff("c1", NaN); f.setAff("c1", () => Infinity);
  assert.equal(f.state().c1, 0);
});
test("手动改恋人补到 80，取消 ±12 边界，不平移额外分数", () => {
  const f = fixture();
  for (const score of [38, 49, 50, 50.2, 51, 60, 62, 63, 72, 79.9]) {
    assert.equal(f.affRebase(50, 80, score), 80);
  }
  for (const score of [80, 81, 90, 100]) assert.equal(f.affRebase(50, 80, score), null);
  assert.equal(f.affRebase(60, 80, 62), 80);
  assert.equal(f.affRebase(50, 82, 62), 82);
});
test("降级、重复保存不重算；未写入的记录自然读取新起点", () => {
  const f = fixture();
  for (const [before, after, score] of [[80, 44, 90], [80, 80, 51], [50, 80, null], [50, 80, undefined]]) {
    assert.equal(f.affRebase(before, after, score), null);
  }
  assert.equal(f.affRebase(50, 120, 60), 100);
  assert.equal(fixture({}, { "me->c1": { label: "恋人" } }).affOf("c1"), 80);
});
test("实际 saveRel 写入与通知，新建/已聊/降级/重复保存/角色间关系", () => {
  const saveSrc = grab("  const saveRel =", "  const relSummaryFor =");
  for (const [initial, label, expected] of [[51, "恋人", 80], [63, "恋人", 80], [90, "恋人", 90], [undefined, "恋人", undefined]]) {
    let rels = {}, aff = initial === undefined ? {} : { c1: initial };
    const writes = [], notices = [];
    const f = fixture();
    const saveRel = new Function("setRels", "setAffinities", "saveJSON", "baseAffIn", "affRebase", "setTimeout", "toast",
      saveSrc + "\nreturn saveRel;")(
      update => { rels = update(rels); }, update => { aff = update(aff); },
      (key, value) => writes.push({ key, value }), f.baseAffIn, f.affRebase,
      fn => fn(), text => notices.push(text));
    saveRel("me->c1", label, "设定");
    assert.deepEqual(rels["me->c1"], { label, note: "设定" });
    assert.equal(aff.c1, expected);
    const count = writes.filter(x => x.key === "x_affinities").length;
    assert.equal(count, initial != null && initial < 80 ? 1 : 0);
    assert.equal(notices.length, count);
    saveRel("me->c1", label, "只改备注");
    saveRel("me->c1", "前任", "");
    saveRel("c1->c2", "恋人", "");
    assert.equal(aff.c1, expected);
    assert.equal(writes.filter(x => x.key === "x_affinities").length, count);
  }
});
test("情侣邀请只改变情侣状态，不覆盖主线好感；复合奖励走最新状态", () => {
  const invite = grab("  const respondCoupleInvite =", "  const genWhisper =");
  assert.doesNotMatch(invite, /setAff\(|affRebase\(/);
  assert.match(app, /setAff\(charId, current => current \+ 1\)/);
});
