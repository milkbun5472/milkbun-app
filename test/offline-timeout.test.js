const fs = require("fs");
const assert = require("assert");

const engine = fs.readFileSync("js/engine.js", "utf8");
const cloud = fs.readFileSync("js/cloud.js", "utf8");
const single = engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "";
const group = engine.match(/async function generateOfflineGroup\([\s\S]*?async function summarizeOfflineGroup/)?.[0] || "";

// 主调用与 no-cot 兜底重试都必须给满三分钟；wire capture 改了调用排版，所以按片段计数、不再钉整行格式。
assert((single.match(/timeout: 180000/g) || []).length >= 2,
  "single offline and its no-cot fallback must both allow three minutes");
assert.strictEqual((single.match(/maxTokens: generationBudget\b/g) || []).length, 2,
  "single offline and fallback must share the computed budget");
assert.match(single, /const generationBudget = generationMaxTokens;/);
const budgetExpr = single.match(/const generationMaxTokens = ([\s\S]*?);/);
assert(budgetExpr, "single budget definition missing");
const budget = new Function("window", "session", "minimumTokenBudget", "return " + budgetExpr[1]);
const ceiling = Number(fs.readFileSync("js/style-presets.js", "utf8").match(/const OUT_CEILING = (\d+);/)[1]);
const budgetWindow = { StylePresets: { OUT_CEILING: ceiling } };
assert.strictEqual(budget(budgetWindow, { maxTokens: 4000 }, 0), 8000);
assert.strictEqual(budget(budgetWindow, { maxTokens: 24000 }, 0), 24000);
assert.strictEqual(budget(budgetWindow, { maxTokens: 24000 }, ceiling * 2), ceiling);
assert((group.match(/timeout: 180000/g) || []).length >= 2,
  "group offline and its no-cot fallback must both allow three minutes");
assert.strictEqual((group.match(/maxTokens: gBudget\b/g) || []).length, 2,
  "group offline and fallback must share the computed budget");
assert.match(group, /const gBudget = Math\.min\(window\.StylePresets\.OUT_CEILING,\s*Math\.max\(Number\(session\.maxTokens\) \|\| 1900, session\.minWords \? window\.StylePresets\.outTokens\(session\.minWords\) : 0\)\);/,
  "group budget must retain the user's length and token settings");
assert(cloud.includes("ctrl.signal.aborted"), "proxy timeout detection must use its own abort signal");
assert(cloud.includes("请求超时，请重试（模型或云端桥响应太慢）"), "proxy abort must become a readable timeout");

console.log("offline timeout tests passed");
