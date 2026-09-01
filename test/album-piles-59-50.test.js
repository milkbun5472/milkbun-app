const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ph = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const view = ph.slice(ph.indexOf("function AlbumView("), ph.indexOf("function ReadingView("));

// 她 2026-09-01：「选的相册叫个人收藏、最近保存、最近删除、私密这些也都是照抄，
// 甚至都叫精选集」。那是别人家系统相册的词表，一个字都不该留。
test("五摞和三个页签都换成他自己的说法", () => {
  ["个人收藏", "最近保存", "最近删除", "精选集", "收藏夹", "图库"].forEach(bad => {
    const i = view.indexOf('"' + bad + '"');
    // 只允许出现在 canon() 的旧标签映射里（老存档得认得出）
    if (i >= 0) assert.match(view.slice(Math.max(0, i - 260), i + 40), /const canon = v => \{|旧标签必须继续认得出|"回忆": "memory"/,
      "「" + bad + "」还在界面上用着");
  });
  ["总翻出来看的", "舍不得删的", "从别处存下来的", "锁起来的", "删了又没真删的"].forEach(good =>
    assert.match(view, new RegExp('label: "' + good + '"'), "没有「" + good + "」这一摞"));
  assert.match(view, /\["library", "全部"\], \["collections", "他的几摞"\], \["saved", "我收着的"\]/, "页签还叫着别人家那三个");
  // ⚠️五个 key 一个都不许改：回收站 30 天、五类保底、私密走 hidden 档都靠它们
  ["memory", "favorite", "saved", "private", "deleted"].forEach(k =>
    assert.match(view, new RegExp('key: "' + k + '"'), "把 key 也改了，回收站和保底那几条规矩会一起塌"));
  // 老存档翻开必须还是分好的
  ["个人收藏", "最近保存", "最近删除", "私密", "回忆"].forEach(old =>
    assert.match(view, new RegExp('"' + old + '": "'), "canon 认不出旧标签「" + old + "」，老照片会全部掉进没分类"));
  // iOS 蓝
  assert.ok(view.indexOf("#0a84ff") < 0, "还留着别人家那个蓝");
});

test("五摞竖着排，藏起来的那两摞在最前", () => {
  assert.ok(view.indexOf("const memoryCard = ") < 0, "横滑大卡还在");
  assert.ok(view.indexOf("const albumCard = ") < 0, "横滑小卡还在");
  const i = view.indexOf("const collections = ");
  const seg = view.slice(i, view.indexOf("const favorites", i));
  assert.ok(seg.indexOf("overflow-x-auto") < 0, "这一页还是横着滑的");
  assert.match(view, /const pileRow = a => \{/, "没有一行一摞");
  assert.match(seg, /b\.key === "deleted" \|\| b\.key === "private"/, "藏起来的那两摞没排到最前");
  // 「删了又没真删的」要说还剩几天——系统相册只会管它叫「最近删除」
  assert.match(view, /const dayLeft = p => \{/, "没算还剩几天");
  assert.match(view, /"还有 " \+ soon \+ " 天就真的没了"/, "没把还剩几天说出来");
});
