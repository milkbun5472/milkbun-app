// 她 2026-09-29：「按你倾向的来吧宝宝，12一起做 上限搞个拉条自由选择」。
//   ① 房内前情浓缩的上限每间房自己拉（digestCap）；
//   ② 关着「进记忆」的房，这儿的事记在这间房自己名下（x_roomMem_v1），只这间房读得到。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comps = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

// 每条测试一个干净的 localStorage（chat-rooms.js 在没有 loadJSON 时直接用它）
const fresh = () => {
  const store = {};
  global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  delete require.cache[require.resolve("../js/chat-rooms.js")];
  return { Rooms: require("../js/chat-rooms.js"), store };
};

test("拉条：没拉过＝4000，拉出范围的夹回来", () => {
  const { Rooms } = fresh();
  assert.equal(Rooms.digestCapOf({}), Rooms.ROOM_DIGEST_CAP);
  assert.equal(Rooms.digestCapOf({ digestCap: 99999 }), Rooms.ROOM_DIGEST_MAX);
  assert.equal(Rooms.digestCapOf({ digestCap: 10 }), Rooms.ROOM_DIGEST_MIN);
  assert.equal(Rooms.digestCapOf({ digestCap: 9000 }), 9000);
  assert.ok(Rooms.ROOM_DIGEST_MAX > Rooms.ROOM_DIGEST_CAP, "上限没比原来高＝白拉");
});

