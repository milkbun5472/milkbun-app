// 她 2026-09-13：「补齐两个月，八月先出，七月出来的时候顺手把八月 override 了，
// 相当于重写了一遍八月」。
//
// 写存档那一步本来就是按月份合并的（filter(x => x.monthKey !== monthKey)），真盖不掉。
// 出事的是【喂给模型的那份料】：补齐是一个 await 接一个 await 的长循环，而 book 这个
// state 在闭包里从头到尾不变——后写的那个月压根看不见前面刚写完的那张，于是
// 「往期不许重复」里没有它、prev 也取不到它，两张写出来自然像同一张。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const imp = fs.readFileSync(path.join(__dirname, "..", "js/impression.js"), "utf8");

test("取料一律现读存档，不许再读闭包里那份 book", () => {
  // v67.95：这本册子有两个写手——这一页，和 app.js 里那条自动出卡（它直接 M.load/M.save）。
  // 拿 state 当底合并会把对方刚写的那张抹掉，所以一律以存档现读的那一份为底。
  assert.match(imp, /const liveBook = \(\) => M\.load\(\) \|\| bookRef\.current \|\| \{\};/);
  assert.match(imp, /const put = fn => setBook\(p => \{ const n = fn\(M\.load\(\) \|\| p\);/,
    "合并的底必须是存档，不是 state");
  // 三条写卡的路都从 ref 取料
  assert.match(imp, /M\.genOpts\(liveBook\(\), charId, monthKey, 0\)/, "首次生成/补齐");
  assert.match(imp, /M\.genOpts\(liveBook\(\), charId, entry\.monthKey, turn, entry\)/, "只重写文案");
  assert.match(imp, /M\.genOpts\(liveBook\(\), charId, entry\.monthKey, Number\(entry\.turn \|\| 0\)\)/, "补写背面");
  // 闭包里那份只许用来画界面，不许再进生成
  assert.ok(!/M\.genOpts\(book, charId/.test(imp), "还有一处在读闭包里的 book");
});

test("补齐时已经写过的月份不再重写", () => {
  const seg = imp.slice(imp.indexOf("async function backfill"), imp.indexOf("// ---- 单张卡片"));
  assert.match(seg, /const have = new Set\(\(liveBook\(\)\[charId\] \|\| \[\]\)\.map\(x => x\.monthKey\)\)/,
    "开工前统计哪些月份缺，也得看最新的");
  assert.match(seg, /if \(\(liveBook\(\)\[charId\] \|\| \[\]\)\.some\(x => x\.monthKey === k\)\) \{ done\+\+; continue; \}/,
    "循环里每个月开写前再确认一次");
});

test("写存档那一步照旧只动这一个月（这条没变，钉住）", () => {
  assert.match(imp, /\[entry\]\.concat\(\(p\[charId\] \|\| \[\]\)\.filter\(x => x\.monthKey !== monthKey\)\)/);
  assert.match(imp, /const put = fn => setBook\(p =>/, "写存档必须是函数式更新，不能拿闭包里那份合并");
});
