"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "js", "study.js"), "utf8");
const ui = src.slice(src.indexOf("// UI"));

test("一起学整套界面是一册活页学习夹，不再是通用白卡", () => {
  assert.match(ui, /const STUDY_SKIN = \{/);
  assert.match(ui, /const STUDY_MODE_SKIN = \{[\s\S]*teach:[\s\S]*costudy:[\s\S]*nv1:/);
  assert.match(ui, /COURSE FILE/);
  assert.match(ui, /LAST NOTES/);
  assert.match(ui, /LESSON SLIPS/);
  assert.match(ui, /NEW RESEARCH SHEET/);
  assert.match(ui, /QUIZ CARD/);
  assert.match(ui, /课后批注页/);
});

test("一起学所有内页共用紧凑安全顶栏与聊天同尺底栏", () => {
  assert.match(ui, /function StudyHead\(props\)/);
  assert.match(ui, /paddingTop: safeTop\(10\)/);
  assert.match(ui, /gridTemplateColumns: "52px 1fr 52px"/);
  assert.doesNotMatch(ui, /h\(Head,/, "还有页面掉回通用顶栏");
  assert.match(ui, /function StudyFooter\(props\)/);
  assert.match(ui, /paddingBottom: COMPOSER_PAD_BOTTOM/);
  assert.doesNotMatch(ui, /calc\(env\(safe-area-inset-bottom\) \+/, "底栏又把安全区整条重复垫高了");
});

test("三种模式是学习夹分隔页，不是换色药丸", () => {
  assert.match(ui, /三种模式是活页夹里三张分隔页/);
  assert.match(ui, /minHeight: on \? 58 : 49/);
  assert.match(ui, /borderRadius: "12px 12px 0 0"/);
  assert.match(ui, /borderTop: "4px solid " \+ skin\.accent/);
  assert.match(ui, /transform: on \? "none" : "translateY\(1px\)"/);
});

test("首页和课程档案进入内页后都能恢复原滚动位置", () => {
  assert.match(ui, /homeScrollTopRef\.current = homeScrollRef\.current\.scrollTop/);
  assert.match(ui, /homeScrollRef\.current\.scrollTop = homeScrollTopRef\.current/);
  assert.match(ui, /consoleScrollTopRef\.current = consoleScrollRef\.current\.scrollTop/);
  assert.match(ui, /consoleScrollRef\.current\.scrollTop = consoleScrollTopRef\.current/);
  assert.match(ui, /ref: props\.scrollRef, className: "flex-1 min-h-0 overflow-y-auto/);
});

test("学习线程工具、题卡与作答选项保留可点击高度", () => {
  assert.match(ui, /const lessonTools =/);
  assert.match(ui, /minHeight: 42/);
  assert.match(ui, /const baseButton = \{ minHeight: 42/);
  assert.match(ui, /minHeight: 40/);
  assert.match(ui, /写在这张课页上/);
});
