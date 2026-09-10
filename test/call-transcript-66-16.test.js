// 她 2026-09-09：「语音视频完之后应该是原纪录进上下文而不只是小结吧，
// 现在打完电话就不知道了，靠一个不靠谱的小结，说出来的话都是错的」。
//
// ⚠️转录一直都存着——endCall 那儿把整通存进 bubble.log（点开就能回看）。
//    问题是【没人把它喂回去】。而且这是同一个病的第三处：
//    recentChat 那一路 2026-09-06 已经把通话摊平进时间线了（她当时问
//    「有没有可能通话跟线上聊天没有区别呢」），主聊天回复这条路没跟上——
//    偏偏她天天走的就是这条。群聊那条同样落单。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.resolve(__dirname, "..", "js/app.js"), "utf8");

test("挂了电话之后，逐句原话真的喂回去了——单聊和群聊都要", () => {
  // 单聊：主聊天回复那条路
  const i = app.indexOf('        if (m.kind === "callend") {');
  assert.ok(i > 0, "单聊那一支没了");
  const seg = app.slice(i, i + 1200);
  assert.match(seg, /const _ct = callTranscriptForOnline\(m, false, char\.name\);/, "单聊没把转录取出来");
  assert.match(seg, /【这通电话里实际逐句说过的话·以原话为准，小结只是提要】/, "单聊只喂了小结");
  // 小结留着，但降级成提要——她说的就是「小结不靠谱」
  assert.match(seg, /"。小结：" \+ m\.sum/);
  assert.ok(!/"。内容：" \+ m\.sum/.test(app), "还在把小结当成「内容」，那句话本身就在误导");
  // 群聊那条
  assert.match(app, /callTranscriptForOnline\(m, true, ""\)/, "群聊那条没接");
  assert.equal((app.match(/以原话为准，小结只是提要/g) || []).length, 2, "单聊群聊两处都要");
});

test("act 是动作不是台词，得分得开；预算跟线下归档共用一道", () => {
  const i = app.indexOf("  const callTranscriptForOnline = ");
  assert.ok(i > 0, "取转录那一处没了");
  const fn = app.slice(i, app.indexOf("\n  useEffect", i));
  // 视频通话里那一下动作/神态：括号包住，别混进台词
  assert.match(fn, /x\.act \? "（" \+ String\(x\.content\)\.trim\(\) \+ "）" : "："/, "动作行跟台词混在一起了");
  assert.match(fn, /x\.role === "user" \? userName\(profile\)/);
  assert.match(fn, /groupMode \? \(x\.senderName \|\| "某人"\)/, "群里认不出是谁说的");
  // ⚠️预算只许有一道：线下归档和通话回执是同一个形状
  assert.match(app, /const TRANSCRIPT_CAP = 6000;/);
  assert.equal((app.match(/const transcriptTail = /g) || []).length, 1);
  assert.match(app, /callTranscriptForOnline = \(m, groupMode, charName\) => transcriptTail\(/);
  assert.match(app, /offlineTranscriptForOnline = \(msgs, groupMode, charName\) => transcriptTail\(/);
  assert.ok(!/if \(picked\.length && used \+ n > 6000\)/.test(app), "还有一处自己写了一遍预算");
});

test("没存下转录的老通话不许崩，也不许假装有原话", () => {
  const i = app.indexOf("  const callTranscriptForOnline = ");
  const fn = app.slice(i, app.indexOf("\n  useEffect", i));
  assert.match(fn, /Array\.isArray\(m && m\.log\) \? m\.log : \[\]/, "老回执没有 log，会炸");
  // 空转录时那一整句都不该出现（不然他会去找一段不存在的原话）
  assert.match(app, /\(_ct \? "\\n【这通电话里实际逐句说过的话/, "空的时候还是把那句标题发出去了");
});
