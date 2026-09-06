"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const screens = fs.readFileSync(path.resolve(__dirname, "../js/screens.js"), "utf8");

test("五感诊断台覆盖四通道、状态报告和 CC 回流来源", () => {
  assert.match(screens, /function SomaticDiagnosticSheet/);
  for (const label of ["触觉", "嗅觉", "味觉", "听觉"]) assert.match(screens, new RegExp(label));
  assert.match(screens, /S\.status\(ownerId, c\.id/);
  assert.match(screens, /S\.report\(ownerId, c\.id/);
  assert.match(screens, /cc_ledger/);
});

test("五感诊断台明确只读、不注入且不读取私人 CC transcript", () => {
  assert.match(screens, /只看不注入/);
  assert.match(screens, /不读取私人 CC transcript/);
  // v64.26 改了名：「纯影子诊断」这个说法她看不懂，而且这一片重排之后
  // 它已经明确收在「只是数字 · 工程仪表」那一折里了，标题不用再自称影子。
  assert.match(screens, /五感系统 · 全角色影子诊断/);
});