test("拉条真的管用：合并按这间房的上限整段掉，往小拉时也不拦腰砍", () => {
  const { Rooms } = fresh();
  const seg = "甲".repeat(1500);
  let d = "";
  for (let i = 0; i < 6; i++) d = Rooms.digestMerge(d, seg + i, 9000);
  assert.equal(d.split("\n\n").length, 5, "9000 的房该留 5 段");
  assert.equal(Rooms.digestMerge(d, "x"), Rooms.digestMerge(d, "x", Rooms.ROOM_DIGEST_CAP), "不传上限＝默认那一档");
  const shrunk = Rooms.normalize({ id: "r1", digestCap: 4000, selfDigest: d }, "c1");
  assert.ok(shrunk.selfDigest.length <= 4000);
  assert.ok(shrunk.selfDigest.startsWith("甲"), "拦腰砍了：开头成了半段");
  assert.equal(shrunk.digestCap, 4000);
  // 两个写入方都把这间房的上限递进去
  assert.match(app, /digestMerge\(cur\.selfDigest, block\.trim\(\), window\.ChatRooms\.digestCapOf\(cur\)\)/);
  assert.match(comps, /h\(Slider, \{ value: Kit\.digestCapOf\(draft\), min: Kit\.ROOM_DIGEST_MIN, max: Kit\.ROOM_DIGEST_MAX/);
});

test("房间记忆住在自己的键上，不是 x_memLib——主线那七十多处天生看不见", () => {
  const { Rooms, store } = fresh();
  assert.notEqual(Rooms.MEM_KEY, "x_memLib");
  assert.ok(Rooms.MEM_KEY.startsWith("x_"), "不带 x_ 前缀就不跟存档上云、不进导出");
  Rooms.memAdd("c1", "r1", [{ text: "在书店门口吵了一架", tags: ["吵架"] }]);
  assert.equal(store.x_memLib, undefined);
  assert.ok(JSON.parse(store[Rooms.MEM_KEY]).c1.length === 1);
});

test("只这间房读得到：别的房、主房都拿不到", () => {
  const { Rooms } = fresh();
  Rooms.memAdd("c1", "r1", [{ text: "在书店门口吵了一架" }]);
  Rooms.memAdd("c1", "r2", [{ text: "海边那晚他哭了" }]);
  assert.deepEqual(Rooms.memList("c1", "r1").map(e => e.text), ["在书店门口吵了一架"]);
  assert.deepEqual(Rooms.memList("c1", "r2").map(e => e.text), ["海边那晚他哭了"]);
  assert.equal(Rooms.memList("c2").length, 0, "串到别的角色名下了");
  assert.deepEqual(Rooms.memAdd("c1", Rooms.MAIN_ID, [{ text: "主房的" }]), [], "主房不许往这儿写——主房走记忆库");
  const r1 = Rooms.normalize({ id: "r1", name: "书店" }, "c1"), r2 = Rooms.normalize({ id: "r2", name: "海边" }, "c1");
  const p1 = Rooms.prompt(r1, [], { turns: 3, queryText: "书店" }), p2 = Rooms.prompt(r2, [], { turns: 3, queryText: "海边" });
  assert.ok(p1.includes("在书店门口吵了一架") && !p1.includes("海边那晚"), "r1 的提示词里混进了 r2 的记忆");
  assert.ok(p2.includes("海边那晚他哭了") && !p2.includes("书店门口"));
  assert.ok(!Rooms.prompt(Rooms.mainRoom("c1"), [], {}).includes("书店门口"), "主房读到了房间记忆");
});

test("写入按房去重、空的不写；删房时可以一起删", () => {
  const { Rooms } = fresh();
  assert.equal(Rooms.memAdd("c1", "r1", [{ text: "一起看了日落" }, { text: "一起看了日落。" }, { text: "  " }]).length, 1);
  assert.equal(Rooms.memAdd("c1", "r2", [{ text: "一起看了日落" }]).length, 1, "别的房同一句也该能记——那是另一条线");
  const e = Rooms.memList("c1", "r1")[0];
  assert.deepEqual(e.charIds, ["c1"]); assert.deepEqual(e.knownBy, ["c1"]);
  assert.equal(Rooms.memUpdate("c1", e.id, { text: "一起看了海上的日落" }).text, "一起看了海上的日落");
  assert.equal(Rooms.memCount("c1", "r1"), 1);
  Rooms.memDropRoom("c1", "r1");
  assert.equal(Rooms.memCount("c1", "r1"), 0);
  assert.equal(Rooms.memCount("c1", "r2"), 1, "删一间把别的房也删了");
});

test("召回借 retrieveMemories 那把尺，但不碰主线那份召回快照", () => {
  const { Rooms } = fresh();
  const seen = [];
  global.retrieveMemories = (lib, cid, q, opts) => { seen.push(opts); return lib; };
  try {
    Rooms.memAdd("c1", "r1", [{ text: "在天台上等了一夜" }]);
    Rooms.memRecall(Rooms.normalize({ id: "r1" }, "c1"), "q", 3);
    assert.equal(seen[0].touch, false, "touch 不是 false＝房里的事会写进「TA 知道什么」那份主线快照");
  } finally { delete global.retrieveMemories; }
});

test("自动抽取：抽的是这间房自己的聊天，开关只定落点；线上线下两处都接", () => {
  const i = app.indexOf("  const maybeAutoExtractRoom = async ("), j = app.indexOf("\n  };\n", i);
  assert.ok(i > 0 && j > i, "抠不出 maybeAutoExtractRoom");
  const fn = app.slice(i, j);
  assert.match(fn, /const toMain = !!\(room\.writeback && room\.writeback\.memoryCandidate\);/);
  // 开着：房里的聊天进主线（原来抽的是主聊天那一份，房里说的一条都没进过）
  assert.match(fn, /if \(toMain\) \{\n\s*await extractAndAddForChar\(char\.id, msgs, \{ liveMessages: all \}\);/);
  const roomSide = fn.slice(fn.indexOf("const existing = K.memList"));
  assert.match(roomSide, /K\.memAdd\(char\.id, room\.id, keep\)/);
  assert.ok(!/saveMemLib|addMemEntry|extractAndAddForChar/.test(roomSide), "关着的房写进了主记忆库");
  assert.ok(!/open: /.test(roomSide), "房里的约定接进了开环——到点TA会从主聊天来找她，等于漏出门");
  assert.match(app, /if \(room && !room\.main\) setTimeout\(\(\) => maybeAutoExtractRoom\(/);
  // 侧房不再去抽主聊天那一份
  assert.match(app, /if \(!room \|\| room\.main\) \{\n\s*setTimeout\(\(\) => maybeSummarize\(charId\), 100\);\n\s*setTimeout\(\(\) => maybeAutoExtract\(charId\), 300\);/);
  assert.match(app, /await maybeAutoExtractRoom\(char, room, \(sess\.msgs \|\| \[\]\)/);
});

test("删房时多问一句，并且先叫她导出", () => {
  const i = comps.indexOf("  const removeRoom = room => {"), j = comps.indexOf("  const clearRoom = room => {", i);
  assert.ok(i > 0 && j > i, "抠不出 removeRoom");
  const fn = comps.slice(i, j);
  assert.match(fn, /Kit\.memCount\(character\.id, room\.id\)/);
  assert.ok(fn.includes("导出全部数据"), "会让数据消失的一步前面没带导出（never-say-delete-first）");
  assert.match(fn, /if \(dropMem\) Kit\.memDropRoom\(character\.id, room\.id\)/);
});

test("记忆库：这个人名下分主线 / 各间房，默认主线，删了的房归一格", () => {
  assert.match(screens, /const \[roomScope, setRoomScope\] = useState\("main"\);/);
  assert.match(screens, /name: "已删的房间"/);
  assert.match(screens, /RK\.memList\(personKey, roomScope\)/);
});

// ── 她 2026-09-29 第二批：「2要是接了向量也用向量吧宝宝 35也顺便做了吧」 ──
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

test("向量：房间记忆也配，但不上共用表、不替主线清孤儿；主线那趟也不许清掉房里的", () => {
  const i = engine.indexOf("async function ensureMemVecs("), j = engine.indexOf("async function syncMemVecsToCloud(", i);
  assert.ok(i > 0 && j > i, "抠不出 ensureMemVecs");
  const fn = engine.slice(i, j);
  assert.match(fn, /if \(!opts\.noPrune\) \{/);
  assert.match(fn, /window\.ChatRooms\.memAllIds\(\)\.forEach\(id => liveIds\.add\(id\)\)/, "主线存一次记忆库就把房里的向量全清光了");
  assert.match(fn, /if \(!opts\.noCloud && typeof window !== "undefined" && window\.Cloud && window\.Cloud\.memVecFetch\)/);
  assert.match(fn, /if \(!opts\.noCloud && typeof window !== "undefined" && window\.Cloud && window\.Cloud\.memVecUpsert\)/, "房里的事被推上了跟 CC 共用的向量表");
  const rooms = fs.readFileSync(path.join(root, "js/chat-rooms.js"), "utf8");
  assert.match(rooms, /ensureMemVecs\(memAll\(\), \{ noCloud: true, noPrune: true \}\)/);
});

test("向量：召回不再关向量；查询向量用跟 queryText 同一段字预热", () => {
  const { Rooms } = fresh();
  const seen = [];
  global.retrieveMemories = (lib, cid, q, opts) => { seen.push(opts); return lib; };
  try {
    Rooms.memAdd("c1", "r1", [{ text: "在天台上等了一夜" }]);
    Rooms.memRecall(Rooms.normalize({ id: "r1" }, "c1"), "q", 3);
    assert.notEqual(seen[0].vec, false, "还关着向量");
  } finally { delete global.retrieveMemories; }
  assert.match(app, /await primeQueryVec\(roomRecentText\(charId, room\.id\)\);/);
  assert.match(app, /queryText: roomRecentText\(charId, room\.id\), record: !!record/);
});

test("「TA 知道什么」：真发出去的那一轮留一张房间召回收据，预览不留，也不混进主线那份", () => {
  const { Rooms } = fresh();
  global.window = {};
  try {
    Rooms.memAdd("c1", "r1", [{ text: "在天台上等了一夜" }]);
    const room = Rooms.normalize({ id: "r1", name: "天台" }, "c1");
    Rooms.prompt(room, [], { turns: 2, queryText: "天台" });
    assert.equal(global.window.__roomRecallSnapshots, undefined, "预览也留了收据");
    Rooms.prompt(room, [], { turns: 2, queryText: "天台", record: true });
    const snap = global.window.__roomRecallSnapshots.c1;
    assert.equal(snap.roomName, "天台");
    assert.deepEqual(snap.picked.map(x => x.text), ["在天台上等了一夜"]);
    assert.equal(global.window.__memoryRecallSnapshots, undefined, "写进了主线那份快照");
  } finally { delete global.window; }
  assert.match(app, /const _roomHint = roomPromptFor\(charId, room, true\);/);
  assert.match(app, /roomPromptFor\(char\.id, cur\.room, true\)/);
  assert.match(screens, /window\.__roomRecallSnapshots\[String\(id\)\]/);
});

test("挪进主线：先经记忆库自己的 onAdd 写进去，写成了才删房里那条", () => {
  const i = screens.indexOf("  const moveRoomMemToMain = e =>"), j = screens.indexOf("  const editRoomMem = e =>", i);
  assert.ok(i > 0 && j > i, "抠不出 moveRoomMemToMain");
  const fn = screens.slice(i, j);
  assert.match(fn, /onAdd\(\{ text: e\.text, tags: e\.tags \|\| \[\], charIds: \[personKey\], knownBy: \[personKey\]/);
  assert.ok(fn.indexOf("if (!made) return") < fn.indexOf("RK.memRemove(personKey, e.id)"), "没写成也把房里那条删了");
  // 桩照写入方：addMemEntry 成功时返回那一条
  assert.match(app, /return entry;   \/\/ v58\.83/);
});
