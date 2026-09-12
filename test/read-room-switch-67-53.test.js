// 她 2026-09-12：「我就是想在某个房间开一起读的开关，然后现在的讨论给他灌回来……
//   比如我今天和他看三章，下次第四章他也能记得前面说过啥」。
//
// 这一版只做前一半（开关＋盖戳＋上闸），讨论灌回来是下一版。
// 形状照一起学抄：房间里一个动作开关 → 他推一张卡 → 点了才真去读；
// 书上盖一个 roomId，写回边界认这一戳。
//
// ⚠️上闸必须跟盖戳同一版落地：「你和她在一起读《X》」原来是【无条件】说出口的，
//   书一旦能属于某间侧房，这句就会从主线的他嘴里漏出来——跟一起学当年那个洞一样。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = f => fs.readFileSync(path.join(root, f), "utf8");
const app = R("js/app.js"), comp = R("js/components.js"), read = R("js/read.js");

const freshRooms = () => {
  const store = {};
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  global.loadJSON = (k, fb) => { try { const v = store[k]; return v ? JSON.parse(v) : fb; } catch (_) { return fb; } };
  delete require.cache[require.resolve("../js/chat-rooms.js")];
  return { Rooms: require("../js/chat-rooms.js"), store };
};

test("房间里多了「一起读」这一档，归档那一档默认开着", () => {
  const { Rooms } = freshRooms();
  assert.deepEqual(Rooms.GROUPS.actions.map(([k]) => k), ["study", "games", "fanfic", "read"]);
  const [, label, note] = Rooms.GROUPS.actions.find(([k]) => k === "read");
  assert.equal(label, "他可以拉你一起读");
  assert.match(note, /接着读那本书/);
  assert.equal(Rooms.PRESETS.focused.actions.read, true, "「一起做件事」那一档该把一起读也开上");
  assert.equal(Rooms.PRESETS.isolated.actions.read, false);
  // 开关一开，房间提示词里那一行自己就会多出这一样（清单是从 GROUPS 长出来的）
  const side = Rooms.create("p1", "读书角", "focused");
  assert.match(Rooms.prompt(side, []), /他可以拉你一起读/);
});

test("这间房的事算不算数：一份判据，课和书问的是同一句", () => {
  const { Rooms } = freshRooms();
  const open = Rooms.create("p1", "带得出门", "focused");      // memoryCandidate 开着
  const sealed = Rooms.create("p1", "不带出门", "isolated");   // 两个口子都关
  assert.equal(Rooms.roomCounts("p1", "main"), true, "主线的一律算");
  assert.equal(Rooms.roomCounts("p1", null), true, "没戳 roomId 的老书＝主线，照旧放行");
  assert.equal(Rooms.roomCounts("p1", open.id), true);
  assert.equal(Rooms.roomCounts("p1", sealed.id), false);
  assert.equal(Rooms.roomCounts("p1", "room_已经删了"), false, "房间没了要按不算数处理，宁可少说");
  // 课那一头是【转交】，不是各判各的：同一间房两边答案必须一样
  [["main", true], [open.id, true], [sealed.id, false]].forEach(([rid, want]) => {
    assert.equal(Rooms.studyCounts("p1", { roomId: rid }), want, "课和书在 " + rid 	+ " 里答案不一样");
  });
});

test("房里在读哪几本：照存档里真有的那几栏筛（partnerId／roomId／lastReadTs）", () => {
  const { Rooms, store } = freshRooms();
  const now = Date.now();
  store.x_read_books = JSON.stringify([
    { id: "b1", title: "旧的那本", partnerId: "c1", roomId: "r9", lastReadTs: now - 5000 },
    { id: "b2", title: "新的那本", partnerId: "c1", roomId: "r9", lastReadTs: now },
    { id: "b3", title: "别人的书", partnerId: "c9", roomId: "r9", lastReadTs: now },
    { id: "b4", title: "主线那本", partnerId: "c1", lastReadTs: now }
  ]);
  assert.deepEqual(Rooms.readBooksFor("c1", "r9").map(b => b.id), ["b2", "b1"], "没按最近读过排");
  assert.deepEqual(Rooms.readBooksFor("c1", "main").map(b => b.id), ["b4"], "没戳 roomId 的书应该算主线那间");
  assert.deepEqual(Rooms.readBooksFor("c9", "main").map(b => b.id), []);
});

test("四样活动共用一道闸，一起读是第四样", () => {
  assert.match(app, /const roomActionOn = k => !!\(room && !room\.main && room\.actions && room\.actions\[k\] && !_s\.engineerEyes\);/);
  [["roomStudyOn", "study"], ["roomGamesOn", "games"], ["roomFicOn", "fanfic"]].forEach(([v, k]) =>
    assert.match(app, new RegExp("const " + v + " = roomActionOn\\(\"" + k + "\"\\);"), k + " 那一处没搬过来"));
  assert.match(app, /roomActionOn\("read"\)/);
  // 老拼法一处都不许剩（留一份就是又开了一处要同步的地方）
  assert.ok(!/room\.actions\.(study|games|fanfic|read) && !_s\.engineerEyes/.test(app), "还有人自己又判了一遍");
});

