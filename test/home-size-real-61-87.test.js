// 她 2026-09-03：「我的组件如果改了尺寸，实际占用会不会还是原始的大小？
// 比如情侣空间原来看起来是 4×2，我改成 4×1 还是放不进去一整排空的。」
//
// 是真的：格子占几列几行是按 span 算的，但【行高由内容撑】——挑了 4×1 的组件
// 只要内容有 120px 高，那一行就是 120，看着还是两行、底下那排空位也就用不上。
// 修法：挑过尺寸的组件把高度按行数钉死（rows×82 + 缝），超出的裁掉。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

const F = (() => {
  const i = comp.indexOf("const HOME_ROW_UNIT ="), j = comp.indexOf("function homeWidgetPresetStyle(");
  assert.ok(i > 0 && j > i, "抠不出尺寸那一段");
  const presets = comp.slice(comp.indexOf("const HOME_SIZE_PRESETS = ["), comp.indexOf("// 装饰不是换图标的文字卡"));
  const dflt = comp.slice(comp.indexOf("function defaultHomeItemSpan(it) {"), comp.indexOf("// 一格的高度"));
  return new Function(presets + dflt + comp.slice(i, j)
    + "\nreturn { homeSpanHeight, homeSizeOf, homeItemSpan, HOME_ROW_UNIT, HOME_ROW_GAP, HOME_ROWS_PER_PAGE, HOME_SIZE_DEFAULT };")();
})();

test("N 行＝一个算得出的高度，不再由内容决定", () => {
  assert.equal(F.homeSpanHeight(1), F.HOME_ROW_UNIT);
  assert.equal(F.homeSpanHeight(2), F.HOME_ROW_UNIT * 2 + F.HOME_ROW_GAP);
  // v61.93：行高改成量出来的（把剩下的地方除以 5），常量只是兜底
  assert.equal(F.homeSpanHeight(2, 100), 208);
  assert.equal(F.HOME_ROWS_PER_PAGE, 5);
  assert.equal(F.HOME_ROW_GAP, 8, "这个缝要和主屏网格那一行的 gap 一致，不然算出来的高度对不上");
});

// v61.90 她：「能不能把长度固定了，不给他撑大」——改成一律钉死，只留名片一个例外
test("组件高度一律钉死；只有名片按内容高（它的高度是一版版调出来的）", () => {
  const seg = comp.slice(comp.indexOf("const fixedH ="), comp.indexOf("let inner;", comp.indexOf("const fixedH =")) + 40);
  assert.match(seg, /!HOME_FREE_HEIGHT\[key\] \? homeSpanHeight\(span\[1\], rowUnit\)/);
  assert.match(comp, /const HOME_FREE_HEIGHT = \{ w_card: true \};/);
  assert.match(comp, /height: fixedH \|\| undefined, overflow: fixedH \? "hidden" : undefined/, "钉了高度却没裁溢出，撑破的还是会顶下去");
});

test("2 和 4 之间补了两档 3 格宽的", () => {
  const seg = comp.slice(comp.indexOf("const HOME_SIZE_PRESETS = ["), comp.indexOf("// 装饰不是换图标的文字卡"));
  assert.match(seg, /id: "three", name: "三格条", note: "3 × 1", cols: 3, rows: 1/);
  assert.match(seg, /id: "threetall", name: "三格块", note: "3 × 2", cols: 3, rows: 2/);
});

test("情侣空间和一起听默认就是一条（4×1），不占两行", () => {
  assert.deepEqual(F.HOME_SIZE_DEFAULT, { w_us: "wide", w_music: "wide", w_memo: "wide", w_recent: "large" });
  // 字条夹要能翻，一条的高度只够露一张：它默认就是 4×2（v62.92）
  assert.deepEqual(F.homeItemSpan("w_recent", { kind: "widget", which: "recent" }, {}), [4, 2]);
  assert.deepEqual(F.homeItemSpan("w_us", { kind: "widget", which: "us" }, {}), [4, 1]);
  assert.deepEqual(F.homeItemSpan("w_music", { kind: "widget", which: "music" }, {}), [4, 1]);
  // 她自己挑过的一律听她的
  assert.deepEqual(F.homeItemSpan("w_us", { kind: "widget", which: "us" }, { w_us: "large" }), [4, 2]);
  assert.equal(F.homeSizeOf("w_us", { w_us: "square" }), "square");
  // 别的组件不受这份默认影响
  assert.equal(F.homeSizeOf("w_cal", {}), "auto");
});

