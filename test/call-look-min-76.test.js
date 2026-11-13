const test = require("node:test"); const assert = require("node:assert");
const A = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
test("通话缩小时聊天窗的长相照眼前这一页的人，不照通话那个人", () => {
  const i = A.indexOf("const paintChatLook"); const seg = A.slice(i, i + 1500);
  assert.match(seg, /const callOne = call && !call\.min && !call\.groupId/);
  assert.match(A, /call && call\.groupId, call && !!call\.min\]\);/);
});
