// 纪念日的「下一次」（v62.08，她 2026-09-04 拍板）：
// 每年重复的永远有下一次；【不重复】的过了就是过了——不该再滚到明年去倒数，
// 也不该明年同一天再提醒一遍（上下文当天一行和主动消息链都走同一个 annivNext）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const core = fs.readFileSync(path.join(root, "js/core.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

const i = core.indexOf("function annivNext(");
assert.ok(i > 0, "core.js 里抠不出 annivNext");
const j = core.indexOf("\n}", i);
const annivNext = new Function(core.slice(i, j + 2) + "\nreturn annivNext;")();

const D = 86400000;
// 固定「今天」：2026-09-04
const NOW = new Date(2026, 8, 4).getTime();

test("每年重复的：过了今年就是明年，永远不 passed", () => {
  const a = { month: 3, day: 1, yearlyRepeat: true, createdAt: NOW - 400 * D };
  const nx = annivNext(a, NOW);
  assert.equal(nx.passed, false);
  assert.equal(new Date(nx.ts).getFullYear(), 2027);
  assert.ok(nx.days > 0);
});

test("不重复的：目标是立下之后遇到的第一个那天；过了就 passed、days 为负", () => {
  // 2026-01-10 立的、日子是 2026-05-20 → 目标 2026；今天 09-04 已过
  const a = { month: 5, day: 20, yearlyRepeat: false, createdAt: new Date(2026, 0, 10).getTime() };
  const nx = annivNext(a, NOW);
  assert.equal(nx.passed, true);
  assert.ok(nx.days < 0, "过了该是负数天");
  assert.equal(new Date(nx.ts).getFullYear(), 2026, "不许滚到 2027 去");
});

test("不重复的：立下时那天今年已经过了 → 目标顺延到下一年，还没到就不 passed", () => {
  // 2026-06-01 立的、日子是 2月14 → 第一个该日期是 2027-02-14
  const a = { month: 2, day: 14, yearlyRepeat: false, createdAt: new Date(2026, 5, 1).getTime() };
  const nx = annivNext(a, NOW);
  assert.equal(nx.passed, false);
  assert.equal(new Date(nx.ts).getFullYear(), 2027);
});

test("当天 days === 0（每年和不重复都一样）", () => {
  assert.equal(annivNext({ month: 9, day: 4, yearlyRepeat: true, createdAt: NOW - 30 * D }, NOW).days, 0);
  assert.equal(annivNext({ month: 9, day: 4, yearlyRepeat: false, createdAt: NOW - 30 * D }, NOW).days, 0);
});

test("老数据没有 createdAt 的按每年重复算——宁可多提醒，不能凭空消失", () => {
  const nx = annivNext({ month: 5, day: 20, yearlyRepeat: false }, NOW);
  assert.equal(nx.passed, false);
  assert.equal(new Date(nx.ts).getFullYear(), 2027);
});

test("四处都走 annivNext，不许再各比各的 month/day", () => {
  // 上下文当天一行 + 主动消息链（app.js）
  assert.ok((app.match(/annivNext\(a\w*\)\.days === 0/g) || []).length >= 2,
    "app.js 的当天判断没走 annivNext");
  // 我们的日子倒数列表 + TODAY 卡（screens.js）
  assert.match(screens, /const annivInfo = a => \{ const nx = annivNext\(a\)/, "倒数列表没走 annivNext");
  assert.match(screens, /nx\.passed \? null : \{ name: a\.name, days: nx\.days \}/, "TODAY 卡没滤掉已过期的");
});
