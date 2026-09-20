// 「抽屉是会被清理吗，为什么我上个星期前的记录都没了」（她 2026-09-20）。
//
// 不是清理，是封顶算错了：x_coupleDrawer 里装着【所有角色】的东西，render 时才按
// characterId 筛，可封顶是对【整份数组】做的 slice(0, 120)。角色一多，那 120 个名额
// 是抢的——别人那边掉几样，她这边上个星期的就被挤出去了，而且不留任何痕迹。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("按角色各自封顶，还没拆的永远不挤", () => {
  const i = app.indexOf("  const DRAWER_CAP = ");
  const j = app.indexOf("  const drawerPush = item =>", i);
  assert.ok(i > 0 && j > i, "抠不出 DRAWER_CAP / drawerTrim");
  const src = app.slice(i, j);
  const trim = new Function(src + "; return drawerTrim;")();

  // 三个角色各塞 400 样（新→旧），互相不该挤
  const mk = (cid, n, opened) => Array.from({ length: n }, (_, k) =>
    ({ id: cid + k, characterId: cid, openedTs: opened ? 1 : null, ts: n - k }));
  const out = trim([].concat(mk("a", 400, true), mk("b", 400, true), mk("c", 400, true)));
  ["a", "b", "c"].forEach(cid => {
    assert.strictEqual(out.filter(x => x.characterId === cid).length, 300,
      cid + " 的名额被别的角色抢走了");
  });

  // 留下的必须是【最新的】那一批，不是随手前 300 个
  const keptA = out.filter(x => x.characterId === "a");
  assert.strictEqual(keptA[0].id, "a0", "留错了：掉的该是最老的");

  // 还没拆的一样都不许掉——封着的掉了就永远不知道里面是什么
  const sealed = trim(mk("a", 400, false));
  assert.strictEqual(sealed.length, 400, "把还没拆的挤掉了");
  // 拆过的和封着的混在一起：先挤拆过的
  const mixed = trim([].concat(mk("a", 200, false), mk("a", 400, true)));
  assert.strictEqual(mixed.filter(x => !x.openedTs).length, 200, "封着的被挤掉了");
});

test("放东西进抽屉只有一个口", () => {
  // 心声掉落 / 专属掉落 / 悄悄话三处原来各写一遍 [新的, ...旧的].slice(...)
  assert.ok(!/slice\(0, DRAWER_CAP\)/.test(app), "还有地方自己裁，绕过了 drawerPush");
  assert.strictEqual((app.match(/drawerPush\(\{/g) || []).length, 3, "三处放东西的口没有全接上");
  assert.match(app, /const drawerPush = item => setCoupleDrawer\(p => \{\s*const n = drawerTrim\(\[item, \.\.\.p\]\);/,
    "公共那个口不是走 drawerTrim");
});

test("开机搬家那两步不许先挤掉一批", () => {
  // 她上星期的东西不该在一次迁移里没掉；裁交给 drawerPush 按规矩来
  assert.ok(!/sort\(\(a, b\) => \(b\.ts \|\| 0\) - \(a\.ts \|\| 0\)\)\.slice\(0, 120\)/.test(app),
    "搬家那一步还写死 120，跟 DRAWER_CAP 各一份");
});
