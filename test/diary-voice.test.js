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
  // v58.41 起日期【永远】单独写在页首那一行（不再拿它冒充标题），
  // 所以「不取标题的人也不会开天窗」这条契约反而更硬了
  assert.match(screens, /const dateStr = \(d\.getMonth\(\) \+ 1\) \+ "月" \+ d\.getDate\(\) \+ "日"/, "全文页不再自己写日期了？");
  assert.match(screens, /fontSize: 27, color: t\.ink[^}]*\}\s*\}, dateStr\)/, "日期没写在页首那一行");
  assert.match(screens, /title \? h\("div"/, "标题变成必填了？没标题的人该什么都不显示");
  assert.match(screens, /entry\.signature \?/);
});

test("diary remains the character's own life and may omit the user entirely", () => {
  assert.match(app, /scheduleText: scheduleTextFor\(char, targetKey\)/);
  assert.match(engine, /日记的中心是你自己，不是用户/);
  assert.match(engine, /今天完全不提用户也正常且正确/);
  assert.match(engine, /整篇一个字都不提 Ta 才是真实/);
  assert.doesNotMatch(engine, /有没有惦记她\/等她消息/);
});
