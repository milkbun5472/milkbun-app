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
    + "\nreturn { homeSpanHeight, homeSizeOf, homeItemSpan, HOME_ROW_UNIT, HOME_ROW_GAP, HOME_SIZE_DEFAULT };")();
})();

test("N 行＝一个算得出的高度，不再由内容决定", () => {
  assert.equal(F.homeSpanHeight(1), F.HOME_ROW_UNIT);
  assert.equal(F.homeSpanHeight(2), F.HOME_ROW_UNIT * 2 + F.HOME_ROW_GAP);
  assert.equal(F.HOME_ROW_GAP, 8, "这个缝要和主屏网格那一行的 gap 一致，不然算出来的高度对不上");
});

test("挑过尺寸的组件才钉高度；没挑过的（auto）照旧按内容高", () => {
  const seg = comp.slice(comp.indexOf("const fixedH ="), comp.indexOf("let inner;", comp.indexOf("const fixedH =")) + 40);
  assert.match(seg, /homeSize !== "auto" \? homeSpanHeight\(span\[1\]\)/);
  assert.match(comp, /height: fixedH \|\| undefined, overflow: fixedH \? "hidden" : undefined/, "钉了高度却没裁溢出，撑破的还是会顶下去");
});

test("情侣空间和一起听默认就是一条（4×1），不占两行", () => {
  assert.deepEqual(F.HOME_SIZE_DEFAULT, { w_us: "wide", w_music: "wide" });
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
