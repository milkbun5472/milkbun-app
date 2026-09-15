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

// ── v68.68：解除之后他「失忆」——拉黑这件事哪一份上下文都没进过 ──────────
// 群里那位 2026-09-15：「把他解除拉黑之后，他就会失忆，好像拉黑发的那些内容
// 没有进去，还停留在拉黑之前的那个状态。拉黑相关的事情，也不会被比如说日记
// 或者查手机读到」。
// 两个病叠在一起：
//   ① 解除的那一下把整条记录 delete 了——「被拉黑过」在存档里一个字不剩；
//   ② blocks 那张表【从来没进过任何一份上下文】，只在「按回复键」和「求解除」
//      那两处临场拼一句场景话。所以日记读不到、查手机读不到、解完他也不知道。
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const rooms = fs.readFileSync(path.join(__dirname, "..", "js", "chat-rooms.js"), "utf8");

test("解除拉黑留一张墓碑，不许整条删掉", () => {
  assert.match(app, /else if \(cur\.iBlocked \|\| cur\.theyBlocked\) \{/);
  assert.match(app, /n\[charId\] = \{ endedTs: Date\.now\(\), sinceTs: Number\(cur\.blockedTs\) \|\| 0,/);
  // 墓碑里不许留旗子——留了等于没解除
  const i = app.indexOf("const setBlockFor = (charId, patch)");
  const seg = app.slice(i, app.indexOf("const blockLineFor", i));
  assert.ok(!/endedTs[\s\S]{0,200}iBlocked:/.test(seg), "墓碑里还留着旗子");
  // 一个月前那次不该还压在今天的上下文里
  assert.match(app, /const BLOCK_TOMB_KEEP_MS = 30 \* 86400000;/);
  assert.match(app, /else if \(cur\.endedTs && Date\.now\(\) - Number\(cur\.endedTs\) < BLOCK_TOMB_KEEP_MS\) n\[charId\] = cur;/);
});

test("这件事要真的进上下文：句子一份，走 buildBundle 一起给", () => {
  assert.match(app, /const blockLineFor = charId => \{/);
  assert.equal((app.match(/const blockLineFor = /g) || []).length, 1);
  assert.match(app, /blockLine: blockLineFor\(char\.id\),/, "ctxFor 没造这一栏");
  assert.match(engine, /if \(ctx\.blockLine && String\(ctx\.blockLine\)\.trim\(\)\) parts\.push\(String\(ctx\.blockLine\)\.trim\(\)\);/, "buildBundle 没发出去");
  // 隔离房那道白名单：没登记＝默认挡住，登记错方向至少是「少给了」
  assert.match(rooms, /"blockLine",\s*\/\/ 正被拉黑 \/ 刚解除拉黑/);
});

test("三种状态各说各的，刚解除那一段专治「失忆」", () => {
  const i = app.indexOf("const blockLineFor = charId =>");
  const seg = app.slice(i, app.indexOf("\n  };", i));
  assert.match(seg, /if \(b\.iBlocked\) return "【她把你拉黑了】"/);
  assert.match(seg, /if \(b\.theyBlocked\) return "【你把 Ta 拉黑了】"/);
  assert.match(seg, /【你们前不久刚解除拉黑】/);
  // 她说的「他单方面发了几百条」：那几条要数出来告诉他
  assert.match(seg, /那几天你一个人发了 " \+ unsent \+ " 条 Ta 收不到的消息/);
  assert.match(seg, /\*\*这件事真的发生过，别当没发生过、也别停在拉黑之前的状态\*\*/);
  // 但别变成每轮翻旧账（给出口不给判决）
  assert.match(seg, /也别一开口就翻旧账/);
});
