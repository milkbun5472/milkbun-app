const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { liveNodeOf, zhOverlap } = require("../js/map.js");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const map = R("map.js"), app = R("app.js");
const grab = (src, a, b, cap) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return src.slice(i, j);
};

// 她 2026-08-31：「现实地图和架空地图角色都可以行程变的时候免费动一下，
// 架空可能动更准确一点因为图上都有实际地方」。
// 免费 = 不花模型调用。贵的那一步（他在做的这件事落在哪个地点，是语义配对）
// 在造世界那一枪里已经问过一次了，之后就只是查表。
const W = {
  pins: { c1: "官署后巷" },
  route: { c1: { home: "王府东院", places: [
    { doing: "在官署点卯", node: "官署后巷" },
    { doing: "去码头验货", node: "浮桥集" },
    { doing: "夜里查旧案", node: "沉档房" }
  ] } }
};
const C = { id: "c1" };

test("行程指到哪儿，人就在哪儿——一次调用都不花", () => {
  assert.deepEqual(liveNodeOf(W, C, { title: "去码头验货", type: "work" }).node, "浮桥集");
  assert.equal(liveNodeOf(W, C, { title: "去码头验货", type: "work" }).live, true);
  // 行程改了说法也要认得出来：验的是「说的是不是同一件事」，不是逐字相等
  assert.equal(liveNodeOf(W, C, { title: "验货", location: "码头", type: "work" }).node, "浮桥集");
  assert.equal(liveNodeOf(W, C, { title: "夜里去查那桩旧案", type: "work" }).node, "沉档房");
});

test("对不上就退回落脚点，绝不瞎猜——猜错比不动更糟", () => {
  const r = liveNodeOf(W, C, { title: "跟人吃了顿饭", type: "meal" });
  assert.equal(r.node, "官署后巷", "对不上却挪走了——人会莫名其妙地闪现");
  assert.equal(r.live, false, "没对上还标成「此刻」");
  assert.equal(liveNodeOf(W, C, null).node, "官署后巷", "没有行程时就该待在落脚点");
  // 沾一个字就算数是不行的：「去买菜」和「去码头验货」只共一个「去」，
  // 门槛一松他就会被扔到码头去。这一条专治「配对判据太松」。
  const loose = liveNodeOf(W, C, { title: "去买菜", type: "out" });
  assert.equal(loose.node, "官署后巷", "只沾一个字就把人挪走了——配对门槛太松");
  assert.equal(loose.live, false);
  assert.equal(liveNodeOf({ pins: { c1: "官署后巷" } }, C, { title: "去码头验货" }).node, "官署后巷", "没有那张表也敢挪");
});

test("睡觉和休息认得出是回家，哪怕表里没写", () => {
  assert.equal(liveNodeOf(W, C, { title: "睡了", type: "sleep" }).node, "王府东院");
  assert.equal(liveNodeOf(W, C, { title: "歪着歇会儿", type: "rest" }).node, "王府东院");
  // 没有 home 就还是别动
  assert.equal(liveNodeOf({ pins: { c1: "官署后巷" }, route: { c1: { places: [] } } }, C, { type: "sleep" }).node, "官署后巷");
});

test("像不像同一件事，判据要经得起两头包含和错字", () => {
  assert.equal(zhOverlap("在官署点卯", "在官署点卯"), 1);
  assert.equal(zhOverlap("点卯", "在官署点卯"), 1, "一方包含另一方就该算同一件");
  assert.ok(zhOverlap("去码头验货", "码头验一批货") > 0.34);
  assert.ok(zhOverlap("在官署点卯", "陪她逛街") < 0.34, "八竿子打不着的也算上了");
  assert.equal(zhOverlap("", "什么"), 0);
});

test("那张表在造世界时问一次，编出来的地点一律丢掉", () => {
  const gen = grab(app, "  const genWorld = async (id, name, brief, charIds, done) => {", "  const saveWorld = (id, name, brief)");
  assert.match(gen, /\.filter\(q => q\.doing && names\[q\.node\]\)/, "模型编的地点也收——那张表就会指向图上没有的地方");
  assert.match(gen, /if \(names\[home\] \|\| places\.length\) route\[c\.id\] = /, "整张表没存下来");
  assert.match(gen, /doing 那一栏照着他行程里的说法写/, "没要求 doing 跟行程对得上——对不上这张表就白问了");
  assert.match(app, /cast: \(charIds \|\| \[\]\)\.slice\(0, 8\), why: [\s\S]{0,60}?, route,/, "route 没跟着世界一起存");
});

// ── 现实那半：把行程里那句「在哪」查成坐标，一辈子只查一次 ──────────────
test("现实地图：地名查一次就缓存，查不到的也记下来", () => {
  assert.match(map, /const GEO_KEY = "x_geoPlace";/, "没有缓存");
  assert.match(map, /if \(v\.miss\) return \(Date\.now\(\) - v\.miss < GEO_MISS_TTL\) \? "miss" : null;/, "查不到的没记——每次渲染都会再去撞一遍");
  assert.match(map, /geoQueue\.some\(function \(j\) \{ return j\.key === key; \}\)/, "同一个地名会被排进队列好几次");
  assert.match(map, /setTimeout\(geoPump, 1200\)/, "一次一个之间没有间隔——OSM 那边会封");
  assert.match(map, /q: \(hm \? hm\.city \+ " " : ""\) \+ String\(loc\)\.trim\(\)/, "搜地名没带上他所在的城市——光搜「公司」全世界都是");
  // 渲染的时候不许发请求
  const cp = grab(map, "  function charPos(char, st, userGeo) {", "  function avatarHtml(");
  assert.ok(!/nomSearch|fetch\(/.test(cp), "画一次就发一次请求");
  assert.match(cp, /if \(g && g !== "miss"\) return \[g\[0\] \+ j\[0\], g\[1\] \+ j\[1\]\];/, "查到了坐标却没站过去");
  // 两处画头像的地方都要挂上补坐标的钩子，少一处那一处就永远不动
  assert.equal((map.match(/useSchedGeo\(/g) || []).length, 3, "useSchedGeo 少定义或少挂了一处");
});

test("图上画的是此刻的位置，钉过来改的是落脚点——两件事别混", () => {
  const wm = grab(map, "  function WorldMap({", "  // 开世界：整页表单");
  // v58.79 起名单里多了她自己（她不跟行程走），所以这里只验角色那一支还是按行程算的
  assert.match(wm, /: liveNodeOf\(world, c, \(status \|\| \{\}\)\[c\.id\]\)/, "画的还是死钉子");
  assert.match(wm, /onPin\(c\.id, pins\[c\.id\] === sel\.name \? null : sel\.name\)/, "「挪走」按的是此刻位置,那会把不在这儿的人也当成钉在这儿");
  assert.match(wm, /w\.live \? "此刻在「" \+ w\.node \+ "」" : "落脚在「" \+ w\.node \+ "」"/, "分不出「此刻在」和「落脚在」");
});
