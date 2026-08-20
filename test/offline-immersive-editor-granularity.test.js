const fs = require("fs");
const path = require("path");

const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

assert(engine.includes("const singlePassRevisionRequested = explicitRevisionRequested || archetypeRevisionRequested"), "明确场景或强原型卡才请求单次自修");
assert(engine.includes('"draftScene":"内部完整首稿","scene":"基于前一字段完成的最终正文"'), "同一响应必须先返回首稿、再返回终稿");
assert(engine.includes("let scene = singlePassRevisionRequested ? singlePassFinalScene : draftScene"), "展示与入史必须使用同响应终稿");
const single = engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "";
assert(!single.includes("await offlineRewriteScene("), "单人线下主路径不得再发第二次 editor 请求");
assert(engine.includes("singlePassRevisionApplied: !!singlePassRevisionRequested"), "诊断必须明确记录单次自修是否生效");

console.log("offline single-pass revision tests passed");
