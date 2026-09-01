const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/phone.js");
const NOW = Date.now();
const old = { items: [
  { kind: "typed", title: "交房租", time: "8月29日 02:11", body: "月底" },
  { kind: "voice", title: "跟她说的那句", time: "8月30日", body: "…" }] };

// 她 2026-09-01 选了「乙」：便签不删，只是别再只进不出。
// 便签会被划掉、会写完就撕、事情办完了就没用了——是名册不是日志。
test("便签走名册，划掉的能退出", () => {
  assert.equal((P.PHONE_RETIRE.notes || {}).items, "便签", "便签没登记成名册");
  const gone = P.phoneGrowMerge("notes", old, { items: [{ title: "跟她说的那句", time: "昨天" }], retired: { items: ["交房租"] } }, NOW);
  assert.deepEqual(gone.items.map(x => x.title), ["跟她说的那句"], "写进 retired 了却还留着");
  // ⚠️只是没写不算删掉
  const silent = P.phoneGrowMerge("notes", old, { items: [{ title: "跟她说的那句", time: "昨天" }] }, NOW);
  assert.equal(silent.items.length, 2, "模型漏写一条就把它撕了");
});

// ⚠️名册的身份是【名字】，不是名字＋时刻——同一件事被再提起，还是那一件事。
// 便签有 time 这一栏，模型照抄回来时随手改个写法就会攒成两条一模一样的便签。
test("名册按名字认人，日志仍按名字＋时刻", () => {
  const same = P.phoneGrowMerge("notes", old, { items: [
    { kind: "typed", title: "交房租", time: "8月29日", body: "月底" },
    { kind: "voice", title: "跟她说的那句", time: "昨天", body: "…" }] }, NOW);
  assert.equal(same.items.length, 2, "照抄回来却攒成了四条——时刻写法一变就认不出是同一条");
  // 日志不许受影响：同一家店昨天去一次今天去一次，本来就是两条
  const t = P.phoneGrowMerge("takeout", { orders: [{ shop: "楼下那家", time: "昨天 12:10" }] },
    { orders: [{ shop: "楼下那家", time: "今天 12:10" }] }, NOW);
  assert.equal(t.orders.length, 2, "把日志也按名字认了，同一家店的两次到访被并成一次");
  // ⚠️取不出名字的行不能一律记成同一把钥匙，否则会互相吞掉
  const anon = P.phoneGrowList([{ body: "没标题的一条" }, { body: "另一条也没标题" }], [{ body: "第三条" }], 24, NOW, true);
  assert.equal(anon.length, 3, "没名字的几条塌成了一条");
});
