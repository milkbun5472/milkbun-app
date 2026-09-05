// 天气那一排（她 2026-09-05：「如果开了一个架空地图全部地点都变成 tab，
// 改成还是显示那个世界然后点那个 tab 才展示它世界里地点的 subtab」）。
// 一张地图画了十几个坊市，横杆上就横着挂十几块牌，翻到底才找得到人在哪儿。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

// 纯函数抠出来真跑
const levels = (() => {
  const a = comp.indexOf("function weatherRailLevels(places, pick) {");
  const b = comp.indexOf("// 观测牌：一根横杆", a);
  assert.ok(a > 0 && b > a, "抠不出 weatherRailLevels");
  return new Function(comp.slice(a, b) + "\nreturn weatherRailLevels;")();
})();

const PLACES = [
  { key: "me", kind: "geo", label: "我这儿" },
  { key: "c:c1", kind: "char", label: "裴照川" },
  { key: "w:w1:朱雀禁中", kind: "world", label: "朱雀禁中", sub: "大晏", terrain: "城郭" },
  { key: "w:w1:宣南坊市", kind: "world", label: "宣南坊市", sub: "大晏", terrain: "城郭" },
  { key: "w:w1:西山别苑", kind: "world", label: "西山别苑", sub: "大晏", terrain: "山地" },
  { key: "w:w2:落霞城", kind: "world", label: "落霞城", sub: "云荒", terrain: "平原" }
];

test("横杆上挂的是【世界】，一个世界只占一块牌", () => {
  const r = levels(PLACES, "me");
  assert.equal(r.top.map(x => x.label).join("|"), "我这儿|裴照川|大晏|云荒", "还是把地点全铺在横杆上");
  assert.equal(r.top.filter(x => x.kind === "worldGroup").length, 2);
  assert.equal(r.top.find(x => x.label === "大晏").sub, "3 处", "没说清这个世界里有几处");
  assert.deepEqual(r.sub, [], "没选世界的时候底下不该垂着东西");
});

test("选中某一处时，横杆上亮的是它所在的世界，底下垂出这个世界的几处", () => {
  const r = levels(PLACES, "w:w1:宣南坊市");
  assert.equal(r.topValue, "W:w1", "横杆上没跟着亮起那个世界");
  assert.equal(r.sub.map(x => x.label).join("|"), "朱雀禁中|宣南坊市|西山别苑", "底下垂的不是这个世界的地方");
  assert.ok(r.sub.every(x => String(x.key).indexOf("w:w1:") === 0), "串进了别的世界的地方");
});

test("点世界那块牌＝进它的第一处；选中的 key 照旧是【具体那一处】", () => {
  // ⚠️下游（存哪一处、天气怎么算）全靠这个 key，分级只在这一层做
  const g = levels(PLACES, "me").top.find(x => x.label === "大晏");
  assert.equal(g.first, "w:w1:朱雀禁中");
  assert.match(comp, /if \(String\(k\)\.indexOf\("W:"\) !== 0\) \{ choose\(k\); return; \}/);
  assert.match(comp, /if \(g && g\.first\) choose\(g\.first\);/);
  // 我这儿 / 某个人那边照旧直接选
  assert.equal(levels(PLACES, "c:c1").topValue, "c:c1");
});

test("底下那一排跟上面【不是同一个形状】", () => {
  // 两排长得一样的话，看着就是两排 tab，分级也就白分了
  const sub = comp.slice(comp.indexOf("function WeatherSubRail({"), comp.indexOf("function WeatherWidget({"));
  assert.ok(sub.length > 400, "抠不出 WeatherSubRail");
  assert.doesNotMatch(sub, /borderRadius: "2px 2px 8px 8px"/, "照抄了上面那排吊牌的形状");
  assert.match(sub, /borderBottom: on \? "2px solid /, "选中态没有形状上的差别");
  // 上面那排的穿绳孔不许出现在下面这排
  assert.doesNotMatch(sub, /穿绳孔/);
});
