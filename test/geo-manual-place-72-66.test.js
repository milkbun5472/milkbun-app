// 她 2026-09-22 转来的：有人把位置手改到东京，显示成「东京 · 江苏 · 中国」，
// 地图上人还在广东。病根是【文字标签】和【经纬度】各改各的 ——
// 手填只换了标签里城市那一段，省国是上一次反查留下的，坐标压根没动，
// 而地图、天气、「没设家乡的角色撒在你附近」读的全是坐标。
//
// 这一份钉死：手填位置走的是【地名→坐标→标签】这一条路，坐标和标签一起换；
// 拼标签只有 geoLabelOf 一处；地名→坐标只有 geoSearch 一处（地图那边转手用它）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const P = f => fs.readFileSync(__dirname + "/../" + f, "utf8");
const eng = P("js/engine.js"), map = P("js/map.js"), app = P("js/app.js"), screens = P("js/screens.js");

// engine.js 整份太大，只把这三支抠出来跑
function loadGeo(fetchImpl) {
  const i = eng.indexOf("async function geoLookup(");
  const j = eng.indexOf("async function requestGeo()");
  assert.ok(i > 0 && j > i, "抠不出定位那一段");
  const ctx = { fetch: fetchImpl, console, Date, JSON, Number, String, isNaN, encodeURIComponent, Error, loadJSON: () => null };
  vm.runInNewContext(eng.slice(i, j) + "\nthis.geoLabelOf = geoLabelOf; this.geoSearch = geoSearch; this.geoFromPlace = geoFromPlace;", ctx);
  return ctx;
}
const ok = body => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

test("手填地名：坐标和标签一起换，省国跟着新坐标走", async () => {
  const calls = [];
  const g = loadGeo(url => {
    calls.push(url);
    if (url.indexOf("nominatim") >= 0) return ok([{ display_name: "東京都, 日本", lat: "35.6895", lon: "139.6917" }]);
    // 反查拿到的是【新坐标】那一边的省国，不是旧的江苏·中国
    return ok({ city: "东京", principalSubdivision: "东京都", countryName: "日本" });
  });
  const r = await g.geoFromPlace("东京", [23.1, 113.3]);   // near = 广东那台设备
  assert.equal(r.label, "东京 · 东京都 · 日本", "标签还是旧的省国 —— 东京又被收归祖国了");
  assert.ok(Math.abs(r.lat - 35.6895) < 1e-6 && Math.abs(r.lng - 139.6917) < 1e-6, "坐标没换 —— 地图上人还在原地");
  assert.equal(r.manual, true, "没标成手填的，别处就不知道该躲开自动刷新");
  assert.ok(calls.some(u => u.indexOf("nominatim") >= 0) && calls.some(u => u.indexOf("reverse-geocode") >= 0),
    "两步得都走：先查坐标，再按新坐标拼标签");
});

test("查不到 / 空的：说一句，不许悄悄写进去", async () => {
  const g = loadGeo(url => url.indexOf("nominatim") >= 0 ? ok([]) : ok({}));
  assert.match((await g.geoFromPlace("这个地方不存在")).error, /查不到/);
  assert.match((await g.geoFromPlace("  ")).error, /地名/);
  const bad = loadGeo(() => Promise.reject(new Error("offline")));
  assert.match((await bad.geoFromPlace("东京")).error, /没连上/);
});

test("反查只有一处，设备定位和日记那两路都走它", () => {
  assert.equal((eng.match(/reverse-geocode-client/g) || []).length, 1, "又有第二处自己去反查了");
  // 日记那一处原来自己读一次 GPS、自己反查 —— 她挪到东京了它也不知道
  const a = eng.indexOf("async function fetchLocalEnv()"), bnd = eng.indexOf("async function scenePhotoBrief(", a);
  assert.ok(a > 0 && bnd > a, "抠不出 fetchLocalEnv");   // 切歪了会一路切到文件尾，红得像真回退
  const fe = eng.slice(a, bnd);
  assert.match(fe, /const mine = geoNow\(\);/, "日记那一处还在自己读 GPS，不认她手填的位置");
  assert.match(fe, /const g = await geoLookup\(lat, lon\);/, "日记那一处没走公共那处反查");
  const rq = eng.slice(eng.indexOf("async function requestGeo()"), eng.indexOf("// mood decay"));
  assert.match(rq, /label: await geoLabelOf\(latitude, longitude\)/, "设备定位那一路没走公共那处");
});

test("地名→坐标只有一处，地图那边是转手", () => {
  assert.equal((map.match(/nominatim\.openstreetmap\.org/g) || []).length, 0, "地图那边还留着自己那份 fetch");
  assert.match(map, /function nomSearch\(q, near, signal\) \{ return window\.geoSearch\(q, near, signal\); \}/);
  assert.equal((eng.match(/nominatim\.openstreetmap\.org/g) || []).length, 1);
});

// ⚠️手填之后最容易被悄悄按回去的两处
test("手填过就不许被自动定位顶掉", () => {
  const i = app.indexOf("打开好友地图时刷新一次真实 GPS");
  const seg = app.slice(i, app.indexOf("---- 线下模式", i));
  assert.match(seg, /if \(geo && geo\.manual\) return;/, "开地图那一刷会把她填的东京按回真实位置");
  assert.match(screens, /if \(v && !\(geo && geo\.manual\)\) onRequestGeo\(\);/, "位置感知开关一开就把手填的顶掉了");
});

test("界面：手填一栏在、按钮点得着、标出是手填的", () => {
  assert.match(screens, /onSetGeoPlace/, "没把入口接上");
  assert.match(app, /const doSetGeoPlace = async name => \{/, "app 那头没有这个动作");
  assert.match(app, /const g = await geoFromPlace\(name, near\)/, "没走公共那条路");
  assert.match(app, /onSetGeoPlace: doSetGeoPlace/, "没传给设置页");
  assert.match(screens, /geo\.manual \? "回到设备定位" : "重新获取定位"/, "手填之后没有退回去的路");
  assert.match(screens, /（你手填的）/, "界面上看不出现在这个位置是手填的");
  // 移动端：可点区域不低于 40px（施工规则/mobile-ui-layout）
  const i = screens.indexOf("换个地方，比如 东京");
  const seg = screens.slice(i - 400, i + 900);
  assert.equal((seg.match(/minHeight: 40/g) || []).length, 2, "输入框或按钮没到 40px");
});
