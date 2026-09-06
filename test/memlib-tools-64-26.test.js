// 她 2026-09-06 指着记忆库整理页那一屏问：「这堆是不是没用了可以不要了」。
//
// 查下来【不全是】。十二颗一模一样的虚线药丸摞在一起，里头混了三类东西：
//   · 真工具（清重复／收拢事件／清仓／核对云端）——按下去会改东西
//   · 开关（A 立体情绪 / E 余温）——v62.37 起两层就是常开的，那两颗是全 app
//     唯一能急停的地方；按钮上却还写着「查看纯影子诊断」，名字停在它们还是影子那会儿
//   · 真仪表（评审包／五感／关系轴／同步状态…）——只显示数字
// 名字全长得一样，所以整堆一起被当成没用的。
//
// ⚠️分堆的判据不是「它是不是影子」，是【按下去会不会改变什么】。
//   按前一个判据分，结局冲突和核对云端会被误删——前者会真的改一条记忆的
//   「未了／闭环」，后者是存档丢过两次之后那把尺子（never-say-delete-first.md）。
//
// 另外揪出来一件她按次计费最该知道的事：B 关系轴是唯一每轮真发一次 callAI 的
// 影子层，产出只进那个她从没打开过的面板。她定：关掉。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const screens = R("js/screens.js"), html = R("index.html");
const sheet = (() => {
  const i = screens.indexOf("// ── 这一片重排（v64.26");
  const j = screens.indexOf('}, "收起整理工具")', i);
  assert.ok(i > 0 && j > i, "整理页那一片没切到");
  return screens.slice(i, j);
})();
// ⚠️问「界面上还有没有」的时候必须只看【字符串字面量】，不能整段扫：
//   整段扫的话我自己写的注释（里头照样会提到「迁移390条」「纯影子诊断」「⚠」）
//   会让这几条永远红。第一版就是这么写错的。
const codeOnly = sheet.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
const labels = (codeOnly.match(/"[^"\n]*"/g) || []).map(x => x.slice(1, -1));

test("B 关系轴：真的一行模型调用都不发了", async () => {
  const B = require("../js/inner-life-b-shadow.js");
  let detectorCalled = false;
  // 用原来在名单上的那个 id——它当初就是会跑的那个，最能证明现在停了
  const r = await B.observe({
    ownerId: "o", char: { id: "char_1783061729716", name: "某人" },
    messages: [{ role: "user", content: "在吗" }, { role: "assistant", content: "在。" }],
    runDetector: async () => { detectorCalled = true; return {}; }
  });
  assert.equal(detectorCalled, false, "还在发模型调用");
  assert.deepEqual(r, { skipped: true });
  // 闸只有这一处：调用点那边不许再加第二道（「一层写在两处，第二处没跟上」）
  assert.match(R("js/inner-life-b-shadow.js"), /const PILOTS=Object\.freeze\(\{\}\);/);
  assert.match(R("js/app.js"), /if \(!char \|\| !window\.InnerLifeBShadow \|\| !window\.InnerLifeBShadow\.pilotFor\(char\)\) return;/);
});

test("C 睡眠那条线整条删干净，不是留着说它没用", () => {
  // 模块在 app/engine 里 0 引用＝什么都没在记，面板只可能是空的
  ["InnerLifeCSleepShadow", "InnerLifeCSleepCore"].forEach(g =>
    assert.equal((R("js/app.js") + R("js/engine.js")).indexOf(g), -1, g + " 又被接上了？那这条不该删"));
  ["InnerLifeCDiagnosticSheet", "cSleepOpen", "setCSleepOpen", "C 睡眠与发声闸"].forEach(x =>
    assert.equal(screens.indexOf(x), -1, "screens 里还留着 " + x));
  assert.equal(html.indexOf("c-sleep"), -1, "index.html 还在下载这两个没人用的模块");
});

test("从来没显示过的那颗也删了（onShadowMigrate 压根没传过）", () => {
  assert.equal(screens.indexOf("onShadowMigrate"), -1, "screens 里还收着这个 prop");
  assert.equal(R("js/app.js").indexOf("onShadowMigrate"), -1);
  assert.equal(codeOnly.indexOf("只把锁定的390条"), -1, "那颗死按钮还在");
  // migrationBusy 不是死的：另一颗「逐 ID 验收」还在用，别顺手删掉
  assert.match(sheet, /migrationBusy \? "正在逐 ID 验收…" : "逐 ID 验收并启用新记忆表"/);
});

test("会改东西的留在外面，只显示数字的收进那一折", () => {
  const fold = sheet.indexOf("diagOpen ? h(React.Fragment, null,");
  assert.ok(fold > 0, "工程仪表那一折没了");
  const outside = sheet.slice(0, fold), inside = sheet.slice(fold);
  // 外面：四样会改东西的 + 两颗急停
  ["扫描重复记忆", "收拢同一事件进展", "日常流水清仓", "核对本机与云端记忆",
   "记忆的结局对不上", "立体情绪 · 开着", "余温与潮汐 · 开着"].forEach(x =>
    assert.ok(outside.includes(x), x + " 被收进折叠里了——它按下去会改东西"));
  // 里面：只显示数字的
  ["导出一份评审包", "五感系统", "关系轴 · 已停", "行级影子同步状态"].forEach(x =>
    assert.ok(inside.includes(x), x + " 跑到外面来了——它只是个数字"));
  ["扫描重复记忆", "核对本机与云端记忆"].forEach(x =>
    assert.equal(inside.indexOf(x), -1, x + " 在折叠里还有一份，等于两处"));
});

test("A / E 两颗改口说人话：它们是急停，不是诊断", () => {
  // 「纯影子诊断」这个说法在整理页里一处都不该剩——它们早就不是影子了
  assert.deepEqual(labels.filter(x => x.includes("纯影子诊断")), []);
  assert.match(sheet, /"立体情绪 · 开着 · 点进去可急停"/);
  assert.match(sheet, /"余温与潮汐 · 开着 · 点进去可急停"/);
  // 面板本身一个都没删——那才是急停键待的地方
  ["setAEmoOpen", "setInnerLifeOpen"].forEach(x => assert.ok(sheet.includes(x), x + " 的入口没了，急停就按不着了"));
  assert.match(screens, /innerLifeOpen \? h\(InnerLifeEDiagnosticSheet/);
  assert.match(screens, /aEmoOpen \? h\(InnerLifeADiagnosticSheet/);
});

test("结局冲突：有才出现，而且只在整理页打开时才去数", () => {
  assert.match(sheet, /repairConflictN > 0 \? h\("button"/, "又变回一直显示了");
  assert.match(sheet, /"有 " \+ repairConflictN \+ " 条记忆的结局对不上 · 你来定"/);
  // ⚠️别挂在整个记忆库上：那是每次进记忆库都白读一次 IDB
  const eff = screens.slice(screens.indexOf("const [repairConflictN"), screens.indexOf("const [repairConflictN") + 700);
  assert.match(eff, /if \(!manageOpen \|\| !onListRepairConflicts\) \{ return; \}/);
  assert.match(eff, /\}, \[manageOpen, onListRepairConflicts\]\);/);
  // 组件还在：这颗按下去会真的改记忆的「未了／闭环」，是那些冲突唯一的入口
  assert.match(screens, /repairConflictOpen \? h\(MemoryRepairConflictSheet/);
  assert.match(R("js/app.js"), /await window\.OpenRepairShadow\.decideConflict\(id,decision\);saveMemLib\(next\);/);
});

test("这一片里不留 emoji", () => {
  const bad = labels.filter(x => /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(x));
  assert.deepEqual(bad, [], "界面上还剩 emoji：" + bad.join(" | "));
  // 折叠那颗的 ▾ ▸ 是箭头不是 emoji，别顺手误伤
  assert.ok(labels.includes("收起 ▾") && labels.includes("展开 ▸"));
});
