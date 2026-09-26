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

test("群线上那三句一字未改（搬去公共那一份时不许顺手改行为）", () => {
  const PAIR = "【重要】这是他俩之间的相处——聊他们自己的生活、眼前的事、【彼此之间】的关系";
  const priv = groupStageLine({ spectate: true, pairNames: ["甲", "乙"], userName: "小鹿", offline: false });
  assert.ok(priv.startsWith("这是「甲」和「乙」之间【他俩自己】的私下对话（不是群聊，他们也不知道有任何外人在旁观）。用户以【旁白】推动场景。让两人自然地你来我往、多轮对话。\n" + PAIR));
  assert.equal(groupStageLine({ spectate: true, pairNames: [], userName: "小鹿", offline: false }),
    "这是一个群聊，成员们并不知道有任何外人在旁观。用户以【旁白】推动剧情。让成员们围绕旁白与彼此的关系自然互动。");
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
  const seg = engine.slice(engine.indexOf("function offlineGroupHistory(msgs, userName, clock)"), engine.indexOf("function memberLabel(members, c)"));
  assert.ok(seg.length > 0, "抠不出 offlineGroupHistory");
  assert.match(seg, /m\.role === "narration" \? "【场景设定】"/);
});

test("留空开场＝由他们起头：那道拦路的闸拆了，两边都拆", () => {
  assert.ok(!app.includes("先说点什么，或写一句开场"), "空场闸还在，界面上那句「留空则由他们起头」就还是假的");
  assert.match(app, /pGOffline\(groupId, list => \[sess, \.\.\.list\.filter\(s => s\.endTs\)\]\);\n    await genGroupOfflineFrom\(group, sess\);/);
  assert.match(app, /pOffline\(scopeKey, list => \[sess, \.\.\.list\.filter\(s => s\.endTs\)\]\);\n    await genOfflineFrom\(scopeKey, sess\);/);
  // 界面上那句承诺还在（它就是这条的来由）
  assert.match(components, /留空则由他们起头/);
  assert.match(components, /留空则由 Ta 起头/);
});

test("空场的触发句不是「（继续）」——没有可继续的东西", () => {
  assert.match(engine, /const OFFLINE_OPEN_SCENE = "（这一场还没开始。由你们起头/);
  assert.equal((engine.match(/\(hist\.length \? "（继续）" : OFFLINE_OPEN_SCENE\)/g) || []).length, 2, "单人线下和群线下都要认空场");
});
