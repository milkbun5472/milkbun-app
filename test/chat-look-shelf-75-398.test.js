// 我存的美化（群友 2026-10-11）：存一套、别的聊天窗点名字换上；单聊群聊同一架
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "../js/components.js"), "utf8");
test("存进 x_chatLooks，换上走 onApply（跟导入同一条路）", () => {
  assert.match(src, /saveJSON\("x_chatLooks"/);
  assert.match(src, /const useOne = it => \{ onApply\(/);
  assert.match(src, /btn\("存成我的一套", saveHere\)/);
});
test("只有 ChatLookPack 一处，单聊群聊都用它", () => {
  assert.equal((src.match(/h\(ChatLookPack,/g) || []).length, 2);
  assert.equal((src.match(/function saveChatLookToShelf/g) || []).length, 1);
});
