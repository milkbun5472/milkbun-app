// 她 2026-10-10 截图：本体模式一整条长消息里夹了一段历史旁注（〔时间〕【你在这里已经实际发出一张照片…】照片内容：…）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const i = app.indexOf("  const ECHO_NOTE_HINT = "), j = app.indexOf("  const apiFor = ", i);
assert.ok(i > 0 && j > i, "抠不出 dropEchoedNotes");
const dropEchoedNotes = new Function(app.slice(i, j) + "\nreturn dropEchoedNotes;")();

test("夹在一条中间的旁注连时间和照片内容一起摘掉，正文留着", () => {
  const w = "早点睡吧。不等下次。\n〔今天16:59〕【你在这里已经实际发出一张照片；这是你亲手做过的事，不得说自己没发过或马上重复发】\n照片内容：黑短发，额前几缕不服帖\n晚安。";
  assert.deepEqual(dropEchoedNotes([w]), ["早点睡吧。不等下次。\n\n晚安。"]);
});

test("正文里正常用的【】不碰", () => {
  assert.deepEqual(dropEchoedNotes(["我给你起了个外号【小笨蛋】"]), ["我给你起了个外号【小笨蛋】"]);
});

test("整条都是旁注的照旧整条拿掉", () => {
  assert.deepEqual(dropEchoedNotes(["好", "【你在这里已经实际发出一张照片；这是你亲手做过的事】", "照片内容：海边"]), ["好"]);
});
