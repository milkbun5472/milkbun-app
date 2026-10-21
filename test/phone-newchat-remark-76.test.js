// 关系网里新来的人开私聊时，也带着TA给对方的备注进通讯录（她 2026-10-21）
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/phone.js");
test("newChats 带 remark 进 contacts，已有的不重复", () => {
  const old = { chats: [], contacts: [{ name: "甲", remark: "老甲", intro: "" }] };
  const out = P.phoneGrowMerge("wechat", old, { updates: [], newChats: [
    { name: "乙", remark: "小乙", intro: "发小", messages: [{ from: "乙", text: "在吗" }] },
    { name: "甲", remark: "x", messages: [{ from: "甲", text: "嗯" }] }] }, Date.now());
  assert.deepEqual(out.contacts.map(c => c.name + "/" + c.remark), ["甲/老甲", "乙/小乙"]);
});
