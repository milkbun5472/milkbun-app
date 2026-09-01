"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const src = fs.readFileSync("js/screens.js", "utf8");
const start = src.indexOf("function MemoryLib(");
const end = src.indexOf("function MemCfgSheet(", start);
const memory = src.slice(start, end);

test("记忆库主页面只留一个整理入口，不再把低频工具铺在顶栏", () => {
  assert.match(memory, /setManageOpen\(v => !v\)/);
  assert.match(memory, /"整理" \+ \(corrections\.length/);
  const head = memory.slice(memory.indexOf('zh: "记忆库"'), memory.indexOf("importOpen &&"));
  assert.doesNotMatch(head, /title: "导入长文进记忆库"|h\(GConfig/);
});

test("导入、手动抽取、旧库补评与月度精炼都收进整理区，能力没有删除", () => {
  assert.match(memory, /"整理与维护"/);
  assert.match(memory, /"导入长文"/);
  assert.match(memory, /"从当前对话提取"/);
  assert.match(memory, /"导入旧长期记忆"/);
  assert.match(memory, /"补旧记忆情绪 · "/);
  assert.match(memory, /"旧版月度精炼 · "/);
});

test("工程仪表再藏一层，主列表从空态或记忆卡直接开始", () => {
  assert.match(memory, /manageOpen \? h\(React\.Fragment/);
  assert.match(memory, /setDiagOpen\(v => !v\)/);
  assert.match(memory, /h\(EventShelfSection/);
  assert.match(memory, /placeholder: "搜索记忆内容 \/ 标签 \/ 角色…"/);
  assert.match(memory, /className: "flex-1 overflow-y-auto px-6 pb-8"\s*\n\s*}, list\.length === 0/);
});
