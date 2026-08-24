const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const gq = fs.readFileSync(path.join(root, "js/group-quote.js"), "utf8");

// 她 2026-08-24 一次报了三个：
// ① 封闭群触发了朋友圈
// ② 设定串：拉了王爷+顾朝+顾暮，「大房二房」是她和王爷的梗，顾朝第一轮就主动提，
//    而王爷还没说话
// ③ 引用不要显示「引用 XXX：」，直接摆原话就行

test("入群前私聊要有隐私围栏——顾朝就是从这儿读到王爷的梗的", () => {
  const i = app.indexOf("let preJoin = \"\";");
  const block = app.slice(i, i + 2200);
  // 每一段要标明只属于谁（跟 interop 那份同款）
  assert.match(block, /〔以下只有 " \+ c\.name \+ " 本人知道，别的成员并不知情〕/);
  assert.match(block, /⚠️隐私边界铁律/);
  assert.match(block, /绝不许提及、暗示、化用或质问另一个成员和用户之间私聊过什么、有过什么梗/);
  // 专属梗这条要单独点名——她的例子正是「大房二房」这种梗被别人拿去开场
  assert.match(block, /别人段落里的称呼、玩笑、专属梗、约定、旧事，对你来说【根本不存在】/);
  assert.match(block, /不许拿来开场、接话或试探/);
  // 旧的裸注入不许留着
  assert.ok(block.indexOf('"\\n\\n【成员入群前和用户的私聊（作为背景，别生硬复述）】\\n" + pj') < 0);
  assert.match(app, /于是顾朝能逐字读到裴照川的私聊/, "病因写在代码里");
});

test("封闭群不喂动态计数器——攒够 30 轮会强制发朋友圈", () => {
  assert.match(app, /if \(!groupClosed\(groupId\)\) _gspoke\.forEach\(id => tickAmbient\(id, \{\}\)\);/);
  assert.match(app, /等于把闭群里的事发到朋友圈上/, "病因写在代码里");
  // 单聊和线下照常计数，别误伤
  assert.match(app, /tickAmbient\(charId, \{\}\); \/\/ 线下也计动态保底/);
  assert.match(app, /if \(!opts\.proactive\) tickAmbient\(charId, \{ moment: !!mo/);
});

test("封闭群的内容也不许当朋友圈素材——光不计数还不够", () => {
  const i = app.indexOf("const ambientMaterialFor = (char, opts) =>");
  const fn = app.slice(i, i + 1200);
  assert.match(fn, /const openGroups = \(groups \|\| \[\]\)\.filter\(g => !groupClosed\(g\.id\)\);/);
  assert.match(fn, /groups: openGroups, groupChats: openChats, groupOfflines: go/);
  assert.ok(fn.indexOf("groups, groupChats: groupChatsRef.current") < 0, "旧的全量传入不许留着");
  assert.match(app, /拿它当素材发到朋友圈上就等于把里面的事捅出去了/);
});

test("引用只显示原话，不显示「引用 XXX：」", () => {
  const live = f => f.split("\n").filter(l => !/^\s*\/\//.test(l) && l.indexOf('"引用 " +') >= 0);
  assert.deepEqual(live(comp), [], "群气泡");
  assert.deepEqual(live(gq), [], "共用 label");
  assert.match(comp, /\}, "❝ " \+ m\.replyTo\), m\.recalled/);
  assert.match(gq, /return "❝ " \+ clean\(value\.text \|\| value\.replyTo\);/);
});

test("是谁说的仍然带着，也仍然喂给模型——只是界面不报", () => {
  // 数据层照旧记录作者
  assert.match(comp, /replyToSenderId: q\.senderId \|\| null, replyToSenderName: q\.senderName \|\| null/);
  // 提示词里照旧写明引用了谁，否则角色会接错话
  assert.match(app, /【这条正在引用 " \+ \(m\.replyToSenderName \|\| "作者未知"\)/);
  assert.match(app, /【引用 " \+ \(m\.replyToSenderName \|\| "作者未知"\)/);
  assert.match(gq, /是谁说的代码里一直有/);
});
