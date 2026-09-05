// tabs-not-plain-pills 还债：查手机里那三处「一排药丸 / 白药丸分段」。
//
// 判据是那把尺子：这一组 tab 原样搬到另一个 app 里还成立吗？
//   成立 → 写坏了。iOS 那个白药丸分段控件放哪儿都成立，所以它等于没设计。
// 这三个 app 各自仿的是真东西，那就照真东西的分栏方式来：
//   浏览器 → 标签条（上圆下方，选中那张跟页面连成一片）
//   电话   → 底下那条图标栏（真的电话 app 把四页放在底下，一页一个图标）
//   视频   → 分区行（加粗的粉字 + 底下一道短粗横杠，不是填个浅粉底）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const cut = (a, b) => {
  const i = phone.indexOf(a), j = phone.indexOf(b, i);
  assert.ok(i >= 0 && j > i, "切不出来：" + a);
  return phone.slice(i, j);
};

test("三处都不再是那颗通用白药丸/浅色药丸", () => {
  // iOS 分段控件的指纹：radius 9 + 白底 + 一点点投影
  assert.ok(!/borderRadius: 9,\s*\n?\s*background: tab === pg\.key \? "#fff"/.test(phone),
    "白药丸分段还在");
  assert.equal((phone.match(/boxShadow: tab === pg\.key \? "0 1px 4px rgba\(30,30,40,\.10\)" : "none"/g) || []).length, 0);
  assert.ok(!phone.includes('background: i === tab ? "rgba(251,114,153,.10)" : "transparent"'), "视频那排浅粉药丸还在");
});

test("浏览器四页＝标签条：选中那张跟底下的页面连成一片", () => {
  const seg = cut("四页＝浏览器的标签条", "h(\"div\", { ref: scrollRef");
  // 上圆下方
  assert.match(seg, /borderRadius: "10px 10px 0 0"/, "还是四个方角/圆角块");
  // 压住那条分隔线：外层画线、选中那张 marginBottom -1 且下边框跟页面同色
  assert.match(seg, /borderBottom: "1px solid " \+ BR_LINE/, "标签条底下那道分隔线没了");
  assert.match(seg, /marginBottom: -1/, "选中那张没压住分隔线，就没有「连成一片」");
  assert.match(seg, /background: on \? BR_BG : "transparent"/, "选中那张不是页面的颜色");
  assert.match(seg, /borderBottomColor: on \? BR_BG : "transparent"/, "选中那张下边还封着口");
  // 选中态差了不止一个色：高度（padding）也变
  assert.match(seg, /padding: on \? "9px 4px 8px" : "11px 4px 6px"/, "选中态只靠色差");
});

test("电话四页＝底下那条图标栏，一页一个程序画的图标", () => {
  const seg = cut("四页＝电话 app 底下那条图标栏", "detail);");
  assert.match(seg, /borderTop: "1px solid " \+ CALL_LINE/, "栏顶那道线没了");
  assert.match(seg, /callGlyph\(pg\.key, on \? CALL_BLUE : CALL_DIM\)/, "没有图标，那就还是一排字");
  assert.match(seg, /minHeight: 48/, "可点区不够（tabs-not-plain-pills 第 1 条：别低于 40px）");
  // 它必须在正文【后面】——写在前面就还是顶栏那排 tab，位置这一层就白改了
  const body = phone.indexOf('className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 14px 22px" }');
  assert.ok(body > 0 && phone.indexOf("四页＝电话 app 底下那条图标栏") > body, "图标栏还在正文上面");
  // 四个图标各画各的，不是同一个形状换个颜色
  const g = cut("function callGlyph(kind, color)", "\nfunction ");
  ["calls", "sms", "vm"].forEach(k => assert.ok(g.includes('kind === "' + k + '"'), k + " 没有自己的图标"));
  const ds = (g.match(/d: "[^"]+"/g) || []);
  assert.ok(new Set(ds).size >= 4, "四个图标里有重样的：" + ds.length);
  assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(g), "拿 emoji 当图标了");
});

test("视频分区＝加粗粉字 + 底下一道短粗横杠", () => {
  const seg = cut("分区不是一排药丸", "return h(\"div\", { className: \"h-full min-h-0 flex flex-col relative\"");
  assert.match(seg, /fontWeight: i === tab \? 700 : 400/, "选中那个没加粗");
  assert.match(seg, /width: 16, height: 3, borderRadius: 999/, "底下那道短粗圆头横杠没了");
  assert.match(seg, /background: i === tab \? BILI_PINK : "transparent"/, "横杠没跟着选中走");
  assert.match(seg, /minHeight: 40/, "可点区不够");
  assert.ok(!/borderRadius: 999, color: i === tab/.test(seg), "药丸还在");
});
