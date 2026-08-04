const test = require("node:test");
const assert = require("node:assert/strict");
const BG = require("../js/background-generation.js");
const fs = require("node:fs");
const path = require("node:path");
const fanficSource = fs.readFileSync(path.join(__dirname, "../js/fanfic.js"), "utf8");

test("后台任务离开订阅者后仍完成，重进可读取结果", async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let notices = 0;
  const off = BG.subscribe("fanfic:test", () => { notices += 1; });
  const p = BG.start("fanfic:test", { label: "同人文生成中" }, async () => { await gate; return ["完成"]; });
  off(); // 模拟离开页面
  assert.equal(BG.state("fanfic:test").busy, true);
  release();
  await p;
  assert.equal(BG.state("fanfic:test").status, "done");
  assert.deepEqual(BG.state("fanfic:test").result, ["完成"]);
  assert.ok(notices >= 1);
});

test("同一 key 运行中重复启动只执行一次", async () => {
  let calls = 0;
  const first = BG.start("fanfic:dedupe", {}, async () => { calls += 1; return "ok"; });
  const second = BG.start("fanfic:dedupe", {}, async () => { calls += 1; return "duplicate"; });
  assert.equal(first, second);
  assert.equal(await second, "ok");
  assert.equal(calls, 1);
});

test("不同文章的追更任务可以各自运行，互不抢锁", async () => {
  const a = BG.start("fanfic:chapter:a", {}, async () => "a2");
  const b = BG.start("fanfic:chapter:b", {}, async () => "b2");
  assert.equal(await a, "a2");
  assert.equal(await b, "b2");
  assert.equal(BG.state("fanfic:chapter:a").status, "done");
  assert.equal(BG.state("fanfic:chapter:b").status, "done");
});

test("同人文批量与追更都使用后台任务，长文调用放宽到五分钟", () => {
  assert.match(fanficSource, /BackgroundGeneration\.start\(FANFIC_BATCH_TASK/);
  assert.match(fanficSource, /BackgroundGeneration\.start\(chapterTaskKey/);
  assert.ok((fanficSource.match(/timeout:\s*300000/g) || []).length >= 2);
});

test("超长文风按一篇一交并在每篇完成后立即落库", () => {
  assert.match(fanficSource, /LONG_STYLE_CHARS\s*=\s*6000/);
  assert.match(fanficSource, /oneByOne\s*=\s*n\s*>\s*1/);
  assert.match(fanficSource, /genBatch\(props\.active, curTab, chars, 1,/);
  assert.match(fanficSource, /saveFics\(part\.concat\(loadFics\(\)\)\)/);
});

test("有文风样例时学习句法而非在尾部重复禁词清单", () => {
  assert.match(fanficSource, /STYLE_DEEP_IMITATION/);
  assert.match(fanficSource, /借骨不借皮/);
  assert.match(fanficSource, /只换词不换句法/);
  assert.match(fanficSource, /opts\.style\s*&&\s*opts\.style\.trim\(\)\s*\?\s*fanficStyleTail\(opts\.style\)\s*:\s*FANFIC_ANTI_CLICHE_TAIL/);
  assert.match(fanficSource, /调色盘，不是每段都必须执行的流程图/);
  assert.match(fanficSource, /连续两段不得都以心理分析为主要内容/);
  assert.match(fanficSource, /严禁解释标题是什么意思/);
});

test("金鱼灯在同人文中使用精简小说适配版而非整份施工手册", () => {
  assert.match(fanficSource, /JINYUDENG_FANFIC_ADAPTER/);
  assert.match(fanficSource, /叙述者不替人物揭晓/);
  assert.match(fanficSource, /isJinyudengStyle\(text\)\s*\?\s*JINYUDENG_FANFIC_ADAPTER/);
  assert.match(fanficSource, /JINYUDENG_FANFIC_TAIL[\s\S]*FANFIC_ANTI_CLICHE_TAIL/);
});

test("同人文书架可导出诊断稿且新文章记录所用文风", () => {
  assert.match(fanficSource, /lisa_fanfic_audit/);
  assert.match(fanficSource, /lisa-fanfic-audit-/);
  assert.match(fanficSource, /generationStyleIds:\s*selectedStyleIds\.slice\(\)/);
  assert.match(fanficSource, /不含角色卡、聊天记录、密钥和书评/);
});
