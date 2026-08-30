const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

// 她 2026-08-30 发了张主屏截图：「你看我其实看不到下面」——日历下面那一排（购物、地方）
// 整个在切口底下。数了一遍是 6 行、24 格，两条容量都没超。
// 病根是【行高不是死的】：名片带 #标签会长十几像素，日历这个月五周还是六周差几十像素，
// 所以「几行」根本换算不出「几像素」，按格数按行数都卡不住。
// 兜底只能是：这一页放不下的时候，它自己能上下滑。
test("每一页自己能上下滑，放不下的东西才够得到", () => {
  const i = comp.indexOf('return h("div", { key: pi, className: "px-6"');
  assert.ok(i > 0, "找不到主屏那一页的外壳了（换了写法就把这条测试一起更新）");
  const decl = comp.slice(i, comp.indexOf("\n", i));
  assert.match(decl, /overflowY:\s*"auto"/, "这一页不能上下滑：内容比屏幕高的时候，底下那排图标就永远够不到");
  assert.match(decl, /overflowX:\s*"hidden"/, "横向也能滑的话会跟翻页手势打架");
});

test("横滑翻页仍然只认横向手势，竖着划不许翻页", () => {
  const i = comp.indexOf("const onTM = e => {");
  const src = comp.slice(i, comp.indexOf("const onTE = () => {", i));
  assert.match(src, /r\.dir\s*=\s*Math\.abs\(dx\)\s*>\s*Math\.abs\(dy\)/, "没有方向锁——上下滑会被当成翻页");
  assert.match(src, /if \(r\.dir !== "h"\) return;/, "判成竖滑之后没有让路，浏览器就滚不了");
  const lockAt = src.indexOf('if (r.dir !== "h") return;');
  const preventAt = src.indexOf("preventDefault", lockAt);
  assert.ok(preventAt > lockAt, "竖滑被 preventDefault 掉了，这一页就滑不动");
});

// 容量那两条还得在：它们管的是「别让一页堆到离谱」，不是「看得见」
test("容量界限还在，而且注释别再说它能保证看得见", () => {
  const i = comp.indexOf("var CAP = 24");
  assert.ok(i > 0, "容量界限没了");
  assert.match(comp.slice(i, i + 200), /ROWCAP/, "行数那一条没了");
  const why = comp.slice(Math.max(0, i - 600), i);
  assert.match(why, /保证不了|不是「看得见」|行高是按内容撑的/, "注释还在说按格数按行数就能保证看得见——那是错的，会误导下一个人");
});
