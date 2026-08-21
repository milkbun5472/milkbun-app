const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

// 她 2026-08-21：删掉一篇之后想把那天重新补回来，没有任何入口——
// 补齐是「一次补最近 14 天全部漏掉的」，全有或全无。
test("补齐可以只补指定的某几天", () => {
  assert.match(app, /const backfillDiary = async \(charId, opts = \{\}\) =>/);
  assert.match(app, /const pick = Array\.isArray\(opts\.days\) && opts\.days\.length \? opts\.days\.slice\(\) : null;/);
  assert.match(app, /const days = pick \|\| diaryMissingDays\(charId\);/);
  // 指定了哪天就别再弹确认框问"要补 N 篇吗"
  assert.match(app, /if \(!pick && !confirm\(/);
  assert.match(app, /onBackfill: \(id, opts\) => backfillDiary\(id, opts\)/);
});

test("窗口从 14 天放宽到 30 天，不然删掉两周前那篇就够不着", () => {
  assert.match(app, /const DIARY_BACKFILL_DAYS = 30;/);
  assert.match(app, /30 天而不是 14 天：删掉一篇之后想补回来，超过两周就够不着了/);
  assert.match(app, /const diaryMissingDays = charId =>/);
  assert.match(app, /for \(let i = 1; i <= DIARY_BACKFILL_DAYS; i\+\+\)/);
  assert.doesNotMatch(app, /for \(let i = 1; i <= 14; i\+\+\)/, "旧的 14 天硬编码已经废掉");
});

test("界面上要能挑日子，而不是只有一个「全都补」", () => {
  assert.match(screens, /const \[pickDay, setPickDay\] = useState\(false\)/);
  assert.match(screens, /onClick: \(\) => \{ if \(gb\) return; setPickDay\(true\); \}/, "补齐按钮改成开单子");
  assert.match(screens, /const daySheet = pickDay &&/);
  // 缺的日子从实际条目算，删掉的那天自然会出现在列表里
  assert.match(screens, /!entriesOf\(curId\)\.some\(e => diarySameDay\(e\.ts, d\.getTime\(\)\)\)/);
  assert.match(screens, /onBackfill\(curId, \{ days: \[ts\] \}\)/, "点一天只补那一天");
  assert.match(screens, /"全部补齐（" \+ missing\.length \+ " 篇）"/, "一次全补的路也留着");
  assert.match(screens, /点一天就只补那一天——删掉过的也在这儿/);
  // 一天都不缺时要说清楚，别弹个空单子
  assert.match(screens, /最近 30 天每天都写过了/);
});

test("缺日子的算法：跳过今天，删掉的那天要能被找出来", () => {
  const missing = (entries, now) => {
    const same = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };
    const out = [];
    for (let i = 1; i <= 30; i++) {
      const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(22, 30, 0, 0);
      if (!entries.some(e => same(e.ts, d.getTime()))) out.push(d.getTime());
    }
    return out.reverse();
  };
  const now = new Date(2026, 7, 21, 10, 0).getTime();
  // 20 号写过、19 号被删掉
  const got = missing([{ ts: new Date(2026, 7, 20, 22, 0).getTime() }], now);
  const days = got.map(t => new Date(t).getDate());
  assert.ok(!days.includes(21), "今天不算漏——今天还没过完");
  assert.ok(!days.includes(20), "写过的不该出现");
  assert.ok(days.includes(19), "删掉的那天必须能被补回来");
  assert.equal(got.length, 29, "30 天里写过一天，剩 29 天可补");
  assert.ok(got[0] < got[got.length - 1], "从最早的一天往回补，时间顺序才对");
});
