// 一起读的批注删不掉（她 2026-09-20）。
//
// 原来这一册【只能看】：整个「一起读」里能删的只有书架上长按封面那一处，删的是【整本】，
// 连正文一起扔。写错一条、不想要 TA 那句讲解，唯一的办法是把整本书删了重传。
//
// 现在两处都能长按删：正文页上那张卡片（她看见它的地方），批注册里那一行（索引）。
// 长按那套机制抽成公共一份（useLongPress），书架也搬过去了——形状出现第二处就抽出来，
// 不许照着旧的再写一遍（施工规则/one-public-mechanism.md）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = fs.readFileSync(path.join(__dirname, "..", "js", "read.js"), "utf8");

// 切片两头钉函数名（anchor-on-code.md）
function grab(startMark, endMark) {
  const i = read.indexOf(startMark), j = read.indexOf(endMark, i);
  assert.ok(i > 0 && j > i, "抠不出 " + startMark);
  return read.slice(i, j);
}

test("讲解按【页_段】那个键删，批注按坐标＋时间戳删", () => {
  const fn = grab("const dropAnnoRow = function (r) {", "const gotoPage = function (idx)");
  // 讲解存在 explains 的「页_段」键上
  assert.match(fn, /delete ex\[r\.page \+ "_" \+ r\.para\]/, "讲解没按它真正的存法删");
  // ⚠️批注没有 id：页＋段＋时间戳＋是谁写的，四样一起认
  assert.match(fn, /\(a\.page \|\| 0\) === r\.page && \(a\.para \|\| 0\) === r\.para && \(a\.ts \|\| 0\) === r\.ts && \(a\.who \|\| ""\) === r\.who/,
    "批注的身份认得不够严，删一条会连坐");
  // 两种来路各删各的：别先拍平再整份写回去，那会把没删的那些一起重写
  assert.match(fn, /annotations: \(b\.annotations \|\| \[\]\)\.filter/, "批注不是按条过滤删的");
  assert.ok(!/explains: \{\}/.test(fn), "把 explains 整份清空了");
});

test("row 身上要带得走身份，不然删的时候认不出是哪一条", () => {
  const rows = grab("(book.annotations || []).forEach(function (a) {", "Object.keys(book.explains");
  assert.match(rows, /who: a\.who \|\| ""/, "who 没带上——你记的和 TA 写的会互相误删");
  assert.match(rows, /ts: a\.ts \|\| 0/, "时间戳没带上");
});

test("两处都能删：正文页上那张卡片，和批注册里那一行", () => {
  // 正文页：讲解卡片 + 批注卡片（v72.08 起走全库那一份 useLongPressMenu）
  assert.match(read, /pagePressProps\(function \(\) \{\s*requestAppConfirm\("删掉这条讲解？"/, "正文页上的讲解卡片长按没反应");
  assert.match(read, /requestAppConfirm\(a\.who === "user" \? "删掉你记的这条？" : "删掉这条批注？"/, "正文页上的批注卡片长按没反应");
  // 批注册：每一行
  assert.match(read, /useLongPressMenu\(function \(r\) \{ askDropRow\(r\); \}\)/, "批注册里那一行长按没反应");
  assert.match(read, /const askDropRow = function \(r\) \{/, "批注册没有自己那句确认文案");
  // 删之前必须问一句——这是会让东西消失的动作
  assert.equal((read.match(/requestAppConfirm\(/g) || []).length, 4, "有哪一处删东西没先问一句，或者又多写了一份确认");
});

test("批注册上要告诉她能删", () => {
  // 「长按封面可移除」那行字当初就是这么留的：手势看不见，就得写出来
  assert.match(read, /长按一条可删/, "不写出来的话，这个功能对她等于不存在");
});
