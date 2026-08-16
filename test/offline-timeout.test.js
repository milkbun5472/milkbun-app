const fs = require("fs");
const assert = require("assert");

const engine = fs.readFileSync("js/engine.js", "utf8");
const cloud = fs.readFileSync("js/cloud.js", "utf8");
const single = engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "";
const group = engine.match(/async function generateOfflineGroup\([\s\S]*?async function summarizeOfflineGroup/)?.[0] || "";

// 主调用与 no-cot 兜底重试都必须给满三分钟；wire capture 改了调用排版，所以按片段计数、不再钉整行格式。
assert((single.match(/timeout: 180000/g) || []).length >= 2,
  "single offline and its no-cot fallback must both allow three minutes");
assert(single.includes("maxTokens: session.maxTokens || 4000"),
  "single offline keeps its 4000-token budget");
assert((group.match(/timeout: 180000/g) || []).length >= 2,
  "group offline and its no-cot fallback must both allow three minutes");
assert(group.includes("maxTokens: session.maxTokens || 1900"),
  "group offline keeps its 1900-token budget");
assert(cloud.includes("ctrl.signal.aborted"), "proxy timeout detection must use its own abort signal");
assert(cloud.includes("请求超时，请重试（模型或云端桥响应太慢）"), "proxy abort must become a readable timeout");

console.log("offline timeout tests passed");
