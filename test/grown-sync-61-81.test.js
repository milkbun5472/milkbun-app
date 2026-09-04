// 她 2026-09-04：「我发现心上的念想全没了，这是对的吗宝宝，念想只是本地的？」
//
// 不是本地的——它一直在上云，但只住在 saves 那一份【没有历史的整行 blob】里。
// 书签里那个几个月前的旧网页版整份 upsert 一次，就把它盖没了。
// 记忆和聊天活下来是因为各自有行表，而那个旧客户端代码里根本没有那两张表。
//
// 所以这一层的形状是硬要求：新表 + 只进不出的合并。这份测试钉的是【合并绝不丢东西】——
// 她已经因为「一边把另一边盖掉」丢过两次，这里再来一次就是第三次。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const g = {}; global.window = g;
require("../js/grown-sync.js");
const GS = g.GrownSync;

const D = 86400000, N = Date.now();

test("两边各有的角色，一个都不许少", () => {
  const local = { c1: { list: [{ id: "a", lastTouch: N }] } };
  const remote = { c2: { list: [{ id: "b", lastTouch: N }] } };
  const m = GS.mergeMap("heart", local, remote);
  assert.deepEqual(Object.keys(m).sort(), ["c1", "c2"]);
  assert.equal(m.c1.list[0].id, "a");
  assert.equal(m.c2.list[0].id, "b");
});

test("同一个人两边各有几条念想 → 取并集，不是二选一", () => {
  const local = { c1: { list: [{ id: "a", text: "想学手冲", lastTouch: N - D }] } };
  const remote = { c1: { list: [{ id: "b", text: "想去爬山", lastTouch: N - 2 * D }] } };
  const m = GS.mergeMap("heart", local, remote);
  assert.deepEqual(m.c1.list.map(x => x.id).sort(), ["a", "b"]);
});

test("同一条念想两边都有 → 取被想起得更近的那份", () => {
  const local = { c1: { list: [{ id: "a", text: "旧的", touches: 2, lastTouch: N - 5 * D }] } };
  const remote = { c1: { list: [{ id: "a", text: "新的", touches: 9, lastTouch: N }] } };
  assert.equal(GS.mergeMap("heart", local, remote).c1.list[0].text, "新的");
  // 反过来也一样（跟谁在左边无关）
  assert.equal(GS.mergeMap("heart", remote, local).c1.list[0].text, "新的");
});

test("发呆独白是日志：两边的都留着，同一条不重复", () => {
  const local = { c1: { log: [{ ts: N, text: "今天阳光很好" }, { ts: N - D, text: "昨天的" }] } };
  const remote = { c1: { log: [{ ts: N - D, text: "昨天的" }, { ts: N - 2 * D, text: "前天的" }] } };
  const log = GS.mergeMap("heart", local, remote).c1.log;
  assert.equal(log.length, 3, "应该是三条，实际 " + log.length);
  assert.equal(log[0].text, "今天阳光很好", "没按时间倒序");
});

test("云端那份是空的 → 本机一条都不许被抹掉", () => {
  // 这就是事故那一刻的形状：旧设备推上去一份空的
  const local = { c1: { list: [{ id: "a", lastTouch: N }], persona: [{ id: "p", ts: N }] } };
  const m = GS.mergeMap("heart", local, {});
  assert.deepEqual(m, local);
  const m2 = GS.mergeMap("heart", local, { c1: {} });
  assert.equal(m2.c1.list.length, 1, "云端那个人是空盒子，本机的念想被抹了");
  assert.equal(m2.c1.persona.length, 1, "长出来的自我被抹了");
});

test("Ta 眼里逐块取新的，旧版快照两边都留着", () => {
  const local = { c1: { blocks: { "me.person": { text: "本机新的", ts: N }, "us.what": { text: "只有本机有", ts: N - D } },
                        hist: [{ k: "me.person", old: "更早", ts: N - 9 * D }], checks: { "me.soft": N - D } } };
  const remote = { c1: { blocks: { "me.person": { text: "云端旧的", ts: N - 3 * D }, "me.soft": { text: "只有云端有", ts: N - D } },
                         hist: [{ k: "me.soft", old: "云端那版", ts: N - 4 * D }], checks: { "me.soft": N - 5 * D, "me.person": N } } };
  const m = GS.mergeMap("gaze", local, remote).c1;
  assert.equal(m.blocks["me.person"].text, "本机新的", "同一块没取新的");
  assert.equal(m.blocks["us.what"].text, "只有本机有");
  assert.equal(m.blocks["me.soft"].text, "只有云端有");
  assert.equal(m.hist.length, 2, "旧版快照丢了");
  assert.equal(m.checks["me.soft"], N - D, "「又想了一遍」的时刻取晚的");
  assert.equal(m.checks["me.person"], N);
});

test("空盒子 / 坏数据不许把整份弄崩", () => {
  for (const bad of [null, undefined, 0, "x", [], { c1: null }, { c1: "坏的" }]) {
    assert.doesNotThrow(() => GS.mergeMap("heart", { c1: { list: [{ id: "a" }] } }, bad));
    assert.doesNotThrow(() => GS.mergeMap("gaze", bad, { c1: { blocks: {} } }));
  }
  // 认不出的 kind：原样把本机那份还回来，别返回空
  assert.deepEqual(GS.mergeMap("什么鬼", { c1: { list: [] } }, { c2: {} }), { c1: { list: [] } });
});

