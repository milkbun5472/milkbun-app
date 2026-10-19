// 原生壳最底那条是壳 view 的底色（写死米白）。聊天页把输入栏实际底色报到 theme-color，壳跟着换。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const shell = fs.readFileSync(path.join(root, "tools/ios-shell/LisaPhone/LisaPhone/AppDelegate.swift"), "utf8");

test("网页：聊天页按输入栏底色写 theme-color，透明就回主题底色", () => {
  assert.match(app, /meta\[name="theme-color"\]/);
  assert.match(app, /querySelector\('\[data-wk="composer"\]'\)/);
  assert.match(app, /parseFloat\(a\[3\]\) > 0\.5/);
});

test("壳：跟着 themeColor 换 view 底色", () => {
  assert.match(shell, /observe\(\\\.themeColor/);
  assert.match(shell, /self\?\.view\.backgroundColor = c/);
  assert.match(shell, /var themeObs: NSKeyValueObservation\?/);
});
