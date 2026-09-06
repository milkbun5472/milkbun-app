"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const bag = new Map();
global.localStorage = {
  getItem: k => bag.has(k) ? bag.get(k) : null,
  setItem: (k, v) => bag.set(k, String(v)),
  removeItem: k => bag.delete(k)
};
const Rooms = require("../js/chat-rooms.js");
const app = fs.readFileSync("js/app.js", "utf8");
const study = fs.readFileSync("js/study.js", "utf8");
const games = fs.readFileSync("js/games.js", "utf8");
const components = fs.readFileSync("js/components.js", "utf8");

test.beforeEach(() => bag.clear());

// 桩照着【写存档的那段】写：study.js 建课/建节时戳的就是 roomId
// （stub-from-the-writer：照着要测的那段读取代码编桩，等于把同一个误会写两遍）
test("一起学的课记着是在哪间房开的，桩字段对得上写入方", () => {
  assert.match(study, /roomId: String\(props\.initialRoomId \|\| ""\) \|\| null/);
  assert.match(study, /roomId: cur\.roomId \|\| null/);
  assert.match(study, /roomId: \(props\.entry && props\.entry\.roomId\) \|\| null/);
  // 邀请卡进去时把房间戳一路带过去
  assert.match(app, /roomId: m\.roomId \|\| activeRoomId \|\| "main"/);
  assert.match(study, /initialRoomId: props\.entry && props\.entry\.mode === "propose"/);
});

test("侧房的课只有那间房看得见，主线的课不串进侧房", () => {
  const p = "pS";
  const side = Rooms.create(p, "十七岁", "alternate");
  global.window = { Study: { loadSessions: () => [
    { id: "s_main", character_ids: [p], subject: "主线那门课", updated_at: 3 },
    { id: "s_side", character_ids: [p], subject: "侧房那门课", roomId: side.id, updated_at: 2 }
  ] } };
  const inMain = Rooms.studySessionsFor(p, "main").map(s => s.id);
  const inSide = Rooms.studySessionsFor(p, side.id).map(s => s.id);
  assert.deepEqual(inMain, ["s_main"]);   // 没戳 roomId 的老课＝主线
  assert.deepEqual(inSide, ["s_side"]);
  delete global.window;
});

test("隔离房里上的课不算数，开了写回口子的才算", () => {
  const p = "pC";
  const shut = Rooms.create(p, "不带出门", "isolated");
  const open = Rooms.save(p, { ...Rooms.create(p, "一起修记忆", "focused"), writeback: { memoryCandidate: true } });

  assert.equal(Rooms.studyCounts(p, { subject: "x" }), true);                       // 主线
  assert.equal(Rooms.studyCounts(p, { subject: "x", roomId: shut.id }), false);
  assert.equal(Rooms.studyCounts(p, { subject: "x", roomId: open.id }), true);
  assert.equal(Rooms.studyCounts(p, { subject: "x", roomId: "room_已删掉" }), false); // 房没了宁可少说

  // 发呆的「你俩一起做过的事」认这一句，别在那边再判一遍
  assert.match(app, /window\.ChatRooms\.studyCounts\(char\.id, x\)/);
});

test("小游戏那个开关不再是空的：同一张卡、同一条路", () => {
  // 报菜名不在聊天那边再抄一份清单
  assert.match(games, /Games\.LIST = GAMES\.map/);
  assert.match(app, /openCaps\.push\("gameInvite"\)/);
  assert.match(app, /kind: "gameinvite", gameKey: def\.key/);
  // 他不许声称已经开局
  assert.match(app, /不能声称已经开局或界面已经打开/);
  // 卡是长在 studyinvite 那一张上的，不是新画一张
  assert.match(components, /if \(m\.kind === "studyinvite" \|\| m\.kind === "gameinvite"\)/);
  // 游戏架接 entry，落到那一局的配置页并先勾上他（照 study.js 的形状）
  assert.match(games, /entryHandledRef\.current = entry\.key/);
  assert.match(games, /initialPicked/);
  assert.match(app, /onOpenGameInvite: m =>/);
  // 主聊天不许出这张卡：房间的开关才是闸
  assert.match(app, /const roomGamesOn = !!\(room && !room\.main && room\.actions && room\.actions\.games/);
});

// 真正要挡的那件事：隔离房里上的课，不许从主线的他嘴里说出来。
// togetherLines 是发呆读的「你俩一起做过的事」，从 app.js 里原样抠出来跑。
test("发呆不会端上隔离房里上的那门课", () => {
  const i = app.indexOf("  const togetherLines = char => {");
  const j = app.indexOf("  const ambientMaterialFor");
  assert.ok(i > 0 && j > i, "抠不出 togetherLines");
  const now = Date.now();
  const p = "c1";
  const shut = Rooms.create(p, "不带出门", "isolated");
  const store = { x_study_sessions: [
    { character_ids: [p], subject: "隔离房里学的", created_at: now, updated_at: now, roomId: shut.id },
    { character_ids: [p], subject: "主线上学的", created_at: now - 86400000, updated_at: now - 86400000 }
  ] };
  global.window = { ChatRooms: Rooms };
  const togetherLines = new Function("loadJSON", app.slice(i, j) + "\nreturn togetherLines;")(
    (k, d) => (k in store ? store[k] : d));
  const out = togetherLines({ id: p, name: "沈屿白" });
  assert.ok(!out.includes("隔离房里学的"), "隔离房的课漏进主线了");
  assert.match(out, /主线上学的/);
  delete global.window;
});
