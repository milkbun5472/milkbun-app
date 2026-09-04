// v62.28 她 2026-09-04 问的两件事 + 桌面装饰的一次清理
//   ①「天气这个能查别的地方的天气吗」→ 角色设了家乡就能看他那边
//   ②「如果要架空的地图怎么安排天气呢」→ 按世界 id + 地方名 + 那一天算，一枪不花
//   ③「删吧宝宝」＋「拼贴风格 collage：一块长板然后里面的图切成几条」
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const W = require("../js/world-weather.js");

const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const html = fs.readFileSync(__dirname + "/../index.html", "utf8");

test("架空天气同一处同一天永远算出同一份", () => {
  const d = new Date(2026, 8, 4);
  const a = W.dayOf("w1|北岭", "山地", d);
  const b = W.dayOf("w1|北岭", "山地", d);
  assert.deepStrictEqual(a, b);
  assert.ok(a.lo <= a.t && a.t <= a.hi);
});

test("换一块地方、换一天就该不一样，否则整个世界一个天气", () => {
  const d = new Date(2026, 8, 4);
  const week = W.forecast("w1|北岭", "山地", d, 7);
  assert.strictEqual(week.length, 7);
  assert.ok(new Set(week.map(x => x.code + ":" + x.hi)).size > 1, "七天不该一模一样");
  const other = W.dayOf("w1|泥沼", "水泽", d);
  assert.notDeepStrictEqual(W.dayOf("w1|北岭", "山地", d), other);
});

test("荒漠比水泽热、水泽比荒漠湿——地形真的进了算式", () => {
  assert.ok(W.climateOf("荒漠").base > W.climateOf("水泽").base);
  assert.ok(W.climateOf("水泽").wet > W.climateOf("荒漠").wet);
  assert.deepStrictEqual(W.climateOf("没写"), W.climateOf("平原"), "认不出的地形退回平原，不许算出 NaN");
});

test("架空天气的形状必须和真实天气一样，天气详情页才不用分叉", () => {
  const hrs = W.hours("w1|北岭", "山地", new Date(2026, 8, 4, 9), 24);
  assert.strictEqual(hrs.length, 24);
  for (const x of hrs) {
    for (const k of ["h", "t", "p", "code"]) assert.ok(Number.isFinite(x[k]), k + " 得是数");
  }
  const day = W.forecast("w1|北岭", "山地", new Date(), 7)[0];
  assert.ok(day.d instanceof Date && Number.isFinite(day.hi) && Number.isFinite(day.lo));
});

test("x_worlds 摊成地方时，字段名照写它那段代码抄", () => {
  // .claude/rules/stub-from-the-writer.md：桩照【写存档的那段】写。
  // app.js 的 genWorld 存的是 {id,name,regions:[{name,terrain,nodes}]}
  assert.match(app, /const next = \{ id: wid, name: nm, brief: bf, prompt: brief, regions/);
  const ps = W.placesOf([{ id: "w1", name: "雾泽", regions: [{ name: "北岭", terrain: "山地" }] }]);
  assert.strictEqual(ps.length, 1);
  assert.strictEqual(ps[0].label, "北岭");
  assert.strictEqual(ps[0].sub, "雾泽");
  assert.strictEqual(ps[0].terrain, "山地");
  assert.deepStrictEqual(W.placesOf(null), []);
});

test("能看的地方＝我这儿 + 设了家乡的角色 + 架空世界的每一块地方", () => {
  const fn = comp.slice(comp.indexOf("function weatherPlaceList"), comp.indexOf("function WeatherTagRail"));
  // char.home 的字段名照 map.js 的 onSetHome 写的那份抄
  const map = fs.readFileSync(__dirname + "/../js/map.js", "utf8");
  assert.match(map, /onSetHome\(sel, \{ city: name, lat: c\[0\], lng: c\[1\] \}\)/);
  assert.match(fn, /c\.home\.lat !== "number"/);
  assert.match(fn, /c\.home\.city/);
  assert.match(fn, /WorldWeather\.placesOf\(worlds\)/);
  assert.match(comp, /localStorage\.setItem\("x_weatherPlace"/, "选了谁那边就该留着，下次开还是他那边");
  assert.match(comp, /h\(WeatherWidget, \{ userGeo: userGeo, characters: characters, worlds: worlds/);
  assert.match(app, /React\.createElement\(Home, \{\n    now: now,\n    characters: liveChars,\n    worlds: worlds,/);
  assert.match(html, /js\/world-weather\.js\?v=/);
});

test("选地方那一排不是一排药丸", () => {
  // tabs-not-plain-pills.md：换个 app 还成立的形状就是没设计。这是气象站挂牌的杆子。
  const rail = comp.slice(comp.indexOf("function WeatherTagRail"), comp.indexOf("function WeatherWidget"));
  const tag = rail.split("\n").filter(l => /minWidth: 52/.test(l)).join("\n");
  assert.ok(tag, "牌子本体那一行找不到了");
  assert.doesNotMatch(tag, /borderRadius: 999/, "整块牌子不许是药丸");
  assert.match(rail, /borderRadius: "2px 2px 8px 8px"/, "上方下圆＝挂牌");
  assert.match(rail, /height: on \? 14 : 7/, "选中那块吊得更低——不能只靠填色区分");
  assert.match(rail, /fontSize: on \? 12 : 11/);
});

test("拼贴长板：图是被裁开的一张，不是并排的五张", () => {
  const render = comp.slice(comp.indexOf("function HomeDecorItem"), comp.indexOf("function HomePresetGrid"));
  const frames = comp.slice(comp.indexOf("const HOME_PHOTO_FRAMES"), comp.indexOf("function homePhotoSlotCount"));
  assert.match(frames, /id: "slats5"[\s\S]*need: 1/);
  assert.match(frames, /id: "weave3"[\s\S]*need: 3/);
  assert.match(render, /frame === "slats5" \|\| frame === "weave3"/);
  // 每条里装的是整张图再往左推，不是每条各自 cover 一遍
  assert.match(render, /left: \(-i \* 100\) \+ "%", width: \(of \* 100\) \+ "%"/);
  assert.match(render, /slatOff/, "条与条之间要错开，缝没了就又变回一张普通照片");
  assert.match(comp, /decorDraftFrame === "slats5" \|\| decorDraftFrame === "weave3"\) \? "wide"/, "长板默认就该是 4×1");
});