test("changedIds 只报真变了的那几个人（别每次整份重推）", () => {
  const a = { c1: { list: [{ id: "x", lastTouch: 1 }] }, c2: { list: [] } };
  const b = { c1: { list: [{ id: "x", lastTouch: 1 }] }, c2: { list: [{ id: "y", lastTouch: 2 }] }, c3: { list: [] } };
  assert.deepEqual(GS.changedIds("heart", a, b).sort(), ["c2", "c3"]);
  assert.deepEqual(GS.changedIds("heart", b, b), []);
});

// ── 接线 ────────────────────────────────────────────────────────────────
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const cloud = fs.readFileSync(path.join(root, "js/cloud.js"), "utf8");
const gaze = fs.readFileSync(path.join(root, "js/gaze.js"), "utf8");
const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("表不在的时候整条静默 no-op，绝不挡住别的同步", () => {
  // 她得能在跑 SQL 之前先装上这一版；而且 VPS 挂了也不该连累主路。
  assert.match(cloud, /grownReady: null,/);
  assert.match(cloud, /if \(error\) \{ this\.grownReady = false; return null; \}/, "读失败没退化成 no-op");
  assert.match(cloud, /if \(error\) \{ this\.grownReady = false; return 0; \}/, "写失败没退化成 no-op");
  assert.match(cloud, /if \(!client \|\| this\.grownReady === false\) return null;/);
  assert.match(cloud, /onConflict: "user_id,char_id,kind"/, "不是按人+种类 upsert，会互相覆盖");
});

test("读不回来就什么都不做——绝不让这一层碰本机数据", () => {
  const i = app.indexOf("function grownReconcile()");
  assert.ok(i > 0, "开机没有对账那一段");
  const seg = app.slice(i, i + 2200);
  assert.match(seg, /if \(!remote\) return;/, "读失败/表不在时还往下走了");
  assert.match(seg, /window\.GrownSync\.mergeMap\(kind, local, remote\)/);
  // 合并没变化就一个字节都不写
  assert.match(seg, /if \(back\.length\) \{/, "没变化也照写，会白白惊动 saves 那条链");
  assert.match(seg, /catch \(e\) \{\/\* 这一层永远不许挡住别的 \*\/\}/);
});

test("改动的时候只推改动的那几行", () => {
  assert.match(app, /window\.GrownSync\.changedIds\("heart", before, n\)/, "心上没接上推送");
  assert.match(app, /window\.Cloud\.grownUpsert\("heart", patch\)\.catch\(\(\) => \{\}\)/, "推失败没兜住");
  assert.match(gaze, /window\.Cloud\.grownUpsert\("gaze", \{ \[touched\]: d\[touched\] \}\)\.catch/, "Ta 眼里没接上推送");
  // gaze 每一处落盘都得带上是谁，漏一处那个人就永远不上云
  const persists = [...gaze.matchAll(/persist\(d[^)]*\)/g)].map(m => m[0]);
  assert.ok(persists.length >= 6, "persist 调用只剩 " + persists.length + " 处");
  assert.deepEqual([...new Set(persists)], ["persist(d, charId)"], "有 persist 没带上是谁：" + persists.join(" / "));
});

test("脚本挂进去了，而且排在用它的人前面", () => {
  const a = idx.indexOf("js/grown-sync.js"), b = idx.indexOf("js/gaze.js"), c = idx.indexOf("js/app.js");
  assert.ok(a > 0, "index.html 没挂 grown-sync.js");
  assert.ok(a < b && a < c, "grown-sync 排在了用它的人后面");
});

test("建表 SQL 跟代码对得上（她要拿这份去 VPS 上跑）", () => {
  // ⚠️不另开一份 SQL：新表写进 schema-core.sql 这一份【唯一的库结构】里。
  //   另开一份的话，重建库的时候那张表就不见了——又是「一层写在两处，第二处没跟上」。
  const sql = fs.readFileSync(path.join(root, "tools/vps/lisa-cloud/schema-core.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.grown/);
  // 只看 grown 那一段：别的表也有这几行，整份 match 等于没查
  const blk = sql.slice(sql.indexOf("create table if not exists public.grown"));
  const body = blk.slice(0, blk.indexOf(");"));
  assert.match(body, /primary key \(user_id, char_id, kind\)/, "主键跟 onConflict 对不上就会写重");
  assert.match(body, /user_id uuid not null references auth\.users\(id\) on delete cascade/,
    "没接 auth.users：账号删了这些行会变成孤儿");
  // ⚠️光有 RLS policy 不够：这个库的惯例是还要显式 grant 给 authenticated，
  //   不 grant 的话 policy 再对也是 permission denied。所以必须进那个循环的名单。
  const loop = sql.match(/foreach t in array array\[([^\]]*)\]/);
  assert.ok(loop, "找不到那个统一开 RLS + grant 的循环");
  assert.match(loop[1], /'grown'/, "grown 没进 RLS/grant 那个名单——建了也用不了");
  assert.match(sql, /grant select, insert, update, delete on public\.%I to authenticated/);
  // 别再留一份会跟它走散的独立 SQL
  assert.ok(!fs.existsSync(path.join(root, "长出来的那几样-建表.sql")),
    "又多出一份独立的建表 SQL——重建库时它不会被跑到");
});
