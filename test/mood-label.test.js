"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const MoodLabel = require("../js/mood-label.js");
const fs = require("node:fs");
const path = require("node:path");
test("英文内部 mood 标签固定显示为中文", () => {
  assert.equal(MoodLabel.localize("proud"), "骄傲");
  assert.equal(MoodLabel.localize("Proud"), "骄傲");
  assert.equal(MoodLabel.localize("proud and relieved"), "骄傲、如释重负");
});
test("已有中文不改写，未知英文不直接泄漏", () => {
  assert.equal(MoodLabel.localize("得意"), "得意");
  assert.equal(MoodLabel.localize("inventive"), "心绪复杂");
});
test("三个 mood 字段一起归一化", () => {
  assert.deepEqual(MoodLabel.normalizeMood({ label: "proud", baseline: "calm", softened: "satisfied", ts: 1 }), { label: "骄傲", baseline: "平静", softened: "满足", ts: 1 });
});
test("普通角色以行为优先协议记录心情，并兼容模型返回 mood 字符串", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(source, /mood: \{\"label\":\"中文短词\"\}，本轮回应完成后的当前主导心情；重新判断不等于必须变化/);
  assert.match(source, /const _taskFull = _s\.engineerEyes \? _digitalTaskFull : _normalTaskV2/);
  assert.match(source, /typeof parsed\.mood === "string"[\s\S]{0,300}parsed\.mood = \{ label: parsed\.mood\.trim\(\) \}/);
});
