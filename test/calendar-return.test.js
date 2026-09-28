// 她 2026-09-29 转群里读者：「线下看了日历的行程直接一退就退回到主页了吗？是不能直接退回到线下页面吗？」
// 线上、线下点进日历都记下来处；日历的返回和侧滑返回都回到来处，没有来处才回主屏。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const grab = (a, b) => { const i = app.indexOf(a), j = app.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return app.slice(i, j); };

function run(ret) {
  const src = grab("  const leaveCalendar = () => {", "  const goHome = () => {");
  const log = [];
  const ref = { current: ret };
  const leave = new Function("calReturnRef", "setSelSched", "goHome", "setScreen", "openOffline", "window",
    src + "\nreturn leaveCalendar;")(ref, () => log.push("sel"), () => log.push("home"), v => log.push("screen:" + v),
    (c, room) => log.push("offline:" + c.id + ":" + (room ? room.id : "main")),
    { ChatRooms: { get: (cid, rid) => ({ id: rid }) } });
  leave();
  return { log, ref };
}
test("从线下进的日历：退出回到线下那一场（连房间一起）", () => {
  const r = run({ screen: "thread", offlineChar: { id: "c1" }, roomId: "r9" });
  assert.deepEqual(r.log, ["sel", "screen:thread", "offline:c1:r9"]);
  assert.equal(r.ref.current, null, "来处用过就清掉");
});
test("从线上聊天进的日历：退出回聊天", () => {
  assert.deepEqual(run({ screen: "thread" }).log, ["sel", "screen:thread"]);
});
test("从主屏进的日历：没有来处，照旧回主屏", () => {
  assert.deepEqual(run(null).log, ["sel", "home"]);
});
test("两个入口都记了来处；日历的返回键和侧滑返回都走 leaveCalendar", () => {
  assert.match(app, /calReturnRef\.current = \{ screen: screen \}; setSelSched\(activeChar\.id\); setScreen\("calendar"\);/);
  assert.match(app, /calReturnRef\.current = \{ screen: screen, offlineChar: offlineChar, roomId: offlineRoomId \};/);
  assert.match(grab('  });else if (screen === "calendar") body = h(Calendar, {', "onSaveEvent"), /onBack: leaveCalendar,/);
  assert.match(app, /if \(screen === "calendar" && calReturnRef\.current\) \{ leaveCalendar\(\); return true; \}/);
});
