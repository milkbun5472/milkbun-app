const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const map = fs.readFileSync(path.join(__dirname, "..", "js", "map.js"), "utf8");
const widget = (() => {
  const i = map.indexOf("  function MapWidget({"), j = map.indexOf("  // 真·地点搜索", i);
  assert.ok(i > 0 && j > i && j - i < 3000, "抠不出主屏那个地图组件");
  return map.slice(i, j);
})();

// 她 2026-08-30：「把好友地图那一大块标题删了吧」——
// 那块白渐变盖掉了地图上沿快 50px，而组件本来就是一张地图，不用再写一遍它是地图
test("主屏地图组件上不再压一块标题", () => {
  const code = widget.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(!/"好友地图"/.test(code), "标题又加回来了");
  assert.ok(!/此刻的位置|点开给角色设定城市/.test(code), "标题底下那行小字也该一起走");
  assert.ok(!/linear-gradient\(180deg,rgba\(255,255,255,0\.85\)/.test(code), "盖住上沿的那块白渐变还在");
});

test("标题删了，主题色那个变量也别留成零引用", () => {
  assert.ok(!/const t = \(typeof useTheme === "function"\)/.test(widget), "MapWidget 里还留着没人用的 t");
  // 地图本身该留的都留着
  assert.match(widget, /h\(MapCanvas, \{ pins: pins/);
  assert.match(widget, /aspectRatio: "1 \/ 1"/, "组件的方形比例不许动");
});
