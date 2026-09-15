// 群里那位 2026-09-15：「把一个人拉黑，但他还可以一直给你发。私信然后发那个解除申请嘛，
// 然后那一段它是不会被生成记忆。还是能够生成比较好是不是？」——是。
//
// 病根：拉黑这条链【整条绕开了 _replyTurn】（blockedReaction / sendMyUnblockReq /
// respondUnblockFromChar 各自 callAI + pChat），而「每几轮抽一次记忆」那个节拍器
// 只挂在 _replyTurn 的末尾。于是他被拉黑之后碎碎念、求和、递解除申请、和好那几句
// ——整段关系里最见人的一截——一条都不会被抽进记忆库。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("拉黑期间那几句说完了，要叫一声抽取", () => {
  assert.match(app, /const queueUnblockSpeech = \(chatKey, says, delay, charId\) => \{/);
  assert.match(app, /setTimeout\(\(\) => \{ try \{ maybeAutoExtract\(charId\); \} catch \(e\) \{\} \}, delay \+ says\.length \* 650 \+ 1200\);/);
  // 三条路都从这一个口出去（她碎碎念那一轮、她答应和好、他答应解除）
  assert.equal((app.match(/queueUnblockSpeech\(chatKey, [^\n]*charId\);/g) || []).length, 3, "有一条路没带上 charId");
});

test("不另写一套抽取，也不在侧房乱叫", () => {
  // 节拍、防并发、书签全在 maybeAutoExtract 那一份里，这儿只负责叫它
  assert.equal((app.match(/const maybeAutoExtract = /g) || []).length, 1);
  assert.match(app, /if \(charId && String\(chatKey\) === String\(charId\)\) \{/, "侧房有自己的账，别拿主线那份去抽");
});

test("排在最后一条消息之后：求和申请那条也得先落地", () => {
  // blockedReaction 里那条「解除拉黑申请」挂在 250 + says.length*650 上，
  // 抽取得排在它后面，否则抽的时候它还没进聊天记录。
  const i = app.indexOf("const blockedReaction = async");
  const seg = app.slice(i, i + 1600);
  assert.match(seg, /setTimeout\(\(\) => pChat\(chatKey[\s\S]{0,400}?\), 250 \+ says\.length \* 650\);/);
  assert.match(app, /delay \+ says\.length \* 650 \+ 1200/, "抽取的延时必须比那条申请更晚");
});
