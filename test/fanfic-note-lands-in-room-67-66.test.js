// 她 2026-09-12 拍板的第一条：「同人文『只记一笔』也该落在它发生的那间房，
// 但要先补 房↔文 那根线」。
//
// 线原来只有【房→文】那一半：房里那几张卡带着 ficId，ChatRooms.ficMarks 认的就是它。
// 反过来问「这一篇发生在哪间房」没人答得上来，于是「只记一笔」只能一律往主记忆库写。
// ⚠️反向这一半**不另存一张表**：房里那几张卡本来就是真相，另存一份就是又一处要同步的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const fanfic = fs.readFileSync(path.join(root, "js/fanfic.js"), "utf8");

// 真跑 roomOfFic：桩照【真存档】给——房间对象是 ChatRooms 自己造的，
// 消息上那一格叫 ficId（写卡那一头 app.js 就是这么写的，见最后一条断言）
const K = require("../js/chat-rooms.js");
const mkRooms = () => {
  const store = {};
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const a = K.create("c1", "一起写", "focused");
  const b = K.create("c1", "另一间", "focused");
  const other = K.create("c2", "别人的房", "focused");
  return { a, b, other };
};

test("这一篇进过哪间房：认最近一次进的那间", () => {
  const { a, b } = mkRooms();
  const chats = {};
  chats[K.chatKey("c1", a.id)] = [{ ficId: "f1", ficTitle: "《甲》", ts: 100 }];
  chats[K.chatKey("c1", b.id)] = [{ ficId: "f1", ts: 300 }, { ficId: "f2", ts: 50 }];
  const hit = K.roomOfFic("c1", "f1", k => chats[k] || []);
  assert.equal(hit.roomId, b.id, "同一篇进过两间房，认的不是最近那间");
  assert.equal(hit.personId, "c1");
  assert.equal(hit.name, "另一间");
  // 另一篇认另一间
  assert.equal(K.roomOfFic("c1", "f2", k => chats[k] || []).roomId, b.id);
  // 没进过任何一间房的：答不上来就答不上来，不许瞎指一间
  assert.equal(K.roomOfFic("c1", "f9", k => chats[k] || []), null);
  assert.equal(K.roomOfFic("", "f1", k => chats[k] || []), null);
  assert.equal(K.roomOfFic("c1", "f1", null), null);
});

test("别人的房不算：这一篇在他那儿发生在哪间，跟另一个人无关", () => {
  const { a, other } = mkRooms();
  const chats = {};
  chats[K.chatKey("c1", a.id)] = [{ ficId: "f1", ts: 10 }];
  chats[K.chatKey("c2", other.id)] = [{ ficId: "f1", ts: 999 }];
  assert.equal(K.roomOfFic("c1", "f1", k => chats[k] || []).roomId, a.id);
  assert.equal(K.roomOfFic("c2", "f1", k => chats[k] || []).roomId, other.id);
});

test("主聊天不是一间侧房：文在主线里聊过不算「发生在某间房」", () => {
  const { a } = mkRooms();
  const chats = {};
  chats[K.chatKey("c1", K.MAIN_ID)] = [{ ficId: "f1", ts: 999 }];
  chats["c1"] = [{ ficId: "f1", ts: 999 }];
  assert.equal(K.roomOfFic("c1", "f1", k => chats[k] || []), null);
  chats[K.chatKey("c1", a.id)] = [{ ficId: "f1", ts: 1 }];
  assert.equal(K.roomOfFic("c1", "f1", k => chats[k] || []).roomId, a.id);
});

test("接线：只记一笔走 keepWhereItHappened，跟小游戏、一起读同一个落点", () => {
  assert.match(app, /onNoteChapter: \(charId, text, ficId\) => \{/);
  assert.match(app, /const hit = ficRoomOf\(charId, ficId\);/);
  assert.match(app, /roomId: hit \? hit\.roomId : "main", personId: charId,/);
  assert.match(app, /entry: \{ source: "fanfic" \}/);
  // 不许再直接往记忆库写（那就绕开了「房是封着的」那道闸）
  assert.ok(!/onNoteChapter[\s\S]{0,400}addMemEntry/.test(app), "只记一笔还在直接写记忆库");
  // 线只有一份：app 这头只负责把聊天记录递过去
  assert.match(app, /return K\.roomOfFic\(charId, ficId, key => chatsRef\.current\[key\] \|\| \[\]\);/);
  // 写卡那一头确实写的是 ficId（桩钉在写的那一半：施工规则/stub-from-the-writer.md）
  assert.match(app, /ficId: String\(\(meta && meta\.ficId\) \|\| ""\), ficTitle:/);
});

test("界面：按钮和回执都照实说这一笔落在哪儿", () => {
  assert.match(fanfic, /const noteRoom = \(props\.ficRoomOf && picked\) \? props\.ficRoomOf\(picked\.id, f\.id\) : null;/);
  assert.match(fanfic, /noteRoom \? "只记一笔（记在「" \+ noteRoom\.name \+ "」里）" : "只记一笔（进你的记忆库）"/);
  assert.ok(!fanfic.includes("只记一笔（不进房间）"), "按钮上还写着「不进房间」，可它现在正是进房间");
  assert.match(fanfic, /props\.onNoteChapter\(c\.id, window\.Fanfic\.chapterNote\(f, i, nm, mine, props\.userName\), f\.id\)/);
  assert.match(fanfic, /wh === "room" \? "记进了「" \+ \(rn\.roomName \|\| "那间房"\) \+ "」——只在那儿算数"/);
  assert.match(fanfic, /wh === "gone" \? "这一篇挂着的那间房已经不在了，没处记"/);
  assert.match(fanfic, /ficRoomOf: props\.ficRoomOf,/, "FilePage 压根没收到这根线");
});
