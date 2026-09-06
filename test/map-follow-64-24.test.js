// 地图上的人不跟着行程走（她 2026-09-06：「架空地图和现实地图角色好像都不会随着日程
// 移动，然后如果比如说王爷我钉到温尼伯和一个架空世界这种怎么算呢」）。
//
// 两张图的跟随机制其实都在，卡住的是同一件事：**粒度对不上**。
// 行程写的是「他家里的一个房间」（小厨房、东跨院），而两张图上认得出的地名是
// 【城／坊市】那一级——现实图拿它去 OSM 搜永远搜不到，架空图拿它去对节点名也对不上。
// 所以：行程多写一栏 place（大地方），两张图都先认它。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), eng = R("engine.js"), mapSrc = R("map.js");
const MK = require(path.join(__dirname, "..", "js", "map.js"));

test("行程多出一栏【大地方】，两处 schema 和落库都收下它", () => {
  assert.match(eng, /⚠️每一段都要给 place：他这会儿人在哪个【大地方】/);
  assert.match(eng, /写不出 place 那一段，他就停在原地不动/);
  // 三处落库（单天／整周／补写）都要留住它，漏一处那一天的人就不动
  assert.equal((app.match(/place: (?:s|x)\.place \|\| ""/g) || []).length, 3, "有落库的地方没收 place");
  // ⚠️还得从 status 那一层递出去，否则地图那头永远看不见（一层写在两处的老病）
  assert.match(app, /location: cur\.location \|\| "", place: cur\.place \|\| ""/);
});

test("现实图：先拿 place 去查坐标，再退回细地点", () => {
  assert.match(mapSrc, /const q = \(st && \(st\.place \|\| st\.location\)\) \|\| "";/);
  assert.match(mapSrc, /const q2 = st && \(st\.place \|\| st\.location\);/, "补坐标那一处没跟上（就永远查的还是老那个）");
});

test("架空图：place 最先对，而且门槛更低（它本来就是地名级）", () => {
  const seg = mapSrc.slice(mapSrc.indexOf("function liveNodeOf("), mapSrc.indexOf("// 一个世界的舆图"));
  assert.match(seg, /let hit = place \? bestNode\(names, place, 0\.28\) : null;/);
  assert.match(seg, /if \(!hit && loc\) hit = bestNode\(names, loc, 0\.34\);/, "细地点那一路不许丢");
  // 真跑一遍：写了 place 就该挪过去
  const world = { pins: { c1: "王府" }, regions: [{ terrain: "城郭", nodes: [{ name: "王府" }, { name: "宣南坊市" }] }] };
  const hit = MK.liveNodeOf(world, { id: "c1" }, { title: "去买些吃食", location: "南街口那家铺子", place: "宣南坊市" });
  assert.equal(hit.node, "宣南坊市");
  assert.equal(hit.live, true);
  // 没写 place、细地点也对不上：老实退回落脚点，并把对不上的那个名字说出来
  const miss = MK.liveNodeOf(world, { id: "c1" }, { title: "盯着砂锅", location: "小厨房" });
  assert.equal(miss.node, "王府");
  assert.equal(miss.live, false);
  assert.equal(miss.miss, "小厨房");
});

test("他住在哪套世界：钉进哪个架空世界，就住在那个世界", () => {
  const worlds = [{ id: "w1", name: "大晏", pins: { c1: "宣南坊市" }, regions: [{ terrain: "城郭", nodes: [{ name: "宣南坊市" }] }] }];
  // 王爷同时钉了温尼伯和一个架空世界 → 算他住在架空那边
  const r = MK.charRealm({ id: "c1", home: { city: "温尼伯", lat: 49.9, lng: -97.1 } }, worlds);
  assert.equal(r.kind, "world");
  assert.equal(r.world.id, "w1");
  assert.equal(r.node, "宣南坊市");
  assert.equal(r.terrain, "城郭", "地形没认出来，架空天气就只能按平原算");
  // 没钉进任何世界的，才算住现实
  assert.equal(MK.charRealm({ id: "c2", home: { city: "温尼伯", lat: 49.9, lng: -97.1 } }, worlds).kind, "real");
  assert.equal(MK.charRealm({ id: "c3" }, []).kind, "real");
});

test("现实图不再画住在架空世界里的人", () => {
  // 一个王爷插在温尼伯街上，看着就不对；取消那一钉他自己就回来
  assert.equal((mapSrc.match(/filter\(function \(c\) \{ return charRealm\(c, worlds\)\.kind === "real"; \}\)/g) || []).length, 2,
    "两张现实图（组件 + 整页）没都挡住");
  // ⚠️worlds 得真的传进组件，否则 undefined＝所有人都算住现实，这一层等于没有
  assert.match(mapSrc, /function MapWidget\(\{ characters, status, userGeo, worlds, onOpen \}\)/);
  assert.match(R("components.js"), /MapKit\.MapWidget, \{ characters: characters, status: mapStatus, userGeo: userGeo, worlds: worlds,/);
  // ⚠️人少了要说一声，不然她只会看见「有人不见了」，以为坏了
  assert.match(mapSrc, /住在架空世界里，没画在这张图上（去「架空」那边看；把那边的钉子取消，他就回来）/);
});

test("行程的天气跟着他住的那套世界走", () => {
  // ⚠️一层只写一处：单天和整周两条链共用同一个取法
  assert.equal((app.match(/wline = await schedWeatherLine\(char\);/g) || []).length, 2, "两条链没都换过来");
  const fn = app.slice(app.indexOf("  const schedWeatherLine = async char => {"), app.indexOf("  const mapStatusAll = "));
  assert.match(fn, /realm\.kind === "world" && typeof WorldWeather !== "undefined"/);
  assert.match(fn, /WorldWeather\.dayOf\(realm\.world\.id \+ "\|" \+ realm\.node, realm\.terrain, new Date\(\)\)/);
  assert.match(fn, /char\.home && typeof char\.home\.lat === "number"/, "住现实的那一支不许丢");
  // async 闭包里读的是 ref，不是可能已经过期的那份 state
  assert.match(fn, /worldsRef\.current/);
  assert.match(app, /const worldsRef = useRef\(\[\]\); worldsRef\.current = worlds;/);
});
