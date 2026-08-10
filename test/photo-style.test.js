"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

test("角色档案提供独立照片画风并保存", () => {
  assert.match(screens, /initial && initial\.photoStyle \|\| "realistic"/);
  assert.match(screens, /photoStyle: photoStyle/);
  assert.match(screens, /跟随参考图/);
  assert.match(screens, /二次元插画/);
});

test("图片提示词按写实、参考图和二次元三路分流", () => {
  assert.match(engine, /\["realistic", "reference", "anime"\]\.includes\(char\.photoStyle\)/);
  assert.match(engine, /严格沿用第一张人物参考图的视觉媒介与画风/);
  assert.match(engine, /不要真人化，不要摄影质感/);
  assert.match(engine, /旧角色无字段时继续沿用写实/);
});
