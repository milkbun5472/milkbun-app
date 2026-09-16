// 她 2026-09-16：「论坛放出楼层还是不是按顺序，他可能比如说先立马显示 5 楼以后，
// 然后等待生成，过几秒生成好后才放出 2 3 4 楼」。
//
// 我把三条排队路径都抠出来真跑了一遍：首次加载、「更多回复」——这两条都是单调的，
// 放出顺序跟楼号一致。**出问题的是第三条：她自己那帖的「一波波有人来回」。**
// 那一处写死了「这一波是现在才发生的，所以直接可见」——那就是插队：
// 楼里还排着 8 分钟后、18 分钟后才露面的那几条，这一波却当场冒出来；
// 而楼号是按【到场先后】现算的，于是新来的占掉小号，她正等着的那几条被顶到后面，
// 看着就像楼层在乱跳。
//
// 规矩早就定了，只是写在另一处没跟上：**新楼一律接在旧队列的最后面**。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const screens = fs.readFileSync("js/screens.js", "utf8");
const order = new Function(
  screens.match(/const forumFloorArrivedAt = [^\n]+/)[0] + ";" +
  screens.match(/function forumFloorOrder\(floors\) \{[\s\S]*?\n\}/)[0] + ";return forumFloorOrder;")();
const visibleAt = new Function(
  app.match(/  const forumCommentVisibleAt = \(base, index, salt\) => \{[\s\S]*?\n  \};/)[0] + "return forumCommentVisibleAt;")();

const M = 60000;
const firstLoad = (base, n) => order(Array.from({ length: n }, (_, i) =>
  ({ id: "f" + i, visibleAt: visibleAt(base, i, 0), ts: visibleAt(base, i, 0) })));

test("一波新回复不许插队：接在旧队列最后面", () => {
  const base = 0, list = firstLoad(base, 10), now = base + 1 * M;
  // app.js 里那两行就是这个算法
  const lastQueued = list.reduce((n, f) => Math.max(n, Number(f.visibleAt || 0)), 0);
  const waveAt = Math.max(now, lastQueued + 1);
  assert.ok(waveAt > lastQueued, "这一波排在了还没露面的楼前面——那就是插队");
  const after = order([...list, { id: "w0", visibleAt: waveAt, ts: waveAt }]);
  const seen = after.filter(f => f.visibleAt <= now).map(f => f.id);
  assert.deepEqual(seen, ["f0", "f1", "f2"], "这一波当场冒出来了，把她正等着的那几条顶到了后面");
  // 而且它拿的是最大的楼号，不会把小号从别人手里抢走
  assert.equal(after[after.length - 1].id, "w0");
});

test("队列空着的时候照旧当场可见——不耽误「现在才发生」那层意思", () => {
  const now = 5 * M;
  // 全都放完了（released 的那些 visibleAt 是 0）
  const list = [{ id: "a", visibleAt: 0, ts: 1 }, { id: "b", visibleAt: 0, ts: 2 }];
  const lastQueued = list.reduce((n, f) => Math.max(n, Number(f.visibleAt || 0)), 0);
  assert.equal(Math.max(now, lastQueued + 1), now, "没人排队时这一波不该被推到将来");
});

test("三条路都放完之后，放出顺序跟楼号严格一致", () => {
  const base = 0;
  let list = firstLoad(base, 12);
  const waveNow = base + 2 * M;
  const lastQueued = list.reduce((n, f) => Math.max(n, Number(f.visibleAt || 0)), 0);
  const waveAt = Math.max(waveNow, lastQueued + 1);
  list = order([...list, { id: "w0", visibleAt: waveAt, ts: waveAt }, { id: "w1", visibleAt: waveAt + 1, ts: waveAt + 1 }]);
  // 楼号必须随到场时间单调不减——只要有一处倒过来，她就会看见楼层乱跳
  let prev = -1;
  for (const f of list) {
    const at = Number(f.visibleAt || f.ts);
    assert.ok(at >= prev, "楼号 " + f.floor + "（" + f.id + "）比它前面那层还早露面");
    prev = at;
  }
  assert.deepEqual(list.map(f => f.floor), list.map((_, i) => i + 2), "楼号必须是连号，不许跳");
});

test("代码里那两行还在（别再改回「直接可见」）", () => {
  assert.match(app, /const lastQueued = existing\.reduce\(\(n, f\) => Math\.max\(n, Number\(f && f\.visibleAt \|\| 0\)\), 0\);\n\s*const waveAt = Math\.max\(base, lastQueued \+ 1\);/);
  assert.match(app, /visibleAt: waveAt \+ i, ts: waveAt \+ i/);
  const live = app.split("\n").map(l => l.split("//")[0]).join("\n");
  assert.ok(live.indexOf("visibleAt: base, ts: base }))") < 0,
    "那一波又被改回「直接可见」了——她 2026-09-16 报的楼层乱跳就是这么来的");
});
