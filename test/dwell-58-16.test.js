const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const dwell = R("dwell.js"), app = R("app.js"), comp = R("components.js"), core = R("core.js");
const idx = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const D = (() => {
  const store = {}; const w = {};
  new Function("loadJSON", "saveJSON", "window", "useTheme", "useState", "useEffect", "h", "Head", "Empty", "Sheet", "Spinner", "Eyebrow", "IArrow", "IRefresh", "ITrash", "pageSkin", "safeTop", "F_BODY", "F_DISPLAY", dwell)(
    (k, d) => store[k] !== undefined ? JSON.parse(JSON.stringify(store[k])) : d,
    (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); }, w,
    () => ({}), () => [null, () => {}], () => {}, () => null, null, null, null, null, null, null, null, null, () => ({}), () => "", "", "");
  return w.Dwell;
})();

// 她 2026-08-30：房间／常去的地点，prompt 别那么复杂
test("常去的地方从行程里长出来，不另外调模型", () => {
  const sched = { c1: {
    "2026-08-28": { seqs: [{ location: "实验室" }, { location: "宿舍" }, { location: "食堂" }] },
    "2026-08-29": { seqs: [{ location: "实验室" }, { location: "宿舍" }] },
    "2026-08-30": { seqs: [{ location: "实验室" }, { location: "图书馆" }, { location: "宿舍" }] } } };
  const f = D.frequentPlaces("c1", sched, 14);
  assert.deepEqual(f.map(x => x.name), ["实验室", "宿舍"], "该按去过的次数排，且只去过一天的不算常去");
  assert.equal(f[0].days, 3);
  assert.equal(f.find(x => x.name === "图书馆"), undefined, "只去过一天的不该算常去");
  assert.deepEqual(D.frequentPlaces("c9", sched, 14), [], "没行程就是空的，不许瞎编");
  // ⚠️行程一天是 { seqs:[{location}] }。写成 rows[].place 会一条都数不出来，
  // 而且是【静默的】——页面上只是「没有常去的地方」，看不出是读错了字段。
  assert.match(dwell, /const seqs = \(byDay\[k\] && byDay\[k\]\.seqs\) \|\| \[\];/);
  assert.match(dwell, /String\(\(r && r\.location\) \|\| ""\)\.trim\(\)/);
  assert.doesNotMatch(dwell, /r\.place \|\| r\.where/, "别再猜字段名");
});

test("prompt 短：只给判据，不替模型写作文", () => {
  const sp = D.placeSpec({ name: "沈屿白" }, null, null);
  assert.ok(sp.instruction.length < 600, "又写复杂了：" + sp.instruction.length + " 字");
  ["一句氛围", "4~5 个区域", "每个区域 3 件东西", "唯一的判据"].forEach(k =>
    assert.ok(sp.instruction.indexOf(k) > 0, "少了这一段：" + k));
  // 判据是「能反过来说出他这个人的一件事」，反例只举【谁的房间都有】那种
  assert.match(sp.instruction, /每一件都要能反过来说出他这个人的一件事/);
  assert.match(sp.instruction, /谁的地方都成立，不算/);
  // 三层：叫法 / 一句话 / 他自己的想法
  ["name", "note", "thought"].forEach(k =>
    assert.ok(sp.schemaHint.indexOf('"' + k + '"') > 0, "schema 少了 " + k));
  assert.match(sp.schemaHint, /"zones":\[\{"name"/, "区域→物品两层，不是一堆孤立的点");
  // 写常去的地点时要点名是哪个
  assert.match(D.placeSpec({ name: "沈屿白" }, "实验室", null).instruction, /这次写的是【实验室】/);
});

test("上一份原样发回去——不发的话每刷一次就是另一个屋子", () => {
  const prev = { id: "p1", name: "研究生宿舍", zones: [{ name: "上铺床位", items: [{ name: "灰蓝夏被" }, { name: "充电线" }] }] };
  const sp = D.placeSpec({ name: "沈屿白" }, null, prev);
  assert.match(sp.instruction, /【上一次这地方是这样】/);
  assert.ok(sp.instruction.indexOf("上铺床位：灰蓝夏被、充电线") > 0);
  assert.match(sp.instruction, /默认原样照抄回来/);
  assert.equal(D.placeSpec({ name: "沈屿白" }, null, null).instruction.indexOf("上一次这地方"), -1);
  // 刷新是【改这一份】，不是又攒一个新的
  const got = D.normalize({ name: "研究生宿舍", zones: [{ name: "床位", items: [{ name: "被子" }] }] }, null, prev);
  assert.equal(got.id, "p1", "刷新要覆盖同一条，不是每次新增一个地方");
});

test("没解析出区域就不落盘——留个空壳比不生成更坏", () => {
  assert.equal(D.normalize(null, null, null), null);
  assert.equal(D.normalize({ name: "宿舍", zones: [] }, null, null), null, "一个区域都没有＝这次没写出来");
  assert.equal(D.normalize({ name: "宿舍", zones: [{ name: "床位", items: [] }] }, null, null), null, "区域里一件东西都没有也不算");
  const ok = D.normalize({ name: "宿舍", en: "Dorm!!", ambient: "a", zones: [{ name: "床位", items: [{ name: "被子", note: "n", thought: "t" }] }] }, null, null);
  assert.ok(ok && ok.id);
  assert.equal(ok.en, "Dorm", "英文名要滤掉标点，它是拿去当版式眉标的");
  assert.equal(ok.fromSched, false);
  assert.equal(D.normalize({ name: "x", zones: [{ name: "z", items: [{ name: "i" }] }] }, "实验室", null).fromSched, true);
  // app 那边也得判：返回 null 就别存
  assert.match(app, /if \(!place\) \{ toast\("这次没写出来，再试一次"\); return null; \}/);
});

test("判断用哪个 API、就拿哪个去调——别一个判断一个调用", () => {
  // 只看 active 却拿 bgActive 去调：她没配后台 API 时报的是
  // 「Cannot read properties of null (reading 'baseUrl')」，根本看不懂（实测踩到）
  const i = app.indexOf("  const genDwellPlace = async (char, hintName, prev) => {");
  assert.ok(i > 0, "genDwellPlace 不见了");
  const seg = app.slice(i, i + 1200);
  assert.match(seg, /const api = bgActive \|\| active;/);
  assert.match(seg, /if \(!api\) \{ toast\("请先到设置配置 API"\); return null; \}/);
  assert.match(seg, /await runProbe\(api, ctxFor\(char\)/);
  assert.doesNotMatch(seg, /runProbe\(bgActive,/, "判断和调用又对不上了");
});

test("挂进去了：脚本、图标、路由", () => {
  assert.match(idx, /<script src="js\/dwell\.js\?v=/);
  assert.match(comp, /dwell: \{ kind: "app", zh: "地方", G: GDwell \}/);
  assert.match(core, /const GDwell = p =>/);
  const r = app.indexOf('screen === "dwell"');
  assert.ok(r > 0, "没接路由");
  // ⚠️只切「地方」那一段：schedules 别的路由也在传，整份 app.js 里找必然误判
  const blk = app.slice(r, app.indexOf("else if (screen ===", r + 20));
  assert.match(blk, /body = h\(window\.DwellApp, \{/);
  assert.match(blk, /schedules: schedules,/, "常去的地方要靠行程，不给就永远是空的");
  assert.match(blk, /onGen: genDwellPlace,/);
  assert.match(dwell, /window\.DwellApp = DwellApp;/);
});
