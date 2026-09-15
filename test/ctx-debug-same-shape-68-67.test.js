// 她 2026-09-15 圈出「TA 知道什么」里的【最近对话】：「这个是几百条之前的，感觉最近对话没进来」。
//
// 不是没进来，是那一页【自己另搭了一份】：
//   发送那条路会按房间和线路方言决定「历史另发一份 messages、这一块就不重复」，
//   而诊断页那条路压根不知道有这回事——它用 ctxFor(char) 现搭，永远是主聊天。
//   于是她在侧房里点开，看到的是主聊天几百条之前的尾巴。
// 又是一层写在两处、第二处没跟上。这份钉的是「只剩一处」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const live = app.split("\n").map(l => l.split("//")[0]).join("\n");
const grab = re => { const m = app.match(re); assert.ok(m, "找不到：" + re); return m[0]; };

test("「这一轮怎么发历史」只有一份答案", () => {
  const fn = grab(/  const chatSendShapeFor = \(charId, sideRoom\) => \{[\s\S]*?\n  \};/);
  const make = new Function("apiFor", "detectFormat", "settingsFor", fn + "return chatSendShapeFor;");
  const openai = { id: "r1", baseUrl: "https://x.invalid" };
  const shape = make(() => openai, () => "openai", () => ({}));
  // openai 方言：历史另发一份 messages，所以这一块把线上压成位置标记、线下留着
  assert.deepEqual(shape("c1", false), { singleHistoryLayout: false, thinOnline: true, blankRecent: false });
  // 侧房：本房原文就在 messages 里，这一块整个不发
  assert.deepEqual(shape("c1", true), { singleHistoryLayout: false, thinOnline: true, blankRecent: true });
  // anthropic 线：整段历史缓存，这一块也整个不发
  const anth = make(() => openai, () => "anthropic", () => ({}));
  assert.deepEqual(anth("c1", false), { singleHistoryLayout: true, thinOnline: false, blankRecent: true });
  // 数字生命那条专线同理
  const eng = make(() => openai, () => "openai", () => ({ engineerEyes: true }));
  assert.equal(eng("c1", false).singleHistoryLayout, true);
});

test("发送那条路读的就是它，不许自己再算一遍", () => {
  assert.match(app, /const _shape = chatSendShapeFor\(charId, sideRoom\);/);
  assert.match(app, /const _singleHistoryLayout = _shape\.singleHistoryLayout;/);
  assert.match(app, /roomContextFor\(char, chatKey, room, \{ chat: true, thinOnline: _shape\.thinOnline \}\)/);
  assert.match(app, /buildBundle\(_shape\.blankRecent \? \{ \.\.\._gated, recentChat: "" \} : _gated\)/);
  // 原来那两行各算各的，删干净了才算「只剩一处」
  assert.ok(live.indexOf('const _histCache = (typeof detectFormat') < 0, "发送那条路又自己算了一遍方言");
  assert.ok(live.indexOf('if (sideRoom) _gated.recentChat = "";') < 0, "侧房那一刀又单独写了一处");
});

test("诊断页照发送那条路搭：同一间房、同一个历史形状", () => {
  const fn = grab(/  const inspectBundleFor = cid => \{[\s\S]*?\n  \};/);
  assert.ok(fn.indexOf("buildBundle(ctxFor(c, { debug: true }))") < 0,
    "又变回不认房间的那一版了——她在侧房点开会看到主聊天几百条之前的尾巴");
  assert.match(fn, /const key = rooms \? rooms\.chatKey\(cid, activeRoomId\) : cid;/, "不带上当前房间就是在查另一个聊天");
  assert.match(fn, /const room = rooms \? rooms\.get\(cid, activeRoomId\) : null;/);
  assert.match(fn, /chatSendShapeFor\(cid, !!\(room && !room\.main\)\)/);
  assert.match(fn, /roomContextFor\(c, key, room, \{ debug: true, chat: true, thinOnline: shape\.thinOnline \}\)/);
});

test("这一块真的没发时，要说清它去哪儿了——留空她会以为是坏了", () => {
  const fn = grab(/  const inspectBundleFor = cid => \{[\s\S]*?\n  \};/);
  assert.match(fn, /if \(shape\.blankRecent\) gated\.recentChat = "（这一轮没有这一块：聊天记录是作为单独的消息记录发出去的，没有在这儿重复第二份。）";/,
    "这一页答的是「发了什么」，「这一块为什么不在」也是答案的一部分");
});
