"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");

// 她 2026-09-18（第二遍）：「点开房还是跳回主聊天！我不是叫你修了吗」
// 病根：换角色那个 effect 一跑就把 activeRoomId 打回 "main"，
// 所以「setActiveChar(她) + setActiveRoomId(那间房)」里的后一句当场被清掉。
test("带着某一间房进屋只有一处机制，点开庭院房就落在那间房里", () => {
  assert.match(app, /const enterRoom = \(who, roomId\) => \{/);
  assert.match(app, /if \(live\) \{ enterRoom\(who, live\.id\); setScreen\("thread"\); return live; \}/);
  // 通知那条路也走这一处，不留第二份手抄件
  assert.match(app, /enterRoom\(c, rid\); setChatRoomsOpen\(false\);/);
  assert.equal((app.match(/notificationRoomRef\.current = \{/g) || []).length, 1,
    "记这间房的地方多一处，就是改一处漏一处");
});

// ⚠️本来就在这一位身上时那个 effect 根本不跑，ref 要是留着，下次换到这一位会莫名落进旧房间
test("没换人就不许留下这张纸条", () => {
  const fn = app.slice(app.indexOf("const enterRoom = (who, roomId)"), app.indexOf("useEffect(() => {\n    const pending"));
  assert.match(fn, /if \(!activeChar \|\| String\(activeChar\.id\) !== String\(who\.id\)\)/);
});

// 从游戏里给 TA 新开一间：先去设定页，不许先闪一眼主聊天
test("新开一间还是先定设定，建好才进那间房", () => {
  assert.match(app, /roomPresetIntentRef\.current = "garden";/);
  // ⚠️只钉代码，注释里也写着这句（施工规则/anchor-on-code.md）
  const fn = app.slice(app.indexOf("const openGardenRoomFor = async charId"), app.indexOf("const clearChatRoomRecords"))
    .split("\n").filter(line => !line.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(fn.slice(fn.indexOf('roomPresetIntentRef.current = "garden"')), /setScreen\("thread"\)/,
    "设定页出来之前先闪一眼主聊天，点「算了」还被丢在那儿");
});
