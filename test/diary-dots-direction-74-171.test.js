// 她 2026-09-27：「最新的日记下面的点是最左边的，而不是正确应该在右边跟小说一样」。
// 病根是两条方向对着干：
//   · 列表 all 是【新→旧】，刻度原来直接 all.map → 最左那颗＝最新
//   · 滑动是「手指从右往左＝翻到更新的一天」（她 2026-08-30 定的，照读书来）
// 于是手指往左划、亮着的那颗也往左跑。这一条把【两边同向】钉住。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

// 只切日记全文那一段：两头都钉函数名/常量名（施工规则/anchor-on-code）
const i = src.indexOf("const sortByDay = list =>");
const j = src.indexOf("function MyWallet(", i);
assert.ok(i > 0 && j > i, "抠不出日记全文那一段");
const seg = src.slice(i, j);

test("列表本身照旧是新→旧（这一条没动）", () => {
  assert.match(seg, /Number\(\(b && b\.ts\) \|\| 0\) - Number\(\(a && a\.ts\) \|\| 0\)/);
  assert.match(seg, /const newerE = all\[at - 1\]/);
  assert.match(seg, /const olderE = all\[at \+ 1\]/);
});

test("滑动方向照旧：从右往左＝翻到更新的一天", () => {
  assert.match(seg, /if \(dx < 0\) goTo\(newerE, "fwd"\); else goTo\(olderE, "back"\);/);
});

test("刻度画成旧→新：最右那颗才是最新的一天", () => {
  assert.match(seg, /win\.slice\(\)\.reverse\(\)/, "没反过来画，最左那颗就还是最新");
  assert.match(seg, /const hot = win\.length - 1 - \(at - from\)/, "亮哪颗要跟着一起换算");
  assert.ok(!/all\.slice\(0, 12\)\.map/.test(seg), "旧的那一行要撤掉");
});

// 把那段算法抠出来真跑一遍：手指往左划（去更新的一天），亮着的那颗必须往【右】走
test("翻到更新的一天，亮着的那颗往右走", () => {
  const pick = (n, at) => {
    const DOTS = 12;
    const from = Math.min(Math.max(0, at - Math.floor(DOTS / 2)), Math.max(0, n - DOTS));
    const win = n - from < DOTS ? n - from : DOTS;
    return { from, hot: win - 1 - (at - from), win };
  };
  // 9 篇（她截图里那种）：最新那篇 at=0，亮的应该是最后一颗
  let r = pick(9, 0);
  assert.equal(r.hot, r.win - 1, "最新的一篇，点该在最右");
  // 最旧那篇：点在最左
  r = pick(9, 8);
  assert.equal(r.hot, 0, "最旧的一篇，点该在最左");
  // 往更新的一天翻（at 变小），hot 必须变大＝往右
  assert.ok(pick(9, 3).hot > pick(9, 4).hot, "翻到更新的一天，点却没往右走");
});

test("翻过第 12 篇也还有一颗亮着（原来一颗都不亮）", () => {
  const n = 30, at = 20, DOTS = 12;
  const from = Math.min(Math.max(0, at - 6), Math.max(0, n - DOTS));
  const winLen = Math.min(DOTS, n - from);
  const hot = winLen - 1 - (at - from);
  assert.ok(hot >= 0 && hot < winLen, "第 21 篇上一颗都不亮");
});