test("他只能拉你接着读【房里已经有的那本】，没有书就不给这一格", () => {
  const seg = app.slice(app.indexOf("      const roomReadBooks ="), app.indexOf("      // ⚠️这一条必须挂在【Protocol v2】上"));
  assert.ok(seg.length > 200, "没切到那一段");
  assert.match(seg, /window\.ChatRooms\.readBooksFor\(charId, room\.id\)/);
  assert.match(seg, /if \(roomReadBooks\.length\) \{/, "没书也把这一格发出去＝他会邀请你读一本不存在的书");
  assert.match(seg, /openCaps\.push\("readInvite"\)/);
  // 他不许声称已经读过（一起学那张卡定下的规矩，这儿照抄）
  assert.match(seg, /不能声称已经读过或已经写好批注/);
  assert.match(seg, /在读的书：/);
  // 落卡那一头只认真存在的 bookId
  const card = app.slice(app.indexOf('if (roomReadBooks.length && parsed.readInvite'), app.indexOf('if (roomGamesOn && parsed.gameInvite'));
  assert.match(card, /roomReadBooks\.find\(b => String\(b\.id\) === String\(parsed\.readInvite\.bookId \|\| ""\)\)/, "编个 id 出来也照发");
  assert.match(card, /kind: "readinvite", bookId: bk\.id/);
  assert.match(card, /读到第 " \+ \(\(Number\(bk\.page\) \|\| 0\) \+ 1\) \+ " 页/);
});

test("侧房里读的书不许从主线的他嘴里说出来", () => {
  const i = app.indexOf("  const togetherLines = char => {");
  const j = app.indexOf("  const ambientMaterialFor");
  const seg = app.slice(i, j);
  assert.match(seg, /window\.ChatRooms\.roomCounts\(char\.id, b\.roomId\)/, "一起读那条没过闸");
  // 判在 ChatRooms 一处，这儿不许再判一遍
  assert.ok(!/b\.roomId[^)]*writeback/.test(seg), "又在这儿自己拆了一遍写回开关");
});

test("卡长在原来那张上，点了直接翻到他停着的那一页", () => {
  assert.match(comp, /if \(m\.kind === "studyinvite" \|\| m\.kind === "gameinvite" \|\| m\.kind === "readinvite"\)/);
  assert.match(comp, /isRead = m\.kind === "readinvite"/);
  assert.match(comp, /isRead \? "翻到那一页"/);
  assert.match(comp, /if \(isRead\) \{ onOpenReadInvite && onOpenReadInvite\(m\); \}/);
  assert.match(app, /onOpenReadInvite: m => \{/);
  assert.match(app, /setReadEntry\(\{ key: "read_" \+ Date\.now\(\), bookId: String\(m\.bookId \|\| ""\), characterId: activeChar\.id \}\)/);
  assert.match(app, /entry: readEntry,/);
  assert.match(app, /onEntryTaken: \(\) => setReadEntry\(null\)/, "用完不清，下次进书架又会被拽走");
});

test("书上盖戳：新书默认主聊天，换了人就把房间退回去", () => {
  assert.match(read, /partnerId: null, roomId: "main",/, "建书那一行没盖戳");
  assert.match(read, /onPick: function \(id\) \{ props\.onPatch\(\{ partnerId: id, roomId: id === book\.partnerId \? \(book\.roomId \|\| "main"\) : "main" \}\); \}/,
    "换了人还留着上一个人的房间＝一张错的戳");
  // 挑完人不能把这一层关掉，否则没地方挑房间
  const sheet = read.slice(read.indexOf("      pickOpen ? h(PartnerPicker"), read.indexOf("      selResult ?"));
  assert.ok(sheet.indexOf("setPickOpen(false)") < 0 || /onClose: function \(\) \{ setPickOpen\(false\); \}/.test(sheet),
    "挑完人就把选房间那一层关掉了");
  assert.match(read, /props\.currentId \? \(function \(\) \{/, "没挑人就不该问房间");
  assert.match(read, /row\("main", "主聊天"/);
});

test("从卡进来直接开那一本，而且只吃一次", () => {
  const seg = read.slice(read.indexOf("    const tookEntry = useRef"), read.indexOf("    const persist = function"));
  assert.ok(seg.length > 150, "没切到那一段");
  assert.match(seg, /tookEntry\.current === e\.key/, "同一张卡会被反复吃");
  assert.match(seg, /loadBooks\(\)\.some\(function \(b\) \{ return b\.id === e\.bookId; \}\)/, "书没了还硬开");
  assert.match(seg, /props\.onEntryTaken && props\.onEntryTaken\(\)/);
});
