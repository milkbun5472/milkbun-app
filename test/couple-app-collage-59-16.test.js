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
  // ⚠️别把具体比例冻死，调一次就红。只核【它是按比例留的位置】，不是写死高度。
  assert.match(collage, /paddingTop: "\d+%"/, "合照那张没按相纸比例留位置");
  assert.match(collage, /transform: "rotate\(-2\.2deg\)"/, "照片没歪着贴");
  // 票根＝竖的撕线 + 两端半圆缺口 + 右边一截存根
  // ⚠️横穿的虚线会正好压在字上（第一版就是这么翻的），所以撕线必须是竖的
  assert.match(collage, /borderLeft: "1px dashed rgba\(150,125,80,\.4\)"/, "票根没有那条竖撕线");
  assert.ok(!/borderTop: "1px dashed rgba\(150,125,80/.test(collage), "撕线又画成横的了，会压在字上");
  assert.equal((collage.match(/borderRadius: 999, background: t\.bg/g) || []).length, 2, "撕线两端没有半圆缺口");
  assert.match(collage, /width: 58, flexShrink: 0, textAlign: "center"/, "票根右边那截存根没了");
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

// v59.25 情侣空间整页崩：bLetterLast 用 itemTs 当 sort 的比较器，可它写在 itemTs
// 【前面】——const 有 TDZ。而 .sort() 只有【两条以上】才会调比较器，所以只有一封信
// 的时候一切正常，两封以上一进页面就 ReferenceError。
// ⚠️这一类错测试和 node --check 都不会说，浏览器桩太干净也照样漏过去。
test("拿别处声明的东西当比较器时，顺序不许反", () => {
  const us = cut(scr, "function Us({", "\n}\n");
  const uses = [...us.matchAll(/const (\w+) = [^\n]*\.sort\(\([^)]*\) => (\w+)\(/g)];
  assert.ok(uses.length >= 1, "抓不到用具名比较器排序的那几行，切歪了");
  uses.forEach(m => {
    const [, name, cmp] = m;
    const declHere = us.indexOf("const " + name + " =");
    const declCmp = us.indexOf("const " + cmp + " =");
    if (declCmp < 0) return;   // 比较器不是本地 const（全局函数没有 TDZ）
    assert.ok(declCmp < declHere,
      "「" + name + "」用了后面才声明的「" + cmp + "」当比较器——两条以上就 TDZ 崩页");
  });
});
