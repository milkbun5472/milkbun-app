// 群聊「复制上一轮真正发出去的提示词」（她 2026-10-02：修罗场调了七轮还在猜，要对着真东西查）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), comp = R("components.js");

test("发之前把这一轮的 system 和 user 存进内存，不落盘", () => {
  const i = app.indexOf("window.__lastGroupPrompt = {"), j = app.indexOf("let raw = await _gShoot(userContent);");
  assert.ok(i > 0 && j > i, "没在发之前存，或者存在发之后了");
  assert.match(app.slice(i, j), /system: system, user: userContent/);
  assert.ok(!/saveJSON\("x_lastGroupPrompt/.test(app), "这份带着所有人的私事，不许落盘");
});

test("群设置里有复制键，读的是这个群自己的那一份", () => {
  const i = comp.indexOf("function GroupSettingsSheet(");
  assert.ok(i > 0);
  assert.match(comp.slice(i), /const rec = \(window\.__lastGroupPrompt \|\| \{\}\)\[group && group\.id\];/);
  assert.match(comp.slice(i), /await copyText\("【system】\\n" \+ rec\.system/);
});
