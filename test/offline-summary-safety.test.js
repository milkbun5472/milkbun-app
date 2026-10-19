// 群友 2026-10-19：线下开车开完，总结被安全审核拦下，整场一个字都记不下
const assert = require("node:assert/strict");
const eng = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
const pick = (a, b) => eng.slice(eng.indexOf(a), eng.indexOf(b, eng.indexOf(a)));
// Gemini 原生请求带上最松的审核
assert.match(eng, /safetySettings: GEMINI_SAFETY_OFF/);
assert.match(eng, /threshold: "BLOCK_NONE"/);
// 跑真的 runBlock：亲密那一截被拦，别的照常记下
const src = pick("const OFFLINE_SUM_BLOCKED", "const OFFLINE_SUM_FED_CAP") + "const OFFLINE_SUM_FED_CAP = 24000;\n"
  + pick("function offlineSummaryChunks", "// 场次越长") + pick("function offlineSummaryQuota", "async function offlineSummaryCall")
  + pick("async function offlineSummaryRunBlock", "// 太长就分段跑");
const run = async (body, failWhen) => {
  const offlineSummaryCall = async (p, sys, b) => { if (failWhen(b)) throw new Error("模型返回为空（停止原因：PROHIBITED_CONTENT）"); return { summary: "记了" + b.length, details: [], open: [] }; };
  const f = new Function("offlineSummaryCall", src + "; return offlineSummaryRunBlock;")(offlineSummaryCall);
  return f({}, () => "", body, { details: 6, open: 6 }, null);
};
(async () => {
  const lines = []; for (let i = 0; i < 60; i++) lines.push((i >= 20 && i < 30 ? "亲密" : "日常") + "第" + i + "行" + "字".repeat(200));
  const body = lines.join("\n");
  const out = await run(body, b => b === body || /亲密/.test(b));
  assert.match(out.summary, /记了/, "没被拦的那几截要照常记下");
  assert.match(out.summary, /被模型的内容审核拦下了/);
  // 一截都过不了：照实报错，不假装记好了
  await assert.rejects(run(body, () => true), /PROHIBITED_CONTENT/);
  // 不是审核的错（比如断网）照旧抛，不吞
  await assert.rejects((async () => {
    const f = new Function("offlineSummaryCall", src + "; return offlineSummaryRunBlock;")(async () => { throw new Error("网络断了"); });
    return f({}, () => "", "短", {}, null);
  })(), /网络断了/);
  console.log("ok");
})();
