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

test("自动抽取：只在关着「进记忆」的房里跑，线上线下两处都接", () => {
  const i = app.indexOf("  const maybeAutoExtractRoom = async ("), j = app.indexOf("\n  };\n", i);
  assert.ok(i > 0 && j > i, "抠不出 maybeAutoExtractRoom");
  const fn = app.slice(i, j);
  assert.match(fn, /if \(room\.writeback && room\.writeback\.memoryCandidate\) return;/);
  assert.match(fn, /K\.memAdd\(char\.id, room\.id, keep\)/);
  assert.ok(!/saveMemLib|addMemEntry/.test(fn), "房间抽取写进了主记忆库");
  assert.ok(!/open: /.test(fn), "房里的约定接进了开环——到点TA会从主聊天来找她，等于漏出门");
  assert.match(app, /if \(room && !room\.main && !_roomMayRemember\) setTimeout\(\(\) => maybeAutoExtractRoom\(/);
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
