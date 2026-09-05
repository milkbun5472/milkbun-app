const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const weekly = fs.readFileSync(path.resolve(__dirname, "../js/weekly.js"), "utf8");

test("周刊入口、合订本和工具台是三种可辨认的整页空间", () => {
  assert.match(weekly, /data-weekly-space": "newsroom"/);
  assert.match(weekly, /编辑部装帧台/);
  assert.match(weekly, /一个人的周刊/);
  assert.match(weekly, /data-weekly-space": "archive"/);
  assert.match(weekly, /编辑部书架/);
  assert.match(weekly, /BOUND VOLUMES/);
  assert.match(weekly, /data-weekly-space": "tools"/);
  assert.match(weekly, /编辑部工作台/);
});

test("本期工具是安全区内的完整页面，不再从底部弹出半屏", () => {
  const tools = weekly.slice(weekly.indexOf("function WeeklyToolsSheet"), weekly.indexOf("// 版块详情里的"));
  assert.match(tools, /position: "absolute", inset: 0/);
  assert.match(tools, /paddingTop: safeTop\(10\)/);
  assert.match(tools, /className: "flex-1 min-h-0 overflow-y-auto"/);
  assert.doesNotMatch(tools, /maxHeight: "72%"/);
  assert.doesNotMatch(tools, /alignItems: "flex-end"/);
});

test("合订本书架保留滚动位置，同一报道周只展示最完整的新稿", () => {
  assert.match(weekly, /Shelf\.scrollTop = el\.scrollTop/);
  assert.match(weekly, /if \(el && Number\.isFinite\(Shelf\.scrollTop\)\) el\.scrollTop = Shelf\.scrollTop/);
  assert.match(weekly, /const byWeek = new Map\(\)/);
  assert.match(weekly, /sections\) \|\| \[\]\)\.length \* 10000000000000/);
  assert.match(weekly, /const displayIssues = shelfIssues\(issues\)/, "首页也必须使用书架同一份去重选择规则");
});

