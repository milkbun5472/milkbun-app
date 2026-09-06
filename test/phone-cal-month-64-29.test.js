// 查手机的日历停在 8 月（她 2026-09-06：「为啥查手机显示 8 月明明已经九月了，
// 然后这个日历能不能换月份显示之前的和之后的月份」）。
//
// 病根：它显示的是【事项里出现最多的那个月】。她日历上多半是七八月记的旧事，
// 于是九月打开还停在八月——而这一页是「他的日历」，人翻开日历默认看的是【这个月】。
// 出现最多的那个月是个统计量，不是一个人会想看的东西。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const view = src.slice(src.indexOf("function CalendarView({"), src.indexOf("// 便签 —— 备忘录和录音合成一个"));

test("默认落在今天这个月，不再按「哪个月的条目多」来挑", () => {
  assert.ok(view.length > 1000, "抠不出 CalendarView");
  assert.match(view, /const \[ym, setYm\] = useState\(\{ y: now\.getFullYear\(\), m: now\.getMonth\(\) \+ 1 \}\);/);
  // 旧那套统计一个都不许留（撤东西要删干净）
  ["const tally = {}", "topKey", "tally[b] - tally[a]"].forEach(x =>
    assert.equal(view.indexOf(x), -1, "旧的那套还留着：" + x));
  // 顶栏的月份也照真实的算，不再拿模型给的 monthLabel（那一份现在正好是错的）
  assert.doesNotMatch(view, /data\.monthLabel/, "顶栏还在信模型给的月份标签");
});

test("能翻月：上一月 / 下一月 / 回今天", () => {
  assert.match(view, /const stepMonth = n => \{ const d0 = new Date\(cy, cm - 1 \+ n, 1\); setYm\(\{ y: d0\.getFullYear\(\), m: d0\.getMonth\(\) \+ 1 \}\); setSel\(null\); \};/,
    "翻月没走 Date 自己进位（跨年会算错），或者翻完没清掉选中的那天");
  assert.match(view, /onClick: \(\) => stepMonth\(-1\), "aria-label": "上个月"/);
  assert.match(view, /onClick: \(\) => stepMonth\(1\), "aria-label": "下个月"/);
  assert.match(view, /const thisMonth = cy === now\.getFullYear\(\) && cm === now\.getMonth\(\) \+ 1;/);
  assert.match(view, /thisMonth \? "" : " · 回今天"/, "不在本月时没有回今天的路");
  // 跨年时把年份写出来，不然 1 月和去年 1 月长得一样
  assert.match(view, /\(cy === now\.getFullYear\(\) \? "" : cy \+ "年 "\) \+ cm \+ "月"/);
});

test("底下列的是这个月的，标题也跟着说这个月", () => {
  // ⚠️月历翻到九月、底下还铺着七月的事——两处对不上，人会以为月历坏了
  assert.match(view, /const inMonth = dated\.filter\(r => r\.at\.y === cy && r\.at\.m === cm\)\.map\(r => r\.x\);/);
  assert.match(view, /const listFor = sel \? onDay\(sel\) : inMonth;/);
  assert.match(view, /sel \? cm \+ "月" \+ sel \+ "日" : cm \+ "月的安排"/, "标题还叫「全部安排」，跟内容对不上");
});

test("翻到空月要说清东西在哪几个月", () => {
  // 别只说「没有」：翻空一个月就以为整本是空的
  assert.match(view, /const monthsWith = \[\.\.\.new Set\(dated\.map\(r => r\.at\.y \+ "-" \+ r\.at\.m\)\)\]/);
  assert.match(view, /"这个月他日历上没有东西"/);
  assert.match(view, /"有安排的是 " \+ monthsWith\.slice\(-4\)/);
});
