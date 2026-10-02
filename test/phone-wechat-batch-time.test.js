const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/phone.js", "utf8");
test("查手机微信：每回刷新新说的话打上批次时间，会话里按批画时间线", () => {
  const fn = src.slice(src.indexOf("function phoneApplyChatUpdates"), src.indexOf("function phoneMergeShelves"));
  const run = new Function("phoneWhenTs", fn + "; return phoneApplyChatUpdates;")(() => 1);
  const old = { chats: [{ name: "阿明", time: "昨天", messages: [{ from: "阿明", text: "在吗" }] }] };
  const r = run(old, [{ name: "阿明", time: "21:10", messages: [{ from: "阿明", text: "睡了没" }] }], 999);
  const ms = r.chats[0].messages;
  assert.strictEqual(ms[0]._at, undefined);
  assert.strictEqual(ms[1]._at, 999);
  assert.strictEqual(ms[1]._atLabel, "21:10");
  assert.ok(src.includes("return batchLine ? h(React.Fragment, { key: i }, batchLine, row) : row;"));
});
