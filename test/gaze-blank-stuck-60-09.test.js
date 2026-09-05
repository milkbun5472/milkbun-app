const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const gazeSrc = fs.readFileSync(path.join(root, "js/gaze.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-09-02：「新角色有一个每轮填空卡另一个死活不填都是空的基本上。这对吗」
//
// 「每轮填一块」是 v59.80 定的（空卡 gap=0，每轮点名，填满为止），那个是对的。
// 「死活不填」有三条各自独立的死路，每一条都是【静悄悄】的：
//   ① 自动建卡记成布尔——网络抖一下就把这个角色一辈子仅有的那次机会烧掉，auto 还不弹 toast；
//   ② 模型回一份全 null，seed() 照样盖 seeded=true，路永久封死而卡还是空的；
//   ③ 空卡上「认识得还不够」是个没有反作用力的免费出口，十块可以一直轮着拒。
// 这个文件把三条都钉住。

function fresh() {
  const store = {};
  const sb = {
    React: { useState: () => [] }, ReactDOM: { createPortal: () => null }, h: () => null,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    F_BODY: "", F_DISPLAY: "", window: {}
  };
  new Function(...Object.keys(sb), gazeSrc)(...Object.values(sb));
  return { G: sb.window.Gaze, box: id => JSON.parse(store.x_gaze || "{}")[id] || null,
    put: (id, b) => { const d = JSON.parse(store.x_gaze || "{}"); d[id] = b; store.x_gaze = JSON.stringify(d); } };
}

test("自动建卡失败一次不许烧掉一辈子——记的是第几次，不是试过没有", () => {
  const { G, put, box } = fresh();
  assert.equal(G.autoSeedDue("c"), true);
  G.markAutoSeed("c");
  assert.equal(G.autoSeedDue("c"), false, "刚试完不该马上再试");
  const b = box("c"); b.autoSeed = Date.now() - 3600000; put("c", b);
  assert.equal(G.autoSeedDue("c"), true, "隔了足够久，卡还空着，就该再试一次");
});

test("三次是一辈子的上限，不是每天三次", () => {
  const { G, put, box } = fresh();
  for (let i = 0; i < 3; i++) {
    assert.equal(G.autoSeedDue("c"), true, "第 " + (i + 1) + " 次该放行");
    G.markAutoSeed("c");
    const b = box("c"); b.autoSeed = Date.now() - 3600000; put("c", b);
  }
  assert.equal(G.autoSeedDue("c"), false, "三次之后永远不再自动花钱");
  assert.equal(G.autoSeedState("c").tries, 3);
});

test("老存档只有 autoSeed 时间戳——算已经试过一次，还剩两次", () => {
  const { G, put } = fresh();
  put("c", { blocks: {}, hist: [], seeded: false, autoSeed: Date.now() - 86400000 });
  assert.equal(G.autoSeedDue("c"), true, "v59.80 烧掉的那些角色要能自己缓过来");
  assert.equal(G.autoSeedState("c").tries, 1);
});

test("模型回一份全 null 不算建过卡——不然路封死了卡还是空的", () => {
  const { G, put, box } = fresh();
  const n = G.seed("c", { me: { person: null, soft: null }, us: { what: null } });
  assert.equal(n, 0);
  assert.notEqual((box("c") || {}).seeded, true, "一块都没写出来不许盖 seeded");
  put("c", Object.assign(box("c") || { blocks: {} }, { autoSeed: 0 }));
  assert.equal(G.autoSeedDue("c"), true);
});

test("真写出来了才算建过卡", () => {
  const { G, box } = fresh();
  assert.equal(G.seed("c", { me: { person: "她说话前会先停半秒" }, us: {} }), 1);
  assert.equal(box("c").seeded, true);
  assert.equal(G.autoSeedDue("c"), false);
});

test("败因要留下来，不然「试过三次都没成」跟「还没聊够」长得一模一样", () => {
  const { G } = fresh();
  G.markAutoSeed("c");
  // v63.90 起败因【存进去之前就翻成人话】——存原文的话这句在界面上会一直是机器话
  G.markAutoSeedFail("c", "没解析出卡");
  assert.equal(G.autoSeedState("c").err, "模型没按格式答");
  G.markAutoSeed("c");
  assert.equal(G.autoSeedState("c").err, "", "新一次开打时把上一次的败因清掉");
});

test("空卡上的「写不出来」要记连击，真写了一块就断", () => {
  const { G } = fresh();
  G.markChecked("c", "me.person");
  G.markChecked("c", "me.soft");
  assert.equal(G.refuseCount("c"), 2);
  G.apply("c", "me", "recent", "她这两天睡得晚");
  assert.equal(G.refuseCount("c"), 0, "他真写了 → 连击断");
});

test("卡里已经有东西时，「看过了不用改」是正经回答，不该记成拒答", () => {
  const { G } = fresh();
  G.apply("c", "me", "person", "她说话前会先停半秒");
  G.markChecked("c", "me.soft");
  assert.equal(G.refuseCount("c"), 0);
});

test("连着拒了几轮之后，spec 要收掉那个免费出口，而且这句得垫在最后", () => {
  const { G } = fresh();
  const before = G.spec("她", "c");
  assert.ok(before.indexOf("连着好几轮") < 0, "一开始不该催");
  for (let i = 0; i < 3; i++) G.markChecked("c", "me.person");
  const after = G.spec("她", "c");
  const i = after.indexOf("连着好几轮");
  assert.ok(i > 0, "连着拒了三轮之后必须收出口");
  assert.ok(i > after.indexOf("都管不到这一条"), "最响的那句话赢，尤其它还是最后一句");
  assert.ok(after.indexOf("任何一块") > 0, "要允许他换一块写，别死磕被点名的那块");
});

test("auto 那一路失败必须写进卡里——它不弹 toast，不记就等于没发生过", () => {
  const seg = app.slice(app.indexOf("const seedGazeFor"), app.indexOf("const maybeAutoSeedGaze"));
  const cut = seg.indexOf("} catch (e)");
  assert.ok(cut > 0);
  const body = seg.slice(0, cut), rescue = seg.slice(cut);
  assert.ok(/markAutoSeedFail\(char\.id/.test(rescue), "catch 里要记败因");
  assert.ok(/markAutoSeedFail\(char\.id/.test(body), "解析出来但一块没写(全 null)也是失败，也要记");
});

test("空卡那一页要照实说出它为什么空", () => {
  const seg = gazeSrc.slice(gazeSrc.indexOf("!hasAny(charId) ?"), gazeSrc.indexOf("defs.map("));
  assert.ok(seg.indexOf("autoSeedState") > 0, "要报自动建卡试了几次、为什么没成");
  assert.ok(seg.indexOf("refuse") > 0, "要报他被问过几轮都说写不出来");
});
