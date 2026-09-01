"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync("js/app.js", "utf8");
const components = fs.readFileSync("js/components.js", "utf8");
const screens = fs.readFileSync("js/screens.js", "utf8");

test("每个角色的聊天设置都有就地上下文诊断入口", () => {
  const chatSettings = components.slice(components.indexOf("function ChatSettings("));
  assert.match(chatSettings, /key: "debug", icon: "⌁", title: "上下文诊断"/);
  assert.match(chatSettings, /settingsTab === "debug" && renderContextDebug \? renderContextDebug\(\) : null/);
  assert.match(app, /renderContextDebug: \(\) => h\(CtxDebug/);
  assert.match(app, /lockedCharId: activeChar\.id/);
  assert.match(chatSettings, /scrollKey: settingsTab \|\| "home"/);
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

test("角色设置切换子页时回到弹层顶部，不把真实召回顶出屏幕", () => {
  const sheet = components.slice(components.indexOf("function Sheet("), components.indexOf("function useKbLift"));
  assert.match(sheet, /scrollKey/);
  assert.match(sheet, /node\.scrollTop = 0/);
  assert.match(sheet, /requestAnimationFrame\(resetScroll\)/);
  assert.match(sheet, /overflowAnchor: "none"/);
  assert.match(sheet, /\[scrollKey\]/);
});
