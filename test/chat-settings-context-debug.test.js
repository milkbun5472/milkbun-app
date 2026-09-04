"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync("js/app.js", "utf8");
const components = fs.readFileSync("js/components.js", "utf8");
const screens = fs.readFileSync("js/screens.js", "utf8");

// v61.79 改：诊断不再自己占一格，并进【TA 知道什么】——她去查它，问的正是
// 「他到底记得什么、这一轮发进去的是什么」。所以这条钉的从「有没有 debug 那一格」
// 换成「在 TA 知道什么 里进得去」。
test("每个角色的聊天设置都有就地上下文诊断入口", () => {
  const chatSettings = components.slice(components.indexOf("function ChatSettings("));
  assert.match(chatSettings, /settingsTab === "know" && renderContextDebug/);
  assert.match(chatSettings, /title: "查上一轮真的发了什么"/);
  assert.match(chatSettings, /key: "know", char: "记", title: "TA 知道什么"/);
  assert.match(app, /renderContextDebug: \(\) => h\(CtxDebug/);
  assert.match(app, /lockedCharId: activeChar\.id/);
});

test("角色内诊断默认锁定本人并收起全局 wire 与影子总览", () => {
  assert.match(screens, /function CtxDebug\(\{ characters, getBundle, lockedCharId, compact \}\)/);
  assert.match(screens, /const initialCid = lockedCharId \|\| null/);
  assert.match(screens, /!compact \? h\("div", \{ style: \{ border:/);
  assert.match(screens, /!compact \? h\(RecallShadowPanel, null\) : null/);
  assert.match(screens, /!lockedCharId \? h\("div", \{ className: "flex gap-2 flex-wrap"/);
});

test("全局与角色内诊断共用只读 bundle 构建", () => {
  assert.match(app, /const inspectBundleFor = cid =>/);
  assert.match(app, /buildBundle\(ctxFor\(c, \{ debug: true \}\)\)/);
  assert.match(app, /debugBundleFor: inspectBundleFor/);
  assert.match(app, /getBundle: inspectBundleFor/);
});

// v61.79 起这一页不是弹层了（.claude/rules/no-half-sheet.md：收起来只剩四五行，
// 半窗就缩成小半屏、上面糊着聊天，看着像没加载完）。回顶那件事还得做，
// 只是从 Sheet 的 scrollKey 换成这一页自己那个滚动容器。
test("角色设置切换子页时回到顶部，不把真实召回顶出屏幕", () => {
  const chatSettings = components.slice(components.indexOf("function ChatSettings("));
  assert.match(chatSettings, /useEffect\(\(\) => \{ if \(setScrollRef\.current\) setScrollRef\.current\.scrollTop = 0; \}, \[settingsTab\]\)/);
  assert.match(chatSettings, /ref: setScrollRef, className: "flex-1 min-h-0 overflow-y-auto"/);
  // Sheet 自己那套回顶还在给别处用，别顺手删了
  const sheet = components.slice(components.indexOf("function Sheet("), components.indexOf("function useKbLift"));
  assert.match(sheet, /node\.scrollTop = 0/);
  assert.match(sheet, /requestAnimationFrame\(resetScroll\)/);
});
