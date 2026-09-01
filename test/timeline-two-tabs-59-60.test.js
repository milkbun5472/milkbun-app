const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ph = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const view = ph.slice(ph.indexOf("function TimelineView("), ph.indexOf("// 锁屏：拿起他手机的第一眼"));

// 她 2026-09-01：「时间线现在是打开看到接下来排好的下滑完一周接下来的才能看到
// 以前的时间线。能不能改成这俩分开俩 tab」。
test("接下来和走过的分成两格", () => {
  assert.match(view, /const \[tab, setTab\] = useState\("past"\);/,
    "没有分格，或者默认没落在【走过的】——那还是要滑过一周才够得着正文");
  assert.match(view, /\[\["past", "走过的", pastN\], \["ahead", "接下来", aheadN\]\]/,
    "两格的名字和条数不对");
  assert.match(view, /const pool = list\.filter\(r => tab === "ahead" \? !!r\.ahead : !r\.ahead\);/,
    "两格没有真的把 ahead 拆开");
  assert.match(view, /const shown = mode === "new" \? pool\.filter\(isNew\)/,
    "列表还在读整份 list，分格等于没分");
});

test("两格都常驻，空的那格自己说话", () => {
  // 空了就藏起来的话，日历里排下来的事一进时间线就人间蒸发
  const bar = view.slice(view.indexOf('[["past", "走过的"'), view.indexOf("// 只看新增"));
  assert.ok(bar.indexOf("aheadN > 0 &&") < 0 && bar.indexOf("aheadN ?") < 0, "空的那一格被藏起来了");
  assert.match(view, /aheadN \? "他日历上排下来的 " \+ aheadN \+ " 件事" : "日历上还没有排下来的事"/,
    "接下来那一格没有自己的说明");
  assert.match(view, /tab === "ahead" \? T\("他日历上还没有排下来的事。排了的话会出现在这儿。"\)/,
    "接下来空着时没有交代");
});

test("两个筛选 chip 只管当前这一格", () => {
  assert.match(view, /const keptCount = pool\.filter\(isKept\)\.length;/, "「我收着的」还在数整份");
  assert.match(view, /const poolNew = pool\.filter\(isNew\)\.length;/, "「只看新增」还在数整份");
  assert.match(view, /poolNew > 0 && h\("button"/, "新增 chip 的显隐还看着整份的数");
  assert.match(view, /"只看新增 " \+ poolNew/, "新增 chip 上写的还是整份的数");
});

test("换格时筛选归位、滚动回到顶上", () => {
  assert.match(view, /const goTab = k => \{ if \(k === tab\) return; setTab\(k\); setMode\("all"\);[\s\S]{0,90}scrollTop = 0; \};/,
    "换格没有把 mode 和滚动一起归位——带着「我收着的」切过去会卡在一个空列表里");
  assert.match(view, /onClick: \(\) => goTab\(k\)/, "tab 按钮没走 goTab");
  assert.match(view, /h\("div", \{ ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto/,
    "正文那个滚动容器没挂 ref，换格时滚不回顶上");
});

test("每条前面不再挂「接下来 · 」", () => {
  assert.match(view, /const label = phoneDayLabel\(r\.ts, now\);/, "日期标题还在拼前缀");
  assert.ok(view.indexOf('"接下来 · "') < 0, "整格都是未来了，每条上再挂一遍等于白说");
});

test("「都看过了」清的是两格一起，说法不能装成只清这一格", () => {
  assert.match(view, /"全部 " \+ newCount \+ " 条新的都看过了"/,
    "写成「这 N 条」的话，走过的里写着「只看新增 3」、按钮却说 10，看上去像 bug");
});

// 分格是界面上的事，排序那一层不许跟着动：日历那一路仍然是唯一能算「还没发生」的。
test("ahead 还是只有日历那一路算得上", () => {
  assert.match(ph, /const canAhead = x => x\.app === "calendar";/, "别的 app 也被当成预告了");
  assert.match(ph, /const ahead = out\.filter\(x => x\.ts != null && x\.ts > soon && canAhead\(x\)\)/, "ahead 的算法被改了");
});
