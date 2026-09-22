// 线下重 Roll＝回到那一格重新开始（她 2026-09-22：「重roll意义就是回退到几轮前重新开始」）。
// ① 超过回退点的前情提要段要撕掉；② 只由被删角色消息撑着的自动记忆要撤；
// ③ 群线下亲密戏也要补人物连续那一句（和单人线下共用一份）。
const assert = require("assert");
const fs = require("fs");
const RB = require("../js/reroll-branch.js");

const msgs = [];
for (let i = 0; i < 40; i++) msgs.push({ id: "m" + i, role: i % 2 ? "char" : "user", senderId: i % 2 ? "c1" : undefined, content: "x" + i });
const sess = {
  msgs, summary: "A\nB", lastSummarizedCount: 30,
  sumSegs: [{ upTo: 10, seg: "A", memIds: ["sa"] }, { upTo: 30, seg: "B", memIds: ["sb"] }]
};
const lib = [
  { id: "e_char", source: "auto", evidenceMessageIds: ["m21", "m23"] },
  { id: "e_mixed", source: "auto", evidenceMessageIds: ["m22", "m23"] },   // 她的原话参与了证据：保留
  { id: "e_before", source: "auto", evidenceMessageIds: ["m5"] },
  { id: "e_manual", source: "manual", evidenceMessageIds: ["m21"] },
  { id: "sa", source: "auto" }, { id: "sb", source: "auto" }
];

// 回到第 20 条：B 段（总结到 30）撕掉，A 段留
let c = RB.offlineRerollCut(sess, 20, lib);
assert.strictEqual(c.summary, "A");
assert.strictEqual(c.lastSummarizedCount, 10);
assert.strictEqual(String(c.sumSegs.map(g => g.seg)), "A");
assert.strictEqual(String(c.doomedMemIds.sort()), "e_char,sb");

// 回退点在已总结处之后：提要不动
c = RB.offlineRerollCut(sess, 35, lib);
assert.strictEqual(c.summary, "A\nB");
assert.strictEqual(c.lastSummarizedCount, 30);

// 老场次没 sumSegs：回退早于已总结处 → 整份作废，改回逐条喂原文
c = RB.offlineRerollCut({ msgs, summary: "旧提要", lastSummarizedCount: 30 }, 20, []);
assert.strictEqual(c.summary, "");
assert.strictEqual(c.lastSummarizedCount, 0);

// 两处 reroll 都接上了同一个补丁
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const body = name => { const i = app.indexOf("const " + name + " = async"); assert(i > 0, name); return app.slice(i, app.indexOf("\n  };", i)); };
for (const n of ["offlineRerollMsg", "groupOfflineRerollMsg"]) {
  const b = body(n);
  assert(/offlineRerollPatch\(sess, idx,/.test(b), n + " 要回退提要与记忆");
  assert(/\.\.\.cutPatch, msgs: truncated, rerollAvoid/.test(b), n + " 生成时要用回退后的提要");
}
assert.strictEqual((app.match(/offlineSumAppend\(s, seg,/g) || []).length, 2, "两个滚动总结都要按段记账");

// 群线下人物连续
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const g0 = eng.indexOf("async function generateOfflineGroup"); assert(g0 > 0);
const g = eng.slice(g0, eng.indexOf("\nasync function ", g0 + 10) > 0 ? eng.indexOf("\nasync function ", g0 + 10) : undefined);
assert(/offlineCharacterSupplyLine\(true\)/.test(g), "群线下要补人物连续");
const s0 = eng.indexOf("async function generateOffline(");
assert(/offlineCharacterSupplyLine\(false\)/.test(eng.slice(s0, g0)), "单人线下走同一份");
console.log("offline-reroll-rewind-73-07 ok");
