"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

test("diary extracts only the character's own recent lines as voice samples", () => {
  assert.match(app, /dayRows\.filter\(r => String\(r\.speaker \|\| ""\) === String\(char\.name \|\| ""\)/);
  assert.match(app, /voiceSamples: diaryVoiceSamples/);
  assert.match(engine, /本人当天真实说话的声纹样本·最高优先/);
});

test("diary prompt treats JSON fields as a container rather than a prose template", () => {
  assert.match(engine, /输出容器·字段不是文章模板/);
  assert.match(engine, /titleEn\/titleZh\/signature 不适合本人时允许为空/);
  assert.match(engine, /不要默认使用『文艺日记腔』/);
});

test("optional titles and signatures remain optional in storage and rendering", () => {
  assert.match(app, /titleEn: d\.titleEn \|\| ""/);
  assert.match(screens, /entry\.titleEn \|\| entry\.titleZh \|\| dateStr/);
  assert.match(screens, /entry\.signature \?/);
});
