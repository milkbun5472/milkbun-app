const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const src = eng.slice(eng.indexOf("function earlierRecallIdx"), eng.indexOf("function emoteSlotOf"));
const earlierRecallIdx = new Function(src + "; return earlierRecallIdx;")();
const mine = m => m.role === "assistant";
test("他能撤前面几轮自己发过的那条（她 2026-10-26）", () => {
  const list = [{ role: "assistant", content: "黄色小狗叉腰冒星星" }, { role: "user", content: "表情包后面的文字不要说出来哟" }, { role: "assistant", content: "啊刚才手滑了" }];
  assert.equal(earlierRecallIdx(list, mine, "黄色小狗叉腰冒星星"), 0);
  assert.equal(earlierRecallIdx(list, mine, "表情包后面的文字不要说出来哟"), -1);   // 她的话撤不了
  assert.equal(earlierRecallIdx(list, mine, "这一轮新写的话"), -1);               // 对不上就照旧先发再撤
  assert.equal(earlierRecallIdx([{ role: "assistant", content: "好", kind: "recalled" }], mine, "好"), -1);
});
test("单聊、群聊都接上，提示词写明能撤前面的", () => {
  assert.match(app, /earlierRecallIdx\(chatsRef\.current\[chatKey\] \|\| \[\], m => m\.role === "assistant", recall\.text\)/);
  assert.match(app, /earlierRecallIdx\(groupChatsRef\.current\[groupId\] \|\| \[\], m => m\.role === "assistant" && m\.senderId === spk\.id, item\.text\)/);
  assert.match(app, /抄的是你前面几轮已经发出去的某一条/);
  assert.match(app, /前面几轮已经发出去的那条也能撤/);
});
