"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");

test("私聊照片入口同时保留真图与纯文字描述", () => {
  assert.match(source, /const \[photoSendMode, setPhotoSendMode\] = useState\("real"\)/);
  assert.match(source, /photoSendMode === "describe"/);
  assert.match(source, /photoMode: "describe", content: "\[照片\] " \+ v/);
  assert.match(source, /photoMode: "real", content: v \? "\[照片\] " \+ v : "\[照片\]"/);
});

test("线上群聊照片入口也支持两种模式", () => {
  assert.match(source, /const \[groupPhotoMode, setGroupPhotoMode\] = useState\("real"\)/);
  assert.match(source, /groupPhotoMode === "describe"/);
  assert.match(source, /大家才看得见/);
});

test("文字描述模式明确不读取或上传真实照片", () => {
  assert.match(source, /不会读取相册，也不会上传真实照片/);
  assert.match(source, /不会读取或上传真实照片/);
});
