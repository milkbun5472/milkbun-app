const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");

test("聊天协议识别兼容大小写、弯引号与中文冒号", () => {
  assert.match(app, /protocolFieldRe\s*=.*\/i/);
  assert.match(app, /word\["'“”‘’\]\?\\s\*\[:：=\]/);
});

test("双重编码与误塞进 word 的协议不会显示成气泡", () => {
  assert.match(app, /typeof parsed === "string"[\s\S]{0,100}extractJSON\(parsed\)/);
  assert.match(app, /words = words\.filter\(w => !protocolFieldRe\.test\(String\(w\)\)\)/);
});
