const fs = require("fs");
const path = require("path");

const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

assert(engine.includes("function offlineRewriteSentenceUnits(paragraph)"), "沉浸长文应具备细粒度编辑单元");
assert(engine.includes("fineGrained: lengthMode === \"immersive\""), "只有沉浸长文应启用细粒度 editor");
assert(engine.includes("paragraphIndex: segment.paragraphIndex"), "编辑结果应保留原段落归属");
assert(engine.includes('last.text += part.prose'), "同一原段落内的句级编辑结果应重新连续拼接");

console.log("offline immersive editor granularity tests passed");