test("情侣卡在钉死的格子里撑满、居中，不靠在上边", () => {
  const seg = comp.slice(comp.indexOf("function UsWidget("), comp.indexOf("function MusicWidget("));
  assert.match(seg, /const forced = homeSize && homeSize !== "auto";/);
  assert.match(seg, /height: forced \? "100%" : "auto"/);
  assert.match(comp, /h\(UsWidget, \{[^)]*homeSize: homeSize/, "没把尺寸传给情侣卡，它不知道自己被钉了");
});

// 她 2026-09-03：「任何有英文字母在图上的都要可以编辑换成我要的词」
test("装饰图上印死的那几行英文，全都能换成她要的词", () => {
  const deco = comp.slice(comp.indexOf("function dmark(item, fallback)"), comp.indexOf("function HomePresetGrid("));
  ["EVIDENCE / ", "ARCHIVED", "PHOTO BOOTH", "AIR", "POST", "WEEKEND", "VOL. 01",
    "A SMALL STORY", "CABINET OF MOMENTS", "from somewhere"].forEach(w => {
    const i = deco.indexOf('"' + w + '"');
    assert.ok(i > 0, "找不到这句：" + w);
    assert.ok(deco.slice(Math.max(0, i - 13), i).includes("dmark(item, "), "这句还印死在图上，换不掉：" + w);
  });
  // 存得下、读得回、编辑器里有那一格
  assert.match(comp, /mark: decorDraftMark\.trim\(\)/, "新建装饰没把它存进去");
  assert.match(comp, /mark: styleDecorMark\.trim\(\)/, "改样式时没写回");
  assert.match(comp, /setStyleDecorMark\(d\.mark \|\| ""\);/, "打开样式表时没读回来");
  assert.match(comp, /"图上那行小字（留空＝用这一款自带的）"/, "编辑器里没有这一格");
  // 留空＝用自带的那句（清空之后图上不许留一块空白）
  const fn = comp.slice(comp.indexOf("function dmark(item, fallback)"), comp.indexOf("function HomeDecorItem("));
  assert.match(fn, /return v \|\| fallback;/);
});

// 她 2026-09-03：「备忘录改成 4×1 吧，我自己调会截边」
test("备忘录默认一条；一行高时换成一行说得完的排法，不是把三条硬塞", () => {
  assert.equal(F.HOME_SIZE_DEFAULT.w_memo, "wide");
  const seg = comp.slice(comp.indexOf("function MemoWidget("), comp.indexOf("// 命运转盘"));
  assert.match(seg, /const oneRow = !!\(pr && pr\.rows === 1\);/, "没有按行数分档，4×1 还是会被裁掉");
  assert.match(seg, /"还有 " \+ \(items\.length - 1\) \+ " 条"/, "剩下几条没有交代");
  assert.match(seg, /height: "100%", display: "flex", alignItems: "center"/, "一行那档没有撑满并居中");
  assert.match(comp, /h\(MemoWidget, \{ homeSize: homeSize/, "没把尺寸传给备忘录，它不知道自己只有一行");
});

// 她 2026-09-03：「上面就是 4×2 但是说我放不下去」
test("放不下时先往上挪，挪到顶还压着人才算真的放不下", () => {
  const seg = comp.slice(comp.indexOf("function placeDrop(fromKey, toKey)"), comp.indexOf("这里放不下"));
  assert.match(seg, /var hitsAt = function \(r0\)/, "还是只算落点那一处");
  // v62.01：上下都要找——她那次空着的是【底下】那一行，只往上找照样被拒
  assert.match(seg, /var cand = \[r02 - d, r02 \+ d\];/, "只往一个方向找落点");
  assert.match(seg, /if \(rr < 0 \|\| rr \+ h2 > capR\) continue;/, "没有把找到的行钳在这一页里");
  // 行数一律用量出来的，不许再写死 6
  assert.match(seg, /var capR = Math\.max\(3, rowCapRef\.current \|\| 6\);/);
  assert.ok(!/Math\.min\(tpos\.r, 6 - h2\)/.test(comp), "还留着写死的 6 行");
  assert.ok(!/rows > 6 \|\|/.test(comp), "溢出防线还按写死的 6 行判");
});

test("一页放几行是先定行数再整除，保证正好铺满", () => {
  const seg = comp.slice(comp.indexOf("function measure()"), comp.indexOf("setRowCap("));
  assert.match(seg, /HOME_ROW_MIN/, "没有「一行不小于多少」这条前提");
  assert.match(seg, /var u = Math\.floor\(\(usable - \(n0 - 1\) \* HOME_ROW_GAP\) \/ n0\);/, "不是把剩下的高度整除给这几行");
  assert.ok(!/Math\.min\(120, u\)/.test(comp), "又把一行的高度卡死在 120，高屏上会白空一截");
});

// 她 2026-09-03：「下面那行放不了，右边那个空也不行，都说满了」
test("没把页面变高的挪动，不许被判成「这一页满了」", () => {
  const seg = comp.slice(comp.indexOf("var capTo = Math.max(3, rowCapRef.current"), comp.indexOf("__toast(\"这一页满了"));
  assert.match(seg, /var wasTo = homePlaceDenseXY\(L\[t2\.p\], spanOf\)\.rows;/, "没有拿【挪之前的行数】当底线");
  assert.match(seg, /capTo = Math\.max\(capTo, wasTo\); capFr = Math\.max\(capFr, wasFr\);/);
});
