const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src0 = fs.readFileSync(path.join(__dirname, "..", "js", "map.js"), "utf8");
const K = new Function(src0.slice(src0.indexOf("  const zhOverlap = function"), src0.indexOf("  // 一个世界的舆图")) +
  "\nreturn { liveNodeOf, worldNodeNames, zhOverlap };")();
const world = {
  pins: { c1: "王府" },
  route: { c1: { home: "王府", places: [{ doing: "搜查厢房", node: "东跨院" }] } },
  regions: [{ name: "城南", nodes: [{ name: "王府" }, { name: "城南茶楼" }, { name: "东跨院" }, { name: "官署" }] }]
};
const at = st => K.liveNodeOf(world, { id: "c1" }, st);

// 她 2026-08-31：「架空地图王爷一直在王府不动了，但是明明显示他应该在别的地方」。
// 病根：原来【只】跟 route.places 那张表对，而那张表是【开世界那天】模型给的一次性
// 映射。行程天天新生成，对不上就永远退回落脚点——看起来就是人钉死在王府。
test("行程写了地点，就按地点走，不看那张冻住的旧表", () => {
  const r = at({ title: "在城南茶楼见人", location: "城南茶楼" });
  assert.equal(r.node, "城南茶楼");
  assert.equal(r.live, true);
  // 旧表里压根没有「城南茶楼」这一条，照样对得上——这就是修好的那一步
  assert.ok(!world.route.c1.places.some(q => q.node === "城南茶楼"));
  // ⚠️上面那条标题里也带着「城南茶楼」，会被【标题】那一支接住，证不到地点那一支。
  // 再来一条标题里一个地名都没有的：只有 location 指得出去。
  const only = at({ title: "见个人", location: "城南茶楼" });
  assert.equal(only.node, "城南茶楼", "标题不带地名时，行程里的地点就没人用了");
  assert.equal(only.live, true);
});

test("地点写在标题里也认得（门槛抬高，免得随便撞上一个）", () => {
  assert.equal(at({ title: "回王府用饭", location: "" }).node, "王府");
  // 标题噪音多，随便一句不该乱认
  const r = at({ title: "写了半天字", location: "" });
  assert.equal(r.live, false, "标题没提地点却认上了一个");
});

test("那张旧表仍然当兜底，而且不再把两个字段拼起来比", () => {
  assert.equal(at({ title: "搜查厢房", location: "" }).node, "东跨院");
  // ⚠️zhOverlap 的分母是较长那个：title 和 location 拼成一句再比只会互相稀释，
  // 本来对得上的会掉到门槛以下。分开比、取高的。
  const seg = src0.slice(src0.indexOf("    const r = (world.route || {})[char.id];"), src0.indexOf("    // ④ 行程明明写着"));
  assert.match(seg, /Math\.max\(zhOverlap\(q\.doing, title\), loc \? zhOverlap\(q\.doing, loc\) : 0\)/, "又拼回去了");
  assert.ok(!/\[st\.title, st\.location\]\.filter\(Boolean\)\.join/.test(src0), "拼成一句那行还在");
});

test("睡觉/休息回家这一支没被改坏", () => {
  assert.deepEqual(at({ type: "sleep", title: "歇下", location: "" }), { node: "王府", live: true, why: "回去歇着了" });
  assert.equal(at({ type: "rest", title: "眯一会儿", location: "" }).why, "回去歇着了");
});

// 她抱怨的核心是「明明显示他应该在别的地方」——她看得见行程，图上却不动。
// 那种情况多半是【图上没有那个地方】。默默退回落脚点等于让人以为坏了。
test("图上没有那个地方，要说出来，不是默默退回落脚点", () => {
  const r = at({ title: "去了城北码头", location: "城北码头" });
  assert.equal(r.node, "王府");
  assert.equal(r.live, false);
  assert.equal(r.miss, "城北码头", "对不上却什么都不说");
  assert.match(src0, /"行程说他在「" \+ w\.miss \+ "」，这张图上还没有——右上角可以加一个"/, "界面上没把它说出来");
  // 没有行程的时候不该报这个
  assert.equal(at(null).miss, undefined);
});

test("「此刻在」不会说成「此刻在在…」", () => {
  assert.equal(at({ title: "在城南茶楼见人", location: "城南茶楼" }).why, "此刻在城南茶楼见人");
});
