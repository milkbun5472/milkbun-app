// 她 2026-09-26 报的三件事，全在群线下这一条路上：
//   ①「群聊线下必须由我开场」——可界面上那句 placeholder 一直写着「留空则由他们起头」。
//   ②「旁观群我都不在怎么开口，就算开口也应该是跟线上一样的旁边指导」。
//   ③「我试了是我的消息会作为 user 发出去」。
// 病根是同一个：群线上早就认得旁观（用户以【旁白】推动剧情），群线下那头一层都没有
// ——站位也属于「四处一样喂」（施工规则/four-surfaces-same-context v55.91）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), engine = R("engine.js"), components = R("components.js");

// 公共的那一份单独拿出来跑：站位只有这一处，两边都问它
const groupStageLine = (() => {
  const a = engine.indexOf("const SPECTATE_PAIR_NOTE");
  const b = engine.indexOf("async function generateOfflineGroup(");
  assert.ok(a > 0 && b > a, "抠不出 groupStageLine");
  return new Function(engine.slice(a, b) + "; return groupStageLine;")();
})();

test("旁观群的线下场：说清她不在场，不再写「用户和上述角色身处同一个地方」", () => {
  const line = groupStageLine({ spectate: true, pairNames: [], userName: "小鹿", offline: true });
  assert.match(line, /用户不在场/);
  assert.match(line, /【旁白】/);
  assert.ok(!/用户和上述角色此刻身处同一个地方/.test(line), "旁观群她根本不在场，不许说她在");
});

test("两人旁观局的线下场：他俩自己的相处，她照样不在场", () => {
  const line = groupStageLine({ spectate: true, pairNames: ["甲", "乙"], userName: "小鹿", offline: true });
  assert.match(line, /「甲」和「乙」/);
  assert.match(line, /用户不在场/);
  assert.match(line, /别默认围着用户转/);
});

test("普通群线下照旧：她本来就在场（别修出一个新毛病）", () => {
  const line = groupStageLine({ spectate: false, pairNames: [], userName: "小鹿", offline: true });
  assert.match(line, /用户和上述角色此刻身处同一个地方/);
  assert.ok(!/用户不在场/.test(line));
});

test("群线上那三句（2026-10-31 旁观两句补上「用户不在」，有意改的）", () => {
  const PAIR = "【重要】这是他俩之间的相处——聊他们自己的生活、眼前的事、【彼此之间】的关系";
  const priv = groupStageLine({ spectate: true, pairNames: ["甲", "乙"], userName: "小鹿", offline: false });
  assert.ok(priv.startsWith("这是「甲」和「乙」之间【他俩自己】的私下对话（不是群聊）。用户不在这场对话里：只有他们两个，谁也看不见她，她也不会插话。她写下的句子是这一场的【旁白】，推动的是剧情本身，不是谁发的消息。让两人自然地你来我往、多轮对话。\n" + PAIR));
  assert.equal(groupStageLine({ spectate: true, pairNames: [], userName: "小鹿", offline: false }),
    "这是【成员】里这几个人的群聊。用户不在这个群里：群里只有这几个人，谁也看不见她，她也不会在群里回话。她写下的句子是这一场的【旁白】，推动的是剧情本身，不是谁发的消息。让成员们围绕旁白与彼此的关系自然互动。");
  assert.equal(groupStageLine({ spectate: false, pairNames: [], userName: "小鹿", offline: false }),
    "这是一个群聊，用户「小鹿」也是群里的一员，正在和大家一起说话。");
});

test("群线上、群线下都问这一份站位，不许各写各的", () => {
  assert.match(app, /let dir = groupStageLine\(\{ spectate:/, "群线上没搬过去");
  assert.match(engine, /groupStageLine\(\{ spectate: !!ctx\.spectate/, "群线下没问公共那一份");
});

test("旁观这件事真的递到了引擎手上", () => {
  const seg = app.slice(app.indexOf("const ctxForGroupOffline = group =>"), app.indexOf("const genGroupOfflineFrom = async"));
  assert.ok(seg.length > 0, "抠不出 ctxForGroupOffline");
  assert.match(seg, /spectate: _spectate/);
  assert.match(seg, /spectatePair: _pair/);
  assert.match(seg, /groupSpectating\(group\)/, "判据要走那一处公共的，别自己再认一遍房间身份");
});

test("旁观群里她敲的字落成旁白，不是 role:user", () => {
  assert.match(app, /const gOffUserRole = groupId => groupSpectating\(groups\.find\(g => g\.id === groupId\)\) \? "narration" : "user"/);
  const seg = app.slice(app.indexOf("const groupOfflineReply = async (groupId, extraText)"), app.indexOf("const groupOfflineEditMsg ="));
  assert.ok(seg.length > 0, "抠不出 groupOfflineReply");
  assert.match(seg, /role: gOffUserRole\(groupId\), content: extraText\.trim\(\)/);
  // 只发不演、发照片那两处也得跟上（三处各写各的迟早只改一处）
  assert.equal((app.match(/role: gOffUserRole\(groupId\)/g) || []).length, 3, "三处没接齐");
});

test("旁白那一行，引擎是按【场景设定】读的（桩照写入方写）", () => {
  const seg = engine.slice(engine.indexOf("function offlineGroupHistory(msgs, userName, clock"), engine.indexOf("function memberLabel(members, c)"));
  assert.ok(seg.length > 0, "抠不出 offlineGroupHistory");
  assert.match(seg, /m\.role === "narration" \? "【场景设定】"/);
});

// 她 2026-10-02 改了规矩：「进入线下后除了邀约不要主动调用，让我选择要不要开口或者让他们开口」。
//   空场仍然不拦（那道闸不回来），但也不再自己开演：铺好场就停，等她说、或点「让他们演绎」。
test("留空开场不拦，也不自己开演：只有邀约那一场一到就演", () => {
  assert.ok(!app.includes("先说点什么，或写一句开场"), "空场闸又回来了");
  assert.match(app, /pGOffline\(groupId, list => \[sess, \.\.\.list\.filter\(s => s\.endTs\)\]\);\n[^\n]*\n    if \(opts\.autoGen\) await genGroupOfflineFrom\(group, sess\);/);
  assert.match(app, /if \(opts\.autoGen\) await genOfflineFrom\(scopeKey, sess\);/);
  // 界面上那句承诺跟着改：留空＝进去后由她选谁先开口
  assert.match(components, /进去后你先说，或点「让他们演绎」让他们起头/);
  assert.match(components, /进去后你先说，或点「让 Ta 演绎」让 Ta 起头/);
});

test("空场的触发句不是「（继续）」——没有可继续的东西", () => {
  assert.match(engine, /const OFFLINE_OPEN_SCENE = "（这一场还没开始。由你们起头/);
  assert.equal((engine.match(/\(hist\.length \? "（继续）" : OFFLINE_OPEN_SCENE\)/g) || []).length, 2, "单人线下和群线下都要认空场");
});

// 线上旁观群也说清她不在群里（群友 2026-10-31：开着旁观，角色突然在群里问起她来）
require("node:test")("线上旁观群、旁观两人私聊都带「用户不在」那句", () => {
  const assert = require("node:assert/strict");
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
  assert.match(src, /: "这是【成员】里这几个人的群聊。" \+ SPECTATE_USER_NOT_IN_GROUP \+/);
  assert.match(src, /（不是群聊）。" \+ SPECTATE_USER_NOT_IN_GROUP\.replace\(/);
  assert.match(src, /const SPECTATE_USER_NOT_IN_GROUP = "用户不在这个群里：群里只有这几个人，谁也看不见她/);
});
