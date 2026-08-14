const fs = require("fs");
const path = require("path");

const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const components = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

assert(!engine.includes("写成一小段（约2到6句）"), "单人线下不应继续注入固定 2~6 句");
assert(engine.includes("本轮采用【自然长度】"), "应提供自然长度 runtime");
assert(engine.includes("本轮采用【沉浸长文】"), "应提供沉浸长文 runtime");
assert(engine.includes("一旦到了需要对方回应、选择或行动的位置，就自然停下"), "沉浸长文必须尊重用户回应边界");
assert(engine.includes("不要把一个简单动作拆成许多步骤"), "沉浸长文必须防摄影式拆动作");
assert(app.includes('lengthMode: osFor(charId).lengthMode || "natural"'), "App 应把单人篇幅模式传给生成器");
assert(components.includes('t: "自然长度"') && components.includes('t: "沉浸长文"'), "设置页应提供两种软篇幅模式");
assert(components.includes("高级 · 最低字数目标"), "最低字数应降为高级选项");

console.log("offline-length-mode tests passed");
