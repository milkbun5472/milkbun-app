"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const src = fs.readFileSync("js/screens.js", "utf8");
const start = src.indexOf("function MemoryLib(");
const end = src.indexOf("function MemCfgSheet(", start);
const memory = src.slice(start, end);

test("记忆库使用紧凑安全区顶栏，齿轮直达召回与上下文设置", () => {
  // ⚠️v62.71 改的是【判据的口径】，不是放宽：
  //   这一条写于 v59.75，那时 Head 自己还是「30px 大标题」，所以这一页只能手写一条紧凑栏，
  //   断言也就冻住了 `paddingTop: safeTop(10)` 和「不许用 Head」。
  //   v61.27 之后 Head 本身就是那条紧凑栏、自己吃安全区，
  //   施工规则/mobile-ui-layout.md §1 明写「别再自己写一条」——
  //   于是这条断言从「守着紧凑栏」变成了「拦着不许合规」。
  //   要守的东西一个字没变：**顶栏是紧凑的、日常只露整理和新增两颗键**。
  assert.match(memory, /h\(Head, \{\n?\s*zh: "记忆库", bg: "transparent", onBack: onBack,/, "顶栏没用公共 Head");
  assert.doesNotMatch(memory, /paddingTop: safeTop\(10\)/, "又自己写了一条顶栏");
  // 英文眉标撤掉（no-english-titles）；换的时候没有硬翻——副标题改说这一盒里此刻真有几张
  assert.doesNotMatch(memory, /"MEMORY INDEX"|"INDEX \/ "/, "英文眉标还在");
  assert.match(memory, /sub: activeTotal \? "在册 " \+ activeTotal \+ " 张" : null/);
  assert.match(memory, /"这一摞 " \+ list\.length \+ " 张"/);
  // 齿轮不再先打开工具目录，一下就进召回设置。
  assert.match(memory, /onClick: \(\) => setCfgOpen\(true\), "aria-label": "召回与上下文设置"/);
  assert.doesNotMatch(memory, /onClick: \(\) => \{ setManageOpen\(true\); setDiagOpen\(false\); \}/);
  assert.match(memory, /h\(GConfig/);
  assert.match(memory, /aria-label": "新增记忆"/);
});

test("旧整理工具目录不再渲染，主档案仍只有一个滚动容器", () => {
  assert.match(memory, /false && manageOpen \? h\(Sheet/);
  assert.match(memory, /h\(EventShelfSection/);
  assert.match(memory, /placeholder: "搜一句话、标签或记得这件事的人"/);
  assert.match(memory, /className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10"/);
});

test("召回设置半窗只留召回与上下文参数", () => {
  const cfg = src.slice(src.indexOf("function MemCfgSheet("), src.indexOf("function MemEntrySheet("));
  assert.match(cfg, /"自动抽取"/);
  assert.match(cfg, /"每轮召回条数 \(top-k\)"/);
  assert.match(cfg, /false && onPurgeWithered \? h\("div"/);
  assert.match(cfg, /false && h\("div", \{ style: \{ marginTop: 14/);
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
