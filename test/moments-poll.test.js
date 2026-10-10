// 群里 2026-10-09 许愿：朋友圈开投票，让角色们帮忙选
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const a = src("app.js"), c = src("components.js");
test("发朋友圈能带投票，2~4 个选项", () => {
  assert.match(c, /poll: opts\.length >= 2 \? \{ options: opts, votes: \{\} \} : null/);
  assert.match(c, /pollOpts\.length < 4/);
  assert.match(a, /poll: poll && Array\.isArray\(poll\.options\) && poll\.options\.length >= 2/);
});
test("角色反应时照自己投票，票记到动态上；卡片画出票数和谁投的", () => {
  assert.match(a, /【这条朋友圈带了投票】/);
  assert.match(a, /votes\[momentWho\(r\.name\)\] = v - 1/);
  assert.match(a, /poll: \{ \.\.\.m\.poll, votes: \{ \.\.\.\(m\.poll\.votes \|\| \{\}\), \.\.\.votes \} \}/);
  assert.equal(c.split("h(MomentPoll, {").length - 1, 2, "信息流和个人页都得画投票");
});
