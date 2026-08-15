"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");

test("角色自拍会作为本人亲历事实回写单聊与群聊历史", () => {
  assert.match(app, /你在这里已经实际发出一张/);
  assert.match(app, /本人必须记得，不能马上重复发/);
  assert.match(app, /m\.kind === "selfie"/);
});

test("三次角色回复内存在程序级发图冷却，明确索图可解除", () => {
  assert.match(app, /const photoCooldownState =/);
  assert.match(app, /turns\.size < 3/);
  assert.match(app, /PHOTO_REQUEST_RE\.test/);
  assert.match(app, /if \(photoCooldown\.cooling\) \{ photoKind = null; photoScene = null; \}/);
  assert.match(app, /photoCooldownState\(gchat, spk\.id\)\.cooling/);
  assert.match(app, /members\.filter\(c => \(c\.appearance \|\| c\.refPhoto\) && !photoCooldownState\(gchat, c\.id\)\.cooling\)/);
});
