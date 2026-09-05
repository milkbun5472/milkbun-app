// v62.63 审美审计（2026-09-04）点名小剧场那七页：
// 「S.wrap 是 t.bg 平色；**自写顶栏 S.top 不走 Head**，返回键是字符 ←，
//   padding 只有 4px、没有 40px 可点区；纸条以外整页米白 + 通用顶条。」
//
// 判据：这一页原样搬到别的 app 里还成立，它就是坏了。
// 米白 + 圆角 16 卡 + 三列圆角格子，搬到哪儿都成立；
// 打字机纸、场记板、订书钉、留白边的剧照，只有排练场会长成这样。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const SRC = fs.readFileSync("js/theater.js", "utf8");
const NOC = SRC.split("\n").map(l => l.split("//")[0]).join("\n");

test("顶栏一律走公共 Head，不再自写一条", () => {
  // mobile-ui-layout §1：那条紧凑栏就是 Head，改一处七个页面一起合规
  assert.match(NOC, /const header = title => h\(Head, \{/);
  assert.match(NOC, /zh: title, onBack: back, bg: "transparent"/);
  // 自写那条连同它的样式一起删干净
  assert.doesNotMatch(NOC, /S\.top/);
  assert.doesNotMatch(NOC, /S\.h1/);
  // 那个 18px 的「←」字符（可点区只有几个像素）不许再出现
  assert.doesNotMatch(NOC, /fontSize: 18, color: t\.ink, background: "none", border: "none", padding: "0 4px" \} \}, "←"\)/);
});

test("底是纸，不是一块平色", () => {
  assert.match(NOC, /pageSkin\("paper", t, \{ strength: \.7 \}\)/);
  // 七页共用这一个 wrap，所以铺一次就够；但 z 序那一层不能被并没了
  assert.match(NOC, /wrap: Object\.assign\(\{ position: "fixed", inset: 0, zIndex: 60/);
});

test("一条 if 线是钉起来的稿子：方角 + 装订线 + 两枚订书钉", () => {
  assert.match(NOC, /card: \{ margin: "10px 14px 0", padding: "13px 13px 13px 20px", borderRadius: 2/);
  assert.match(NOC, /const staples = \(\) => h\("div"/);
  // ⚠️钉子是绝对定位的装饰片，S.card 上必须有 position:relative，
  //   少了那一句它会跑到页面左上角去
  assert.match(NOC, /borderRadius: 2, background: "rgba\(255,255,255,\.5\)", border: "1px solid " \+ t\.line, position: "relative"/);
  // 三处用 S.card 的地方都得摆上钉子，漏一处那一张就是散页
  assert.equal((NOC.match(/style: S\.card \}, staples\(\)/g) || []).length, 3);
});

test("入口有场记板：这一页搬不到别的 app 去", () => {
  assert.match(NOC, /const clapper = h\("div"/);
  // 活动臂那排斜条纹是拍板最认得出的记号，而且是画出来的
  assert.match(NOC, /repeating-linear-gradient\(72deg, #2b2721 0 15px, #f2ece1 15px 30px\)/);
  assert.match(NOC, /\[clapper\]\.concat\(props\.characters\.map\(charRow\)\)/);
});

test("剧照是留白边的相片，不是三列圆角格子", () => {
  assert.doesNotMatch(NOC, /aspectRatio: "1 \/ 1", borderRadius: 8, overflow: "hidden"/);
  assert.doesNotMatch(NOC, /aspectRatio: "1 \/ 1", borderRadius: 12, overflow: "hidden"/);
  // 相纸底下那条窄边上写编号——剧照就是这么编档的
  assert.match(NOC, /String\(xi \+ 1\)\.padStart\(2, "0"\)/);
  assert.match(NOC, /border: "4px solid #fbf8f2"/);
});
