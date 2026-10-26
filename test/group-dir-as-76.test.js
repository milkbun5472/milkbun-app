const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const cmp = fs.readFileSync("js/components.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8");
test("单聊群聊共用 NarrBar", () => {
  assert.match(cmp, /function NarrBar\(/);
  assert.equal((cmp.match(/h\(NarrBar, \{/g) || []).length, 2);
  assert.doesNotMatch(cmp, /chatMode === "narr" && onAddDirNote \? h\("div", \{ "data-wk": "narrbar"/);
});
test("替谁说：落成那个成员的一条", () => {
  assert.match(cmp, /onSendRich\(\{ role: "assistant", senderId: who\.id, senderName: who\.name, content: v, byHer: true/);
  assert.match(cmp, /const gNarrKinds = gs\.spectate \? \[\["event", "旁白"\], \["as", "替谁说"\]/);
  assert.match(cmp, /const gNarrBar = !!onAddDirNote && chatMode === "narr";/);
});
test("群导演便签：进提示词、成功才扣轮", () => {
  assert.match(app, /const _gDirLive = chatDirNotesLive\("g:" \+ groupId\)/);
  assert.match(app, /_gShoot\(userContent \+ _gDirHint \+ _gDoTail\)/);
  assert.match(app, /directorNotesConsume\(\(chatDirNotesRef\.current \|\| \{\}\)\["g:" \+ groupId\]/);
  assert.match(app, /onAddDirNote: \(text, long\) => chatDirNoteAdd\("g:" \+ activeGroup\.id/);
});
