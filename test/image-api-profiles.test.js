const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

test("image API upgrades the existing x_imgApi key to switchable profiles", () => {
  assert.match(engine, /function loadImgApiProfiles\(/);
  assert.match(engine, /Array\.isArray\(raw\.profiles\)/);
  assert.match(engine, /normalizeImgApiProfile\(raw && typeof raw === "object" \? raw : null/);
  assert.match(engine, /function saveImgApiProfiles\(/);
  assert.match(engine, /localStorage\.setItem\("x_imgApi", JSON\.stringify\(clean\)\)/);
  assert.match(engine, /store\.profiles\.find\(p => p\.id === store\.activeId\)/);
});

test("image API settings can add, copy, rename, switch, and delete sites", () => {
  assert.match(screens, /当前图像站点 · 线上照片与小剧场共用/);
  assert.match(screens, /const switchSite = id =>/);
  assert.match(screens, /const addSite = copy =>/);
  assert.match(screens, /复制当前/);
  assert.match(screens, /name: e\.target\.value/);
  assert.match(screens, /const removeSite = \(\) =>/);
});

test("all image calls continue to resolve the active profile through loadImgApi", () => {
  assert.match(engine, /function generateSelfieImage[\s\S]*?const a = loadImgApi\(\)/);
  assert.match(engine, /function saveImgApi\(c\)[\s\S]*?store\.activeId/);
});
