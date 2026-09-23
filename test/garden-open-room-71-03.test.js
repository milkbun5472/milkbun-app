"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");

// 她 2026-09-18（第二遍）：「点开房还是跳回主聊天！我不是叫你修了吗」
// 病根：换角色那个 effect 一跑就把 activeRoomId 打回 "main"，
// 所以「setActiveChar(她) + setActiveRoomId(那间房)」里的后一句当场被清掉。
test("带着某一间房进屋只有一处机制", () => {
  assert.match(app, /const enterRoom = \(who, roomId\) => \{/);
  assert.match(app, /enterRoom\(c, rid\); setChatRoomsOpen\(false\);/);
  assert.equal((app.match(/notificationRoomRef\.current = \{/g) || []).length, 1,
    "记这间房的地方多一处，就是改一处漏一处");
});

// 她 2026-09-18（第三遍）：「我有别的存档开新档也是跳到旧存档房间」
// ⚠️这一路的名字就叫【新开一档】，而一间房＝一个庭院存档：跳进旧那间，
//   她要的那一档根本没开出来，设定也一次都没让她设。
test("开新档一律去设定页，不许认领一间旧房间", () => {
  const fn = app.slice(app.indexOf("const openPresetRoomFor"), app.indexOf("const clearChatRoomRecords"))
    .split("\n").filter(line => !line.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(fn, /r\.garden/, "又去翻已有的庭院房了");
  assert.doesNotMatch(fn, /enterRoom\(/, "抄近路直接进旧房间");
  assert.match(fn, /roomPresetIntentRef\.current = preset;/);
});

// ⚠️一位可以有好几间庭院房，名字重了她自己分不出哪间是哪间
test("新房间的名字自己让开已有的那几间", () => {
  const kit = fs.readFileSync("js/components.js", "utf8");
  assert.match(kit, /const freshName = label => \{/);
  assert.equal((kit.match(/name: freshName\(p\.label\)/g) || []).length, 2, "开新房间的两处都要走它");
  assert.doesNotMatch(kit, /name: p\.label,/, "还有一处在用原样的名字");
});

// ⚠️本来就在这一位身上时那个 effect 根本不跑，ref 要是留着，下次换到这一位会莫名落进旧房间
test("没换人就不许留下这张纸条", () => {
  const fn = app.slice(app.indexOf("const enterRoom = (who, roomId)"), app.indexOf("useEffect(() => {\n    const pending"));
  assert.match(fn, /if \(!activeChar \|\| String\(activeChar\.id\) !== String\(who\.id\)\)/);
});

// 从游戏里给 TA 新开一间：先去设定页，不许先闪一眼主聊天
test("新开一间还是先定设定，建好才进那间房", () => {
  assert.match(app, /roomPresetIntentRef\.current = preset;/);
  // ⚠️只钉代码，注释里也写着这句（施工规则/anchor-on-code.md）
  const fn = app.slice(app.indexOf("const openPresetRoomFor"), app.indexOf("const clearChatRoomRecords"))
    .split("\n").filter(line => !line.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(fn.slice(fn.indexOf('roomPresetIntentRef.current = preset')), /setScreen\("thread"\)/,
    "设定页出来之前先闪一眼主聊天，点「算了」还被丢在那儿");
});
