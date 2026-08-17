const fs = require("fs");
const assert = require("assert");

const app = fs.readFileSync("js/app.js", "utf8");
const components = fs.readFileSync("js/components.js", "utf8");

assert(app.includes('该成员此刻穿着一句（保持连续；但必须跟场合对得上，在外面不可能还穿着睡衣）'), "group output must request wearing state, coherent with the setting");
assert(app.includes('该成员发言时正在做的简短动作（每次更新）'), "group output must request hidden action state");
assert(app.includes('...(gWear ? { wearing: gWear, wearingUpdatedAt: stateNow } : {})'), "group replies must persist wearing with its own freshness clock");
assert(app.includes('...(gAction ? { action: gAction, actionUpdatedAt: stateNow } : {})'), "group replies must persist action with its own freshness clock");
// 组件保留 hideWearAction 能力，但 App 不再对群聊打开的卡片启用它（她 2026-08-18 要回穿着/动作）
assert(components.includes('!hideWearAction && (s.wearing || s.action)'), "state card keeps the hide capability");
assert(components.includes('state && !hideWearAction'), "live state card keeps the hide capability");
assert(!/hideWearAction:\s*stateCardGroup/.test(app), "group-opened state card must no longer hide wearing/action");

console.log("group hidden live state tests passed");
