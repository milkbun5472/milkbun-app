// 她 2026-09-12：「那不能把收入小游戏记忆从主记忆库变成房间里面 instead 吗宝宝」。
//
// 这一句解开了前一版那个死结：原来只有两种答案——要么让侧房里那一局照样写进
// 主记忆库（「不带出门」就成了空话），要么给她那一下加闸（那就成了「你按了也不算数」）。
// 第三条路是**换个落点**：进那间房自己的 selfDigest——ChatRooms.prompt 只把它喂回这间房。
//
// ⚠️查这件事的时候翻出来一个从 v63.38 起就在的哑弹：
//   games.js 那七颗「把这一局收进记忆」在、app.js 那扇门也在，
//   **中间 engineProps 那一截从来没接过**——每一局点下去都是空按，
//   而且还会弹一句「没有能收的：这局上场的都是 NPC」，点一次骗一次。
//   那份测试当年两头各钉了一遍，就是没有一条问过「它到底通不通」（见下面最后一条）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const games = fs.readFileSync(path.join(root, "js/games.js"), "utf8");
const read = fs.readFileSync(path.join(root, "js/read.js"), "utf8");

// 真跑：把那一份抠出来，桩照【真存档】给（房间对象就是 ChatRooms 造出来的那个）
const mk = rooms => {
  const mem = [], saved = [];
  const i = app.indexOf("  const keepWhereItHappened = (opts) => {");
  const j = app.indexOf("  // ---- summary check ----");
  assert.ok(i > 0 && j > i, "抠不出 keepWhereItHappened");
  const fn = new Function("addMemEntry", "window", app.slice(i, j) + "\nreturn keepWhereItHappened;")(
    e => mem.push(e),
    { ChatRooms: {
        get: (pid, rid) => (rooms[pid + "/" + rid] || null),
        save: (pid, room) => saved.push({ pid, room }),
        digestMerge: (prev, seg) => (String(prev || "").trim() ? prev + "\n\n" + seg : seg)
      } });
  return { fn, mem, saved };
};
const ROOM = { id: "r1", personId: "c1", name: "读书角", main: false, selfDigest: "以前发生过的" };

test("主线照旧进记忆库，形状一个字没变", () => {
  const m = mk({});
  assert.equal(m.fn({ text: "一起玩了谁是卧底", charIds: ["c1", "c2"], entry: { tags: ["小游戏"], source: "manual" } }), "mem");
  assert.deepEqual(m.mem, [{ text: "一起玩了谁是卧底", charIds: ["c1", "c2"], knownBy: ["c1", "c2"], tags: ["小游戏"], source: "manual" }]);
  assert.deepEqual(m.saved, []);
  // 没戳房间的老存档＝主线，照旧放行
  const m2 = mk({});
  assert.equal(m2.fn({ text: "x", charIds: ["c1"], roomId: null }), "mem");
  assert.equal(m2.fn({ text: "x", charIds: ["c1"], roomId: "main" }), "mem");
  assert.equal(m2.mem.length, 2);
});

test("侧房里那一下落进这间房自己的往事，记忆库一个字都不写", () => {
  const m = mk({ "c1/r1": ROOM });
  assert.equal(m.fn({ text: "一起玩了谁是卧底", charIds: ["c1"], roomId: "r1", entry: { tags: ["小游戏"] } }), "room");
  assert.deepEqual(m.mem, [], "落进房里之后又往记忆库写了一遍——那这道闸等于没有");
  assert.equal(m.saved.length, 1);
  assert.equal(m.saved[0].pid, "c1");
  assert.equal(m.saved[0].room.selfDigest, "以前发生过的\n\n一起玩了谁是卧底", "没接在旧的后面（或者把旧的盖了）");
  assert.equal(m.saved[0].room.name, "读书角", "把这间房别的栏顺手改了");
});

