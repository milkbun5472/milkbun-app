const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const st = fs.readFileSync(path.join(__dirname, "..", "js", "study.js"), "utf8");
// 群里 2026-10-17：「能不能加一个 char 提醒我学习」——一起学里的该复习了，老师来聊天里催
test("一起学·到点让老师催复习：她打开才催、一门课一天一次、走主动消息那条", () => {
  assert.match(st, /remindReview: !on/);
  assert.match(app, /cu\.remindReview !== true \|\| slog\[cu\.id\] === dayKey/);
  assert.match(app, /\.\.\.\(inRoom \? \{ chatKey: K\.chatKey\(cand\.id, rid\), room: rm \} : \{\}\)/, "房间里开的课要催在那间房里");
  assert.match(app, /remind: \{ title: "复习「" \+ \(cu\.subject \|\| cu\.title \|\| "这门课"\) \+ "」", note: n \+ " 道到点该复习了", src: "study" \}/);
  assert.match(app, /opts\.remind\.src === "study"/);
});

// 她 2026-10-17：「不进房间也没有提醒吧」——侧房里TA开口、她不在那间房：弹顶上那条、亮红点，点了进那间房
test("侧房来消息也提醒，点了进那间房", () => {
  assert.match(app, /if \(!inThatRoom\) setTimeout\(\(\) => bumpUnread\(personId, added, rid\), 0\);/);
  assert.match(app, /if \(roomId && roomId !== "main"\) enterRoom\(c, roomId\); else setActiveChar\(c\);/);
  assert.match(app, /roomId: activeRoomId \};/);
});
