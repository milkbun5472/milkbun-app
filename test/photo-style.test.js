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

test("生图同时读取人设并提供身份与固定服装硬锁", () => {
  assert.match(screens, /photoCanon: photoCanon\.trim\(\)/);
  assert.match(screens, /photoOutfit: photoOutfit\.trim\(\)/);
  assert.match(engine, /角色完整人设中的视觉事实/);
  assert.match(engine, /最高优先级·固定服装锁/);
  assert.match(engine, /不得随机换装、现代化/);
});

test("未成年男孩不会被生成为成人或女性胸部", () => {
  assert.match(engine, /未成年人安全与解剖硬锁/);
  assert.match(engine, /胸廓必须是自然平坦的男童胸廓/);
  assert.match(engine, /禁止成人化、性感化、胸部曲线/);
});

test("图像 API 默认与回退模型统一为 GPT Image 2", () => {
  assert.doesNotMatch(engine, /gpt-image-1/);
  assert.doesNotMatch(screens, /gpt-image-1/);
  assert.match(engine, /model: "gpt-image-2"/);
  assert.match(screens, /placeholder: "gpt-image-2"/);
});