test("这一局别的参与者也拿不到——房是封着的，从谁嘴里漏出去都一样", () => {
  const m = mk({ "c1/r1": ROOM });
  // personId 是房主；charIds 里还有别人
  assert.equal(m.fn({ text: "三个人玩了一局", charIds: ["c1", "c2", "c3"], room: { roomId: "r1", personId: "c1" } }), "room");
  assert.deepEqual(m.mem, [], "别的参与者那儿写了主线记忆＝这间房的事漏出去了");
  assert.equal(m.saved.length, 1);
});

test("戳着的那间房已经删了：哪儿都不写，宁可少说", () => {
  const m = mk({});
  assert.equal(m.fn({ text: "x", charIds: ["c1"], roomId: "r_没了" }), "gone");
  assert.deepEqual(m.mem, [], "退回记忆库＝把一间封着的房里的事送进主线");
  assert.deepEqual(m.saved, []);
});

test("空的不写", () => {
  const m = mk({ "c1/r1": ROOM });
  assert.equal(m.fn({ text: "   ", charIds: ["c1"], roomId: "r1" }), null);
  assert.equal(m.fn({ text: "有字", charIds: [], roomId: "r1" }), null);
  assert.deepEqual(m.mem, []); assert.deepEqual(m.saved, []);
});

test("两处都走这一份：小游戏和一起读", () => {
  assert.match(app, /keepGameMemory: \(charIds, text, room\) => \{/);
  assert.match(app, /keepWhereItHappened\(\{ text: t0, charIds: ids, room: room, entry: \{ tags: \["小游戏"\], source: "manual" \} \}\)/);
  assert.match(app, /onAddMemory: \(text, charId, roomId\) => keepWhereItHappened\(\{/);
  assert.match(app, /entry: \{ source: "read", tags: \["一起读"\] \}/);
  // 回执要照实说：落在房里、那间房没了，两种都得有说法
  assert.match(app, /if \(where === "room"\) toast\("收进这间房了——只在这儿算数"\)/);
  assert.match(app, /if \(where === "gone"\) \{ toast\("这一局那间房已经不在了，没处收"\); return false; \}/);
  assert.match(read, /if \(where === "gone"\) \{ props\.toast && props\.toast\("这本书挂着的那间房已经不在了，没处记"\); return; \}/);
  assert.match(read, /where === "room" \? \(partner\.name \+ " 记住了——只在那间房里算数"\)/);
});

test("哑弹修好了：七个游戏引擎真的拿得到 keepGameMemory", () => {
  const i = games.indexOf("const engineProps = {");
  const ep = games.slice(i, games.indexOf("\n      if (session.game.key ===", i));
  // ⚠️行首锚死：不锚的话把它改名成 _keepGameMemory 也照样匹配得上
  //   （变异测试里它活下来过——而「名字对得上、其实没接上」正是这一版要修的那个病）。
  assert.match(ep, /\n\s*keepGameMemory: function \(ids, text\)/, "engineProps 里还是没有它＝七桌那颗键全是空按");
  assert.match(ep, /\(session\.config && session\.config\.room\) \|\| session\.room \|\| null/, "没把这一局是在哪间房打的递下去");
});

test("这一局是从哪间房邀出来的：自己从架上挑的一律算主线", () => {
  assert.match(games, /fromRoom\.current = \{ roomId: entry\.roomId \|\| "", personId: entry\.characterId \|\| "" \}/);
  assert.match(games, /onClick: function \(\) \{ fromRoom\.current = null; setGame\(g\); \}/, "自己挑一局的时候没把上一次那间房清掉");
  // ⚠️那一戳也要写进 config：存档存的是 config，从架上「继续上一局」回来时 session 是新造的
  assert.match(games, /const cfg = Object\.assign\(\{\}, config, \{ room: fromRoom\.current \|\| null \}\);/);
  assert.match(app, /setGameEntry\(\{ key: "game_" \+ Date\.now\(\), gameKey: m\.gameKey \|\| "", characterId: activeChar\.id, roomId: activeRoomId \|\| "main" \}\)/,
    "邀请卡没把房间号带过去，那这一局永远算主线");
});
