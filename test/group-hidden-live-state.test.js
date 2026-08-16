const fs = require("fs");
const assert = require("assert");

const app = fs.readFileSync("js/app.js", "utf8");
const components = fs.readFileSync("js/components.js", "utf8");

assert(app.includes('该成员此刻穿着一句（保持连续）'), "group output must request hidden wearing state");
assert(app.includes('该成员发言时正在做的简短动作（每次更新）'), "group output must request hidden action state");
assert(app.includes('...(gWear ? { wearing: gWear, wearingUpdatedAt: stateNow } : {})'), "group replies must persist wearing with its own freshness clock");
assert(app.includes('...(gAction ? { action: gAction, actionUpdatedAt: stateNow } : {})'), "group replies must persist action with its own freshness clock");
assert(components.includes('!hideWearAction && (s.wearing || s.action)'), "group-opened thought history must keep wear/action hidden");
assert(components.includes('state && !hideWearAction'), "group-opened live state card must keep wear/action cards hidden");

console.log("group hidden live state tests passed");
