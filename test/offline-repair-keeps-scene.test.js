const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-08-22：「同一个模型站子都在线下，没理由之前可以了突然又不行」。
// 说得对——变的是代码：Codex 的 v55.38 加了最低字数补写循环，而那次 callAI
// 外面【没有 try/catch】。第一段正文明明已经写好，补写请求一断网异常就穿出去，
// 整轮作废，界面上只剩一句 Load failed。之前没有这个循环，所以之前一直没事。

const REPAIR = (() => {
  const i = engine.indexOf("async function ensureOfflineMinimumScene");
  return engine.slice(i, engine.indexOf("\nasync function generateOffline", i));
})();

test("补写失败不许赔上已经写好的正文", () => {
  assert.match(REPAIR, /let raw;\n    try \{\n      raw = await callAI\(/, "补写调用必须包在 try 里");
  assert.match(REPAIR, /\} catch \(e\) \{[\s\S]{0,200}repairError = String/);
  assert.match(REPAIR, /问不成就停手，把已经写好的正文留住/);
  assert.match(REPAIR, /break;/, "问不成就别再撞第二次");
});

test("分清两种短稿：模型不肯写长 vs 压根没问成", () => {
  // 网络原因 → 留稿，如实上报
  assert.match(REPAIR, /if \(repairError\) return \{ scene: current, attempts, applied: attempts > 0, shortBecause: repairError, shortCount: finalCount \};/);
  // 模型确实写了但不肯写长 → 维持 Codex 的原意，照旧报错
  assert.match(REPAIR, /throw new Error\("模型两次补写后仍未达到最低字数/);
  assert.match(REPAIR, /维持 Codex 原意：不许把短稿伪装成达标/);
  // 顺序要紧：先判网络原因，否则照样丢稿
  assert.ok(REPAIR.indexOf("if (repairError)") < REPAIR.indexOf('throw new Error("模型两次补写'),
    "网络那条要排在 throw 前面");
});

test("留了稿就要如实说，别让她以为设置没生效", () => {
  assert.match(engine, /minimumLengthShortBecause: minimumRepair\.shortBecause \|\| ""/);
  assert.match(app, /if \(res && res\.minimumLengthShortBecause\) \{/);
  assert.match(app, /这篇没补到你设的最低字数/);
  assert.match(app, /正文已经保留，想要更长可以对这条点重写/, "得给下一步");
});

test("正常路径一个字没变", () => {
  // 够长时直接返回，不进循环
  assert.match(REPAIR, /if \(!target \|\| offlineVisibleCharCount\(current\) >= target\) \{\n    return \{ scene: current, attempts, applied: false \};/);
  // 补写成功仍然照旧覆盖
  assert.match(REPAIR, /if \(offlineVisibleCharCount\(candidate\) > currentCount\) current = candidate;/);
  assert.match(REPAIR, /while \(attempts < 2 && offlineVisibleCharCount\(current\) < target\)/);
});
