const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/phone.js");
const NOW = Date.now();
const old = { items: [
  { kind: "typed", title: "交房租", time: "8月29日 02:11", body: "月底" },
  { kind: "voice", title: "跟她说的那句", time: "8月30日", body: "…" }] };

// 她 2026-09-01 选了「乙」（便签是名册、能划掉）；2026-11-24 改选「A」：写下的就不改，一刷新只往上加新的，
//   满了按上限把最旧的挤出去。模型交回来的 retired 对便签不再生效，同名的留旧的那份。
test("便签写下就不改：同名留旧的、retired 不收、只往上加", () => {
  assert.equal((P.PHONE_RETIRE.notes || {}).items, "便签", "便签没登记成名册");
  const kept = P.phoneGrowMerge("notes", old, { items: [{ title: "交房租", time: "昨天", body: "改写过的正文" }, { title: "新记的", time: "今天", body: "新" }], retired: { items: ["跟她说的那句"] } }, NOW);
  assert.equal(kept.items.length, 3, "旧的被 retired 撕掉了，或者新的没加进来");
  assert.equal(kept.items.find(x => x.title === "交房租").body, "月底", "同名的被新写的那份改掉了");
  const silent = P.phoneGrowMerge("notes", old, { items: [] }, NOW);
  assert.equal(silent.items.length, 2, "这一轮没写，旧的就没了");
  assert.match(require("fs").readFileSync(__dirname + "/../js/phone.js", "utf8"), /不用抄回来，也不会被改/);
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
