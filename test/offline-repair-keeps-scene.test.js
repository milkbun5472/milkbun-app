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

// v55.47 她试了还是丢：那是 Codex 那句「短稿不保存」的 throw 在起作用——
// 模型写了但没写够就整篇丢掉。她明确要求：宁可短也不要白写一场。
// 原意（不许把短稿伪装成达标）仍然成立，只是换个兑现方式：不是丢掉，是如实说它没写够。
test("写出来的正文一律保留，绝不因为没写够就丢", () => {
  assert.ok(!/本轮短稿未保存/.test(engine), "丢稿的 throw 不许再存在");
  assert.ok(!/throw new Error\("模型两次补写/.test(engine));
  assert.match(REPAIR, /shortCount: finalCount, shortTarget: target/);
  assert.match(REPAIR, /shortBecause: repairError \|\| "模型两次补写都没写够"/, "两种原因都要能说清");
  assert.match(REPAIR, /她 2026-08-22 明确要求：宁可短也不要白写一场/);
});

test("报数要具体：写了多少、想要多少、为什么没到", () => {
  assert.match(engine, /minimumLengthShortCount: minimumRepair\.shortCount \|\| 0/);
  assert.match(engine, /minimumLengthShortTarget: minimumRepair\.shortTarget \|\| 0/);
  assert.match(app, /这篇只写到 " \+ _got \+ " 字/);
  assert.match(app, /没到你设的 " \+ _want \+ " 字/);
  assert.match(app, /想更长就对这条点重写，或把最低字数调低一点/, "给两条能动手的路");
});

test("留了稿就要如实说，别让她以为设置没生效", () => {
  assert.match(engine, /minimumLengthShortBecause: minimumRepair\.shortBecause \|\| ""/);
  assert.match(app, /if \(res && res\.minimumLengthShortBecause\) \{/);
  assert.match(app, /正文已经保留/, "得说清没丢");
});

test("正常路径一个字没变", () => {
  // 够长时直接返回，不进循环
  assert.match(REPAIR, /if \(!target \|\| offlineVisibleCharCount\(current\) >= target\) \{\n    return \{ scene: current, attempts, applied: false \};/);
  // 补写成功仍然照旧覆盖
  assert.match(REPAIR, /if \(offlineVisibleCharCount\(candidate\) > currentCount\) current = candidate;/);
  assert.match(REPAIR, /while \(attempts < 2 && offlineVisibleCharCount\(current\) < target\)/);
});
