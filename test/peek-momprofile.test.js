const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// 她 2026-10-13 截图：主题工作台「去这一页看看」朋友圈个人页整页空白——没告诉它是谁的那一页
test("预览跳朋友圈个人页：没指过是谁就先看「我的」", () => {
  const go = app.slice(app.indexOf("const go = key => {"), app.indexOf("window.__goScreen = go;"));
  assert.match(go, /if \(k === "momprofile"\) setMomTarget\(t => t \|\| \{ isMe: true \}\);/);
});
