// 情侣空间那一片的骨架（v59.24 重写）。
// 她 2026-09-01：「我觉得是网格和颜色还有背景的问题，还有太条条框框了都是方框，
// 混着一个圆的。后续我打算继续加内容进去的，再继续叠罗汉好无聊」。
// 前两版都在 bento 里修装饰（换配色、改圆角、加水印字），可病在结构——
// **六列网格每加一格就更糟**，而她明说了以后还要往里加东西。
// 现在是三个面：今天（一块深的）／墙上（贴着的，不对齐）／收着的（一列书脊）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };
const collage = cut(scr, "const wall = (k, o) =>", "只属于你俩的私密层");

test("不再是网格——加一样东西不该让版面更挤", () => {
  // ⚠️这是这一版的全部理由：网格里加第 17 格只会更糟。
  assert.ok(collage.indexOf("gridTemplateColumns") < 0, "又回到网格了");
  assert.ok(collage.indexOf("gridAutoRows") < 0, "又回到网格了");
  // 墙上那一片是 flex-wrap：宽度各是各的，不必对齐到同一套沟槽
  assert.match(collage, /className: "flex flex-wrap"/, "墙上那一片不是自由排的");
  // 收着的那一列是书脊：加一本就是多一行，不撑版面
  assert.match(collage, /const spine = \(k, o\) =>/, "没有书脊那一档");
  assert.ok((collage.match(/spine\("/g) || []).length >= 5, "书脊那一列太少，等于没分层");
});

test("三个面各有各的规矩，不是同一套壳换大小", () => {
  assert.match(collage, /"TODAY"/, "没有「今天」那一块");
  assert.match(collage, /"ON THE WALL"/, "没有「墙上」那一片");
  assert.match(collage, /"KEPT"/, "没有「收着的」那一列");
  // 今天那一块是整页唯一的深色主角
  assert.match(collage, /linear-gradient\(155deg,#7d3f57/, "「今天」那一块没做成深的");
  // ⚠️那个孤零零的圆去掉了：整页十六个方框里混一个正圆，读起来就是随机
  assert.ok(collage.indexOf("radius: 999") < 0 && collage.indexOf("borderRadius: 999, padding") < 0, "又冒出一个圆");
});

test("形状跟着内容走，不是一堆方框", () => {
  // 照片＝照片（白边、歪着、真按比例留位置）
  assert.match(collage, /paddingTop: "112%"/, "合照那张没按相纸比例留位置");
  assert.match(collage, /transform: "rotate\(-2\.2deg\)"/, "照片没歪着贴");
  // 票根＝一条横贯的虚线
  assert.match(collage, /borderTop: "1px dashed rgba\(150,125,80,\.35\)"/, "票根没有那条虚线");
  assert.match(collage, /"NO\." \+ String\(bFirstsN\)/, "票根上没有编号");
  // 抽屉＝一条把手
  assert.match(collage, /wall\("drawer",[\s\S]{0,600}?marginLeft: -21/, "抽屉没有那条把手");
});

test("原有的门一扇都没丢", () => {
  const keys = ["timeline", "album", "letters", "recall", "pacts", "makeup", "ifroom",
    "studio", "firsts", "drawer", "gacha", "qa", "capsule", "exdiary"];
  keys.forEach(k => assert.match(collage, new RegExp('(?:wall|spine)\\("' + k + '"|setSub\\("' + k + '"\\)'), k + " 这一处入口没了"));
  // 便签墙 v59.23 明着删的，别长回来
  assert.ok(collage.indexOf('"notes"') < 0, "便签墙又长回来了");
});
