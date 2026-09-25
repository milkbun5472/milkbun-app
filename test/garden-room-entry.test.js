"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const comp = fs.readFileSync("js/components.js", "utf8");
const rooms = fs.readFileSync("js/chat-rooms.js", "utf8");

// 她 2026-09-17：「从聊天进微光庭院房间不应该直接打开存档而是一个普通聊天」
test("庭院房先是一间普通聊天，按了才开存档", () => {
  assert.match(app, /gardenRoomOf\(activeChar\.id, activeRoomId\) && gardenOpen === activeRoomId/);
  assert.match(app, /onEnterGarden: gardenRoomOf\(activeChar\.id, activeRoomId\) \? world => \{ setGardenRoomWorld\(world === "train" \? "train" : "garden"\); setGardenOpen\(activeRoomId\); \} : null/);
  assert.match(comp, /onEnterGarden && h\(RoomWorldBanner/);
  assert.match(comp, /进入小世界/);
});

// 她本来就在这间房里
test("从庭院退出来是回这间房的聊天，不是回消息列表", () => {
  assert.match(app, /onBack: \(\) => setGardenOpen\(""\)/);
  const seg = app.slice(app.indexOf('storeKey: "x_fairyGarden::"'), app.indexOf('else if (screen === "thread" && activeChar) body'));
  assert.doesNotMatch(seg, /setScreen\("messages"\)/, "庭院房退出来不许跳回消息列表");
});

// ⚠️那一片 helper 区会被好几条测试单独抽出来跑
test("这个开关和别的 useState 放在一处", () => {
  const hook = app.indexOf('const [gardenOpen, setGardenOpen] = useState("")');
  assert.ok(hook > 0);
  assert.ok(hook < app.indexOf("const gardenRoomOf"), "不许写进 helper 那一片");
  assert.match(app, /把 hook 写进去，它们一跑就是 useState is not defined/);
});

// 庭院里说过的话本来就同步在这间房的聊天里——这是她能读到、能调设置的前提
test("庭院说过的话落在这间房自己的聊天记录里", () => {
  assert.match(app, /onTurn: turn => pChat\(key, p => \[\.\.\.p,/);
  assert.match(app, /kind: "garden"/);
});

// 她 2026-09-17：「不能创建的时候就能设置房间权限吗」
test("建房那一页就能调这扇门带进带出什么", () => {
  assert.match(comp, /这扇门带进带出什么/);
  assert.match(comp, /window\.ChatRooms\.doorLine\(draft\)/);
  assert.match(comp, /原来这几排开关只长在【已经建好的房】的编辑页里/);
  assert.match(rooms, /function doorLine\(room\)/);
  // ⚠️开关本身不另写一份，还是同一个 group()
  const block = comp.slice(comp.indexOf("这扇门带进带出什么"), comp.indexOf("onClick: enterNewRoom"));
  for (const key of ["cognition", "actions", "writeback"]) assert.match(block, new RegExp('group\\("' + key + '"'));
  assert.doesNotMatch(block, /Kit\.GROUPS/, "这儿不许自己再铺一遍开关");
});
