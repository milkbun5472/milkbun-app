// 她 2026-09-14：「所以现在记忆库不会重新总结线下总结过的？」——当时的答案是【还会】。
//
// 一场线下往记忆库写两次：滚动总结每攒够一段写一批，结束那一趟拿【整场】再写一批。
// 两次是独立生成、措辞不一样，isDupMem 只认字面包含，认不出来。
// v68.27 试过事后按场次号把滚动写的标 superseded，当天撤了（会连她手改的、钉住的
// 一起收走，还绕过云端确认）。所以改成从源头少写一份：已经记过的原文发回去，只写没记过的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

const blockFn = (() => {
  const i = eng.indexOf("function offlineSummaryAvoidBlock(already) {");
  assert.ok(i > 0, "没有这一层公共的");
  const src = eng.slice(i, eng.indexOf("\n}", i) + 2);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src + "\nthis.f = offlineSummaryAvoidBlock;", ctx);
  return ctx.f;
})();

test("一条都没记过就一个字都不发——空场不该白占额度", () => {
  assert.equal(blockFn([]), "");
  assert.equal(blockFn(null), "");
  assert.equal(blockFn(["", "   "]), "");
});

test("记过的原文发回去，并说清为什么不许重写一遍", () => {
  const s = blockFn(["甲说他小时候住在海边", "两个人吃了拉面"]);
  assert.match(s, /甲说他小时候住在海边/);
  assert.match(s, /两个人吃了拉面/);
  assert.match(s, /换个说法重写一遍不算新的/);   // 给理由，不是光下禁令
  assert.match(s, /会在库里变成两条/);
});

test("summary 明确放行：它要的是整场，不受这一段限制", () => {
  // 主句是禁令、后半句是放行——这是 no-yes-unless.md 允许的那一种形状
  const s = blockFn(["记过的一条"]);
  assert.match(s, /details 和 open 只给还没被记过的/);
  assert.match(s, /summary 不受这一段限制/);
});

test("发回去的那份有上限，一条也不许拖太长", () => {
  const many = Array.from({ length: 60 }, (_, i) => "第" + i + "条");
  const s = blockFn(many);
  assert.ok(s.indexOf("第19条") < 0, "超过 40 条还在往里塞");
  assert.match(s, /第59条/, "留的应该是最近那几条");
  assert.ok(blockFn(["甲" + "很".repeat(300)]).indexOf("很".repeat(130)) < 0, "单条没截断");
});

test("六处一样喂：单人/群 × 滚动/收尾/补总结，一处都不许漏", () => {
  // v69.05 起多了「重新总结这一场」那两处（单人+群）：补的那一枪同样要把这一场
  // 已经记进记忆库的发回去，否则补一次就把同一件事又记一遍。
  assert.equal((app.match(/offlineRecordedOf\(sess\.id\)/g) || []).length, 6, "六个调用点没都带上已记过的那份");
  assert.match(eng, /async function summarizeOffline\(p, ctx, session, already\)/);
  assert.match(eng, /async function summarizeOfflineGroup\(p, ctx, session, already\)/);
  assert.equal((eng.match(/\+ offlineSummaryAvoidBlock\(already\);/g) || []).length, 2, "两个总结函数没都拼上");
});

test("拼在 system 里，不是塞进 user（施工规则/prompt-send-shape.md）", () => {
  // system 是「料」，user 只留那一句【线下经过】
  // ⚠️v72.03 起两处都改成 systemFor(quota, part)：归档总结要分段跑，system 得按【这是第几段】
  //   现拼一份（见 offline-summary-chunked-72-03）。摆的位置没变，还是 system 装料。
  [/const systemFor = \(q, part\) => offlineSummaryPartLine\(part, userName\)\s*\+ "把下面这段/,
   /const systemFor = \(q, part\) => offlineSummaryPartLine\(part, userName\)\s*\+ "把下面『/].forEach(re => assert.match(eng, re));
  // 发整场经过那一句只许有一处（公共的 offlineSummaryCall），user 那头仍然只有它
  assert.equal((eng.match(/content: "【线下经过】\\n" \+ body/g) || []).length, 1);
  assert.equal((eng.match(/content: "【线下经过】/g) || []).length, 1, "又有第二条路在发整场经过");
});

test("靠 ofs 场次号认人，而且只读不写", () => {
  const i = app.indexOf("const offlineRecordedOf = sessId =>");
  assert.ok(i > 0);
  const fn = app.slice(i, i + 260);
  assert.match(fn, /e\.ofs === sessId/);
  assert.match(fn, /\.map\(e => String\(e\.text\)\)/);
  // 不许再出现事后收起来那一套（v68.27 撤掉的那个）
  assert.doesNotMatch(app, /supersedeOfflineRolling/);
  assert.doesNotMatch(fn, /saveMemLib|setMemLib|surfaceState/);
});

test("写入方真的在写 ofs（施工规则/stub-from-the-writer.md）", () => {
  assert.match(app, /\.\.\.\(e\.ofs \? \{ ofs: String\(e\.ofs\) \} : \{\}\)/, "addMemEntry 白名单里没有 ofs，传了也会被静默丢掉");
  assert.ok((app.match(/ofs: sess\.id/g) || []).length >= 6, "写记忆那几处没都盖场次号");
});
