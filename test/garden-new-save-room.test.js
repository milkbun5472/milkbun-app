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
  // 现在没有「不挑人」那条路了：挑了谁，就给谁开一间

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
  const make = app.slice(app.indexOf("const openGardenRoomFor"), app.indexOf("const clearChatRoomRecords"));
  const ref = make.indexOf('roomPresetIntentRef.current = "garden";');
  assert.ok(ref > -1 && ref < make.lastIndexOf("setActiveChar(who);"),
    "意图要在换角色【之前】立好，不然那个 effect 跑的时候读不到");
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
  assert.match(garden, /const pickForNew = id => \{ setPicking\(false\); if \(id\) props\.onNewGardenRoom\(id\); \};/,
    "示例同行者那条路撤了：挑了人才有下文，没有 else 那一支");
  assert.match(garden, /onClick: \(\) => setPicking\(true\)/, "「＋ 新开一段」只剩挑人这一条路");
  assert.match(garden, /if \(picking\) return shell\("给谁开一段"/);
  assert.match(garden, /那一档【不属于任何人、也不挂任何房间】/);
});

// ⚠️「这一步执行完，有没有哪一份数据只剩一个副本了」——以前开的那些示例档不许弄没
test("以前开的示例档照样列着、照样进得去", () => {
  assert.match(garden, /\[pick, setPick\] = useState\(!initial\.current\.partnerId && !props\.startSolo\)/);
  assert.match(garden, /\[solo, setSolo\] = useState\(!!props\.startSolo\)/);
  assert.match(garden, /startSolo: openSolo/);
  assert.match(garden, /card\(\(\) => \{ setOpenSolo\(!meta\.partnerId\); setOpenId\(saveKeyOf\(row\)\); \}/,
    "没有同行者的旧档要直接进去，不能摆一张它逃不掉的选人页");
  // 撤掉一件东西就把它删掉，不许留在原地当死代码
  assert.doesNotMatch(garden, /const createSolo = /);
  // read() 兜底那份空存档还要留着
  assert.match(garden, /const blankSave = \(\) => \(\{ version: 1, id: "garden_"/);
  assert.equal((garden.match(/version: 1, id: "garden_"/g) || []).length, 1, "空存档长什么样只许写在一处");
});

// 选人那一页只留一份（新开一段 / 在庭院里另开一间）
test("选人那一页只有一份", () => {
  assert.match(garden, /function partnerPickBody\(\{ characters, live, note, onPick, error \}\)/);
  assert.equal((garden.match(/partnerPickBody\(\{/g) || []).length, 3, "定义一处、两处调用");
  assert.doesNotMatch(garden, /\}, "先和示例同行者试玩"\)/, "那条出口撤了");
  // ⚠️写成函数：好几条测试把这个文件按段抠出来在 vm 里跑，模块加载就取 F_BODY 会当场红
  assert.match(garden, /const pickButtonStyle = \(\) => \(\{/);
});

// 她 2026-09-18：「从游戏新开档怎么跳回主聊天了，能不能调到设置房间那屏幕上」
test("从游戏开新档不切屏：设定页浮在庭院上面，不先闪一眼主聊天", () => {
  const make = app.slice(app.indexOf("const openGardenRoomFor"), app.indexOf("const clearChatRoomRecords"));
  assert.doesNotMatch(make, /setScreen\("thread"\);\s*\n?\s*\/\/ 本来就在这一位身上/, "又在设定页之前切屏了");
  assert.match(make, /⚠️不切屏：房间面板是画在外壳上的/);
  // 已经有一间庭院房的那条路仍旧直接进那间房
  // ⚠️已经有一间庭院房也不抄近路进去了（她 2026-09-18 第三遍：「开新档也是跳到旧存档房间」）
  assert.doesNotMatch(make, /if \(live\)/);
  // 建好了才去那间房
  assert.match(app, /if \(close\) \{ if \(chatRoomsPreset\) setScreen\("thread"\);/);
});

// ⚠️她要的是【把这间房设好】这一件事，不是房间总览
test("带着预设来的那一屏只有设定，没有房间列表和另外三个预设", () => {
  assert.match(comp, /const soloCreate = !!initialPreset;/);
  assert.match(comp, /soloCreate \? null : h\(Eyebrow, \{ style: \{ marginTop: 18, marginBottom: 8 \} \}, "进去继续"\)/);
  assert.match(comp, /soloCreate \? null : h\(Eyebrow, \{ style: \{ marginTop: 22, marginBottom: 8 \} \}, "新留一间"\)/);
  assert.match(comp, /soloCreate \? "新开一间" \+ \(Kit\.PRESETS\[initialPreset\] \|\| \{\}\)\.label/);
  assert.match(comp, /soloCreate \? "先把这间房的设定定好，建好就进去。"/);
  // 「算了」在这一屏上＝退出去（这一屏根本没有总览可退）
  assert.match(comp, /if \(soloCreate\) return onClose\(\); setCreating\(false\); pick\(activeRoomId \|\| "main"\);/);
});
