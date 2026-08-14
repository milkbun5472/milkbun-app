const fs = require("fs");
const path = require("path");

const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const components = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const singleOffline = engine.slice(engine.indexOf("async function generateOffline("), engine.indexOf("async function generateOfflineGroup("));

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

assert(!engine.includes("写成一小段（约2到6句）"), "单人线下不应继续注入固定 2~6 句");
assert(engine.includes("本轮采用【自然长度】"), "应提供自然长度 runtime");
assert(engine.includes("本轮采用【沉浸长文】"), "应提供沉浸长文 runtime");
assert(engine.includes("一旦到了需要对方回应、选择或行动的位置，就自然停下"), "沉浸长文必须尊重用户回应边界");
assert(engine.includes("不要把一个简单动作拆成许多步骤"), "沉浸长文必须防摄影式拆动作");
assert(engine.includes("先让这一刻真实发生，再决定哪些部分值得写下来"), "通用线下 Runtime 应采用选择性细节原则");
assert(engine.includes("【本场关注方式：自然】"), "默认口味应改为注意力驱动");
assert(engine.includes("新信息、新体验或实际推进"), "丰富细节应以信息、体验或推进为依据");
assert(!engine.includes("把这一刻演绎成有画面感的叙事"), "单人场景任务不应继续要求有画面感");
assert(!singleOffline.includes("动作、神态、心理、环境与对话都是可用镜头"), "单人场景任务不应继续使用镜头栏目");
assert(!engine.includes("【本场口味·构图不是清单】"), "默认口味标题不应继续使用构图措辞");
assert(!engine.includes("镜头自己寻找这一刻最有生命的地方"), "默认关注方式不应继续驱动镜头设计");
assert(!engine.includes("每句话都要带来新画面、新信息或新动作"), "丰富密度不应要求持续制造画面和动作");
assert(app.includes('lengthMode: osFor(charId).lengthMode || "natural"'), "App 应把单人篇幅模式传给生成器");
assert(components.includes('t: "自然长度"') && components.includes('t: "沉浸长文"'), "设置页应提供两种软篇幅模式");
assert(components.includes("高级 · 最低字数目标"), "最低字数应降为高级选项");

console.log("offline-length-mode tests passed");
