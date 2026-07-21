const fs = require("fs");
const assert = require("assert");

const engine = fs.readFileSync("js/engine.js", "utf8");
const cloud = fs.readFileSync("js/cloud.js", "utf8");

assert((engine.match(/maxTokens: session\.maxTokens \|\| 1400, timeout: 180000/g) || []).length === 2,
  "single offline and its no-cot fallback must both allow three minutes");
assert((engine.match(/maxTokens: session\.maxTokens \|\| 1900, timeout: 180000/g) || []).length === 2,
  "group offline and its no-cot fallback must both allow three minutes");
assert(cloud.includes("ctrl.signal.aborted"), "proxy timeout detection must use its own abort signal");
assert(cloud.includes("请求超时，请重试（模型或云端桥响应太慢）"), "proxy abort must become a readable timeout");

console.log("offline timeout tests passed");
