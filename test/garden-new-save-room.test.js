"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const garden = fs.readFileSync("js/fairy-garden.js", "utf8");
const comp = fs.readFileSync("js/components.js", "utf8");

// 她 2026-09-18：「我不是说做从游戏开新档也先设置房间设定吗？
//                 不然我从游戏开了一档根本没连房间」
test("从游戏里挑手机里的一位，两个入口都去开房间", () => {
  // ⚠️原来这一句挂着 lockPartnerId：只有【已经在庭院房里】才走这条，
  //   首页那个入口挑人只把 partnerId 写进公共那一档——一间房都没有。
  assert.match(garden, /if \(id && props\.onNewGardenRoom\) \{ setPick\(false\); props\.onNewGardenRoom\(id\); return; \}/);
  assert.doesNotMatch(garden, /props\.lockPartnerId && props\.onNewGardenRoom\) \{ setPick/);
  // 「先和示例同行者试玩」(id 为空) 才留在公共那一档，那一档本来就不属于谁
  assert.match(garden, /挑示例同行者（id 为空）才走下面那条：那一档本来就不属于谁，所以不挂房间/);
  assert.equal((app.match(/onNewGardenRoom: openGardenRoomFor/g) || []).length, 2, "两个入口都要接上");
});

test("新开一间是【先设定、再建】，不是替她悄悄建掉", () => {
  assert.match(app, /setChatRoomsPreset\("garden"\); setChatRoomsOpen\(true\);/);
  assert.doesNotMatch(app, /Kit\.PRESETS\.garden/, "房间怎么建只有建房那一页说了算");
  assert.doesNotMatch(app, /const prepared = Kit\.prepareStart\(charId,/, "别处不许再自己 prepareStart 一份庭院房");
  // 那一页本来就把权限开关摆在创建表单里（她 2026-09-17 点名要的），这儿只是走到那儿
  assert.match(comp, /现在就能调，建好之后也随时能改/, "那一页的创建表单里要有权限开关");
  assert.match(comp, /initialPreset/);
});

// ⚠️换角色那个 effect 一看见 activeChar 变了就把房间面板关掉，
//   而「给 TA 新开一间」的第一步正是换角色——直接 setState 会被它当场清掉。
test("带着预设换过去，面板不会被换角色那一下清掉", () => {
  assert.match(app, /const roomPresetIntentRef = useRef\(""\);/);
  assert.match(app, /const intent = roomPresetIntentRef\.current; roomPresetIntentRef\.current = "";\s*\n\s*setChatRoomsOpen\(!!intent\); setChatRoomsPreset\(intent\);/);
  assert.match(app, /roomPresetIntentRef\.current = "garden";\s*\n\s*setActiveChar\(who\);/);
});

// ⚠️hook 排在提前 return 后面＝React #310 白屏（test/hooks-order.test.js 那条也盯着）
test("那一页接预设的两个 hook 排在提前 return 前面", () => {
  const body = comp.slice(comp.indexOf("function ChatRoomSheet("), comp.indexOf("function ChatRoomSheet(") + 4000);
  const hook = body.indexOf("const presetStarted = useRef(false);");
  const early = body.indexOf("if (!Kit || !draft) return");
  assert.ok(hook > 0 && early > 0, "抠不出那两处");
  assert.ok(hook < early, "hook 跑到提前 return 后面去了");
});

// ⚠️真正的「从游戏开新档」是选档页上那颗「＋ 新开一段」：
//   它原来直接写一条 g_xxx 进庭院自己那张名册就开了——那一档不属于任何人、
//   也不挂任何房间：没有聊天、没有记忆进出、没有一处能设权限。
test("「＋ 新开一段」先问给谁开，挑了人就去开房间", () => {
  assert.match(garden, /const pickForNew = id => \{ setPicking\(false\); if \(id\) props\.onNewGardenRoom\(id\); else createSolo\(\); \};/);
  assert.match(garden, /onClick: \(\) => \(props\.onNewGardenRoom \? setPicking\(true\) : createSolo\(\)\)/,
    "没有开房能力时（旧入口）还得能开示例档，不能点了没反应");
  assert.match(garden, /if \(picking\) return shell\("给谁开一段"/);
  assert.match(garden, /那一档【不属于任何人、也不挂任何房间】/);
});

// 「先和示例同行者试玩」本身就是一次回答，进去不许再问一遍
test("示例档直接进去，不再摆第二张选人页", () => {
  assert.match(garden, /\[pick, setPick\] = useState\(!initial\.current\.partnerId && !props\.startSolo\)/);
  assert.match(garden, /\[solo, setSolo\] = useState\(!!props\.startSolo\)/);
  assert.match(garden, /startSolo: openSolo/);
  // ⚠️那一档得当场落下来：原来是进去那次选人顺手写的，现在没人写它＝一进去就「存档已经切换」
  assert.match(garden, /try \{ write\(saveKeyOf\(\{ id: id \}\), blankSave\(\)\); \}/);
  assert.match(garden, /const blankSave = \(\) => \(\{ version: 1, id: "garden_"/);
  assert.equal((garden.match(/version: 1, id: "garden_"/g) || []).length, 1, "空存档长什么样只许写在一处");
});

// 选人那一页只留一份（新开一段 / 在庭院里另开一间）
test("选人那一页只有一份", () => {
  assert.match(garden, /function partnerPickBody\(\{ characters, live, note, onPick, error \}\)/);
  assert.equal((garden.match(/partnerPickBody\(\{/g) || []).length, 3, "定义一处、两处调用");
  assert.equal((garden.match(/\}, "先和示例同行者试玩"\)/g) || []).length, 1, "那一颗按钮也只许画一处");
  // ⚠️写成函数：好几条测试把这个文件按段抠出来在 vm 里跑，模块加载就取 F_BODY 会当场红
  assert.match(garden, /const pickButtonStyle = \(\) => \(\{/);
});
