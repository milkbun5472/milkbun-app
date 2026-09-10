const fs = require("fs");
const assert = require("assert");

const app = fs.readFileSync("js/app.js", "utf8");
const components = fs.readFileSync("js/components.js", "utf8");

assert(app.includes('该成员此刻穿着一句（保持连续；但必须跟场合对得上，在外面不可能还穿着睡衣）'), "group output must request wearing state, coherent with the setting");
// v66.62：「（每次更新）」那句删了——它跟单聊那条正好反着（那边写的是「事实没变就原样填写」），
// 后果是同一个人连发三条得各编一个新动作，太贵，于是模型一个人只发一条，一轮里就不接话了。
// 要证的还是【群里照旧要这一格】，不是它当初怎么措辞的。
assert(/\\"action\\":\\"该成员此刻正在做的事/.test(app), "group output must request hidden action state");
assert(app.includes('当前事实没变、原来那句仍然准确时【原样填写】'), "action spec must match the 1:1 one, not contradict it");
// ⚠️只对着【发出去的那一格】断言：注释里那句是病历（写着为什么改），
// 连注释一起匹配的话，越把原因写清楚测试越红。
const _actField = app.slice(app.indexOf('const gActionField ='), app.indexOf('const thoughtField ='));
assert(!/\\"action\\"[^\n]*（每次更新）/.test(_actField), "那句反着的措辞还在发出去的那一格里");
assert(app.includes('...(gWear ? { wearing: gWear, wearingUpdatedAt: stateNow } : {})'), "group replies must persist wearing with its own freshness clock");
assert(app.includes('...(gAction ? { action: gAction, actionUpdatedAt: stateNow } : {})'), "group replies must persist action with its own freshness clock");
// 组件保留 hideWearAction 能力，但 App 不再对群聊打开的卡片启用它（她 2026-08-18 要回穿着/动作）
// ⚠️别冻这两处的写法：v59.77 心声卡重做了（居中框、三栏、历史那一段的变量改叫 s2）。
// 要证的是【那个「群聊里藏起穿着/动作」的能力还在】，不是它长什么样。
assert(/!hideWearAction && \(\w+\.wearing \|\| \w+\.action\)/.test(components), "state card keeps the hide capability");
assert(/\(!hideWearAction && seen\.length\)/.test(components), "live state card keeps the hide capability");
assert(!/hideWearAction:\s*stateCardGroup/.test(app), "group-opened state card must no longer hide wearing/action");

console.log("group hidden live state tests passed");
