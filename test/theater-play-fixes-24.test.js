const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "js/theater.js"), "utf8");
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return src.slice(i, j); };

test("重开此线连账本一起清,旧局的前情不会混进新局", () => {
  const r = cut("const restartLineNow = async", "const endLine = ");
  assert.match(r, /ledger: null, sumSig: ""/);
});

test("演出切历史认 sumDone,和压缩用同一个数", () => {
  const send = cut("const send = async", "const confirmGoal = ");
  assert.match(send, /allMsgs\(line\)\.slice\(sumDone\(line\)\)/);
  assert.doesNotMatch(send, /slice\(line\.sumCount/);
  const sum = cut("const maybeSummarize = async", "const line = lines.find");
  assert.match(sum, /const done = sumDone\(l\);/);
});

test("逐句喂的窗口不短于压缩阈值 48,中间不留空档", () => {
  const send = cut("const send = async", "const confirmGoal = ");
  const n = +(send.match(/\.slice\(-(\d+)\)\.map\(m =>/) || [])[1];
  assert.ok(n >= 48, "窗口只有 " + n);
});

test("走死的轮次不再朝原目标推", () => {
  const send = cut("const send = async", "const confirmGoal = ");
  assert.equal((send.match(/round\.failed \?/g) || []).length, 2, "模型那份和言秋那份都要接上");
});

test("不满三句报的达成先暂存,不再扔掉", () => {
  const send = cut("const send = async", "const confirmGoal = ");
  assert.match(send, /earlyReach:/);
  assert.match(send, /\(reachNow\(r\) \|\| r\.earlyReach\)/);
});

test("目标是远处落点,不是下一步提示", () => {
  const g = cut("const GOAL_RULE = ", "const DIFF = ");
  assert.match(g, /远处落点/);
});
