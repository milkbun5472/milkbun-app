const fs = require("fs");
const assert = require("assert");

const app = fs.readFileSync("js/app.js", "utf8");
const components = fs.readFileSync("js/components.js", "utf8");

assert(app.includes('该成员此刻穿着一句（保持连续；但必须跟场合对得上，在外面不可能还穿着睡衣）'), "group output must request wearing state, coherent with the setting");
// v66.62：「（每次更新）」那句删了——它跟单聊那条正好反着（那边写的是「事实没变就原样填写」），
// 后果是同一个人连发三条得各编一个新动作，太贵，于是模型一个人只发一条，一轮里就不接话了。
// 要证的还是【群里照旧要这一格】，不是它当初怎么措辞的。
// v67.18：这一格的措辞抽成了 G_ACTION_SPEC 一份。她 2026-09-11 又报了一次
// 「有我的群还是一句一个动作」——病根是【心声与心情】那一段里还留着
// 「每次随情境更新、别照抄上一动作」，跟这一格正好反着，而那一段只在记忆互通开着时发，
// 互通正是「有我的群」的常态。所以现在证的是：两处都从同一份取。
assert(/const gActionField = ",\\"action\\":\\"" \+ G_ACTION_SPEC/.test(app), "group output must request hidden action state");
// v67.26：这一格的【定义】也搬进了 engine.js 的 ACT_MEANING——跟单聊一模一样的那句话。
// 原来群聊写的是「发这句话时正在做的一件事」，按定义每句一换，
// 于是「没变就原样填写」永远用不上（她 2026-09-12：「群聊连续发两三天还是每轮都有动作」）。
const _actMeaning = (fs.readFileSync("js/engine.js", "utf8").match(/const ACT_MEANING = "([^"]+)";/) || [])[1] || "";
assert(/当前事实未变且原表述仍准确时，可以原样填写/.test(_actMeaning), "action spec must match the 1:1 one, not contradict it");
assert(/所处的活动状态/.test(_actMeaning), "action 得是能持续的状态，不是「说这句话时」的小动作");
// ⚠️先剥注释：app.js 里那段病历写着「原来这儿写的是「发这句话时正在做的一件事」」，
// 连注释一起搜的话，越把原因写清楚这条越红（这几天第八次踩这个坑）。
assert(!/发这句话时正在做的一件事/.test(app.split("\n").map(l => l.split("//")[0]).join("\n")),
  "群聊那边按句计的定义又长回来了");
assert(/action 就是" \+ G_ACTION_SPEC \+ "/.test(app), "记忆互通那一段也得从同一份取，不许自己再写一份");
// ⚠️只对着【发出去的那几格】断言：注释里那句是病历（写着为什么改），
// 连注释一起匹配的话，越把原因写清楚测试越红。
const _noComment = app.split("\n").map(l => l.split("//")[0]).join("\n");
assert(!/每次随情境更新/.test(_noComment), "那句反着的措辞又长回来了");
assert(app.includes('...(gWear ? { wearing: gWear, wearingUpdatedAt: stateNow } : {})'), "group replies must persist wearing with its own freshness clock");
assert(app.includes('...(gAction ? { action: gAction, actionUpdatedAt: stateNow } : {})'), "group replies must persist action with its own freshness clock");
// 组件保留 hideWearAction 能力，但 App 不再对群聊打开的卡片启用它（她 2026-08-18 要回穿着/动作）
// ⚠️别冻这两处的写法：v59.77 心声卡重做了（居中框、三栏、历史那一段的变量改叫 s2）。
// 要证的是【那个「群聊里藏起穿着/动作」的能力还在】，不是它长什么样。
assert(/!hideWearAction && \(\w+\.wearing \|\| \w+\.action\)/.test(components), "state card keeps the hide capability");
assert(/\(!hideWearAction && seen\.length\)/.test(components), "live state card keeps the hide capability");
assert(!/hideWearAction:\s*stateCardGroup/.test(app), "group-opened state card must no longer hide wearing/action");

console.log("group hidden live state tests passed");
