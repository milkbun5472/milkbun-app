const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const map = fs.readFileSync(path.join(__dirname, "..", "js", "map.js"), "utf8");
const widget = (() => {
  const i = map.indexOf("  function MapWidget({"), j = map.indexOf("  // 真·地点搜索", i);
  assert.ok(i > 0 && j > i && j - i < 6000, "抠不出主屏那个地图组件");
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

// v63.08（她 2026-09-05：「这几个组件也改改样式，太普通了」）：
// 原来就是把 Esri 的街道瓦片直接嵌进一个圆角方框——那个东西换到任何 app 里都成立。
// 现在它是一张【摊开过的旧海图】。判词对着这几件真东西问，不是对着"有没有改过"问。
test("主屏那张地图是一张摊开过的旧海图，不是一块生瓦片", () => {
  assert.match(widget, /filter: "sepia\(\.24\)/, "瓦片没压成旧纸的色");
  assert.match(widget, /linear-gradient\(90deg,transparent calc\(50% - 1\.2px\)/, "竖折痕没了");
  assert.match(widget, /linear-gradient\(180deg,transparent calc\(50% - 1\.2px\)/, "横折痕没了");
  assert.match(widget, /className: "active:opacity-90 text-left wk-mapwidget"/, "少了 wk-mapwidget 这个钩子，版权那行会横穿整张图");
  // 罗盘：北针一半上墨一半留白，是画出来的，不是一个字符
  assert.match(widget, /M17 3\.5 20\.4 17 17 30\.5 13\.6 17Z/, "罗盘没了");
});

test("空态不许用 emoji 当图标", () => {
  const bad = [...widget].filter(ch => { const c = ch.codePointAt(0); return c >= 0x1f000 && c <= 0x1ffff; });
  assert.equal(bad.join(""), "", "她机器上 emoji 会渲成豆腐块");
  assert.match(widget, /"还没有人在图上"/, "空态得说句人话");
});

// v63.18（她给了参考图：一张浅色纸地图，上面按着一枚红图钉）
test("「我在这儿」在纸地图上是一枚图钉，不是一个蓝点", () => {
  assert.match(widget, /mePinHtml\(24\)/, "主屏那张还在用蓝点");
  const map2 = fs.readFileSync(path.join(__dirname, "..", "js", "map.js"), "utf8");
  assert.match(map2, /function mePinHtml\(size\)/);
  // 全屏那张是真在导航，蓝点才是对的语言——不许一起换掉
  assert.match(map2, /pins\.push\(\{ pos: livePos, size: 22, html: meDotHtml\(20\)/, "全屏那张的蓝点被一起换掉了");
});
