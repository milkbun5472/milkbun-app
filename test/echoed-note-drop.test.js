const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("抄来的历史旁注整段拿掉；正常带【】的话不动", () => {
  const src = app.slice(app.indexOf("const ECHO_NOTE_HINT"), app.indexOf("  // 按角色选 API 线路"));
  const f = new Function(src + ";return dropEchoedNotes;")();
  assert.deepStrictEqual(f(["【用户刚才要求你发一张自拍；这里你已经实际拍下并发出去了", "这已经是真实发生过的事", "不能说没发成的话】", "照片内容：宿舍镜前", "合格吗"]), ["合格吗"]);
  assert.deepStrictEqual(f(["【开心】", "你好"]), ["【开心】", "你好"]);
  assert.ok(app.includes("words = dropEchoedNotes(words);"));
});
test("她开口要照片的说法放宽：拍腹肌、看看都算，拍一拍不算", () => {
  const re = new Function("return " + app.match(/const PHOTO_REQUEST_RE = (\/[^\n]+\/i);/)[1])();
  assert.ok(re.test("拍腹肌给我") && re.test("看看腹肌") && !re.test("拍一拍你"));
});
