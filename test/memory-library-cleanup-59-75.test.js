"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const src = fs.readFileSync("js/screens.js", "utf8");
const start = src.indexOf("function MemoryLib(");
const end = src.indexOf("function MemCfgSheet(", start);
const memory = src.slice(start, end);

test("记忆库使用紧凑安全区顶栏，日常只露整理图标与新增", () => {
  assert.match(memory, /paddingTop: safeTop\(10\)/);
  assert.match(memory, /"MEMORY INDEX"/);
  assert.match(memory, /setManageOpen\(true\)/);
  assert.match(memory, /aria-label": "整理与维护"/);
  assert.match(memory, /h\(GConfig/);
  assert.match(memory, /aria-label": "新增记忆"/);
  assert.doesNotMatch(memory, /h\(Head, \{/);
});

test("导入、手动抽取、旧库补评与月度精炼都收进整理区，能力没有删除", () => {
  assert.match(memory, /"整理与维护"/);
  assert.match(memory, /"导入长文"/);
  assert.match(memory, /"从当前对话提取"/);
  assert.match(memory, /"导入旧长期记忆"/);
  assert.match(memory, /"补旧记忆情绪 · "/);
  assert.match(memory, /"旧版月度精炼 · "/);
});

test("整理工具进底部弹层，工程仪表再藏一层，主档案只有一个滚动容器", () => {
  assert.match(memory, /manageOpen \? h\(Sheet/);
  assert.match(memory, /setDiagOpen\(v => !v\)/);
  assert.match(memory, /h\(EventShelfSection/);
  assert.match(memory, /placeholder: "搜一句话、标签或记得这件事的人"/);
  assert.match(memory, /className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10"/);
});

test("档案索引保留角色与状态双层筛选，并把状态与来源收进卡片层级", () => {
  assert.match(memory, /const \[statusFilter, setStatusFilter\] = useState\("all"\)/);
  // ⚠️冻的是【有这两层筛选、各自带着自己的计数】，不是那几个标签长什么样。
  //   v60.53 把状态那排药丸换成了三张索引卡、把人名那行下划线换成了一排脸
  //   （tabs-not-plain-pills），行为一个字没变，原来那种逐字冻标签的断言却红了。
  assert.match(memory, /\["open", "未了", visibleOpenTotal\]|\["open", "未了 " \+ visibleOpenTotal\]/);
  assert.match(memory, /\["pinned", "常驻", pinnedTotal\]|\["pinned", "常驻 " \+ pinnedTotal\]/);
  assert.match(memory, /\[\["all", null\]\]\.concat\(characters|\[\["all", "所有人"\]\]\.concat\(characters/);
  assert.match(memory, /setStatusFilter\(id\)/, "状态那一层要能点");
  assert.match(memory, /setFilter\(id\)/, "角色那一层要能点");
  assert.match(memory, /audienceOf\(e\) \+ " · " \+ sourceLabelOf\(e\)/);
  assert.match(memory, /"历史索引"/);
  assert.match(memory, /\(e\.tags \|\| \[\]\)\.slice\(0, 2\)/);
});
