// 联机房间的墙、歌单、文档（她 2026-11-22「把频道里的三样搬进联机房间」）：数据都在 room.board，锁只在线上
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const src = read("js/netroom.js"), en = read("js/engine.js"), cs = read("js/components.js");

// 频道文件那几样纯函数（engine.js）：联机的文档就是照它们写的
function engine() {
  const i = en.indexOf("const CHF_HIST_CAP"), j = en.indexOf("// 频道（她 2026-11-20）：群挂着 spaceId", i);
  assert.ok(i > 0 && j > i, "抠不出频道文件那一段");
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(en.slice(i, j) + ";this.E={chfApplyDoc,chfPatchText,CHF_HIST_CAP,chfNameKey,chpSongNorm,chfMentioned};", ctx);
  return ctx.E;
}
function load() {
  const E = engine(), store = {};
  const w = { loadJSON: (k, d) => (k in store ? JSON.parse(store[k]) : d), saveJSON: (k, v) => { store[k] = JSON.stringify(v); } };
  new Function("window", "loadJSON", "saveJSON", "chfApplyDoc", "chfPatchText", "CHF_HIST_CAP", "chfNameKey", "chpSongNorm", "chfMentioned", src)
    (w, w.loadJSON, w.saveJSON, E.chfApplyDoc, E.chfPatchText, E.CHF_HIST_CAP, E.chfNameKey, E.chpSongNorm, E.chfMentioned);
  return w.NetRoomCore;
}
const C = load();
// 房间桩照写入方：报到时 Core.upsertRoom 存的那份（myPeerId、peers、msgs 里 side/peerId）
const room0 = () => ({ id: "nr_1", code: "123456", myPeerId: "pB", myNick: "小林", peers: [{ peerId: "pA", nick: "阿星", chars: [] }], myChars: [{ id: "c1", name: "沈屿" }], msgs: [] });
const note = (id, by, text, extra) => Object.assign({ id, by, name: by === "pB" ? "小林" : "阿星", text, ts: 1000 }, extra || {});

test("便签白名单：只留 id/by/name/text/ts/charId，正文截到 140 字，空的不收", () => {
  const n = C.cleanNote({ id: "n1", by: "pA", name: "阿星", text: "x".repeat(300), ts: 5, evil: "<script>", charId: "c9" });
  assert.deepEqual(Object.keys(n).sort(), ["by", "charId", "id", "name", "text", "ts"]);
  assert.equal(n.text.length, C.NOTE_MAX);
  assert.equal(C.cleanNote({ id: "n2", by: "pA", text: "  " }), null);
  assert.equal(C.cleanNote({ id: "", by: "pA", text: "hi" }), null);
});

test("文档白名单：只认那几样，历史线上只带最近几次", () => {
  const H = Array.from({ length: 20 }, (_, k) => ({ by: "pA", ts: k, before: "a", after: "b", junk: 1 }));
  const d = C.cleanDoc({ id: "d1", name: "《行程》", text: "t", ver: 3, createdBy: "pA", names: { pA: "阿星" }, history: H, hack: true }, true);
  assert.ok(!("hack" in d));
  assert.equal(d.history.length, 8);
  assert.ok(!("junk" in d.history[0]));
  assert.equal(C.cleanDoc({ id: "d2", name: " " }), null);
});

test("收到的贴、加歌、改文档：作者一律记成发来的那台（不能替别人贴）", () => {
  assert.match(src, /e\.t === "bnote" && e\.note\) \{\s*const n = Core\.cleanNote\(Object\.assign\(\{\}, e\.note, \{ by: origin \}\)\)/);
  assert.match(src, /e\.t === "bsong" && e\.song\) \{\s*const x = Object\.assign\(\{\}, e\.song, \{ by: origin \}\)/);
  assert.match(src, /String\(\(e\.doc && e\.doc\.updatedBy\) \|\| ""\)\.split\("\|"\)\[0\] !== origin\) return;/);
  assert.match(src, /e\.t === "bdrop" && e\.id\) \{\s*const r2 = Core\.boardDrop\(r, String\(e\.id\)\.slice\(0, 60\), origin\)/);
});

test("便签：只认作者删自己的；删过留墓碑，补记录不会再冒回来", () => {
  let r = C.noteAdd(room0(), note("n1", "pA", "周六见"));
  r = C.noteAdd(r, note("n2", "pB", "带零食"));
  assert.equal(C.boardOf(r).notes.length, 2);
  assert.equal(C.boardDrop(r, "n1", "pB"), r, "别人贴的我删不动");
  const r2 = C.boardDrop(r, "n1", "pA");
  assert.deepEqual(C.boardOf(r2).notes.map(n => n.id), ["n2"]);
  assert.deepEqual(C.boardOf(r2).tombs, [{ id: "n1", by: "pA" }]);
  assert.equal(C.boardOf(C.noteAdd(r2, note("n1", "pA", "周六见"))).notes.length, 1, "删过的再贴回来不收");
  // 角色贴的归带 TA 来的那台
  const r3 = C.noteAdd(r2, note("n3", "pB", "我也去", { charId: "c1", name: "沈屿" }));
  assert.equal(C.boardOf(C.boardDrop(r3, "n3", "pB")).notes.some(n => n.id === "n3"), false);
});

test("报到补齐：缺的补上；墓碑只认发来那个人自己的", () => {
  const mine = C.noteAdd(room0(), note("n2", "pB", "带零食"));
  const inc = { notes: [note("n1", "pA", "周六见"), note("n2", "pB", "带零食")], songs: [], docs: [], tombs: [{ id: "n2", by: "pB" }] };
  const r = C.mergeBoard(mine, inc, "pA");
  assert.deepEqual(C.boardOf(r).notes.map(n => n.id).sort(), ["n1", "n2"], "pA 报来的「pB 删了 n2」不算数");
  const r2 = C.mergeBoard(r, { tombs: [{ id: "n1", by: "pA" }] }, "pA");
  assert.deepEqual(C.boardOf(r2).notes.map(n => n.id), ["n2"]);
  const r3 = C.mergeBoard(r2, { notes: [note("n1", "pA", "周六见")] }, "pC");
  assert.deepEqual(C.boardOf(r3).notes.map(n => n.id), ["n2"], "转来的旧一份也补不回删掉的");
  // 报到发的就是这一份
  assert.match(src, /send\(Object\.assign\(\{ t: "board" \}, Core\.boardWire\(r\)\)\);/);
});

test("歌单：房里发过的歌卡自己收进来，同一首只留一次；手动加的也算；只认作者拿掉", () => {
  const r = Object.assign(room0(), { msgs: [
    { id: "m1", side: "peer", peerId: "pA", name: "阿星", type: "song", x: { title: "晴天", artist: "周杰伦" }, ts: 10 },
    { id: "m2", side: "me", name: "小林", type: "song", x: { title: "晴天（Live）", artist: "周杰伦" }, ts: 20 },
    { id: "m3", side: "me", name: "小林", type: "song", x: { title: "夜曲" }, ts: 30, recalled: true }] });
  let pl = C.playlist(r);
  assert.deepEqual(pl.map(x => x.id), ["sm_m1"]);
  assert.equal(pl[0].by, "pA");
  const r2 = C.songAdd(r, { id: "sp1", by: "pB", name: "小林", song: { title: "稻香" }, ts: 40 });
  assert.equal(C.songAdd(r2, { id: "sp2", by: "pA", song: { title: "晴天" }, ts: 50 }), r2, "已在歌单的不重复加");
  pl = C.playlist(r2);
  assert.deepEqual(pl.map(x => x.song.title), ["晴天", "稻香"]);
  assert.equal(C.boardDrop(r2, "sm_m1", "pB"), r2, "别人的歌卡我拿不掉");
  assert.deepEqual(C.playlist(C.boardDrop(r2, "sm_m1", "pA")).map(x => x.song.title), ["晴天（Live）", "稻香"], "TA 拿掉自己那张，我发的同一首还在");
});

test("文档：写一次版本号加一，旧版本盖不了新版本，同一版按 peerId 小的算", () => {
  let w = C.docWrite(room0(), "行程", "周六\n去海边", "pB", "小林", 100);
  assert.equal(w.op, "create"); assert.equal(w.doc.ver, 1);
  const d1 = w.doc;
  w = C.docWrite(w.room, "《行程》", "周六\n去山上", "pB|c1", "沈屿", 200);
  assert.equal(w.op, "edit"); assert.equal(w.doc.ver, 2);
  assert.equal(w.doc.names["pB|c1"], "沈屿");
  const now = w.room;
  assert.equal(C.docPut(now, d1).ok, false, "第 1 版来晚了，不收");
  assert.equal(C.boardOf(now).docs[0].text, "周六\n去山上");
  const v3 = Object.assign({}, w.doc, { ver: 3, text: "改成第三版", updatedBy: "pA" });
  assert.equal(C.boardOf(C.docPut(now, v3).room).docs[0].text, "改成第三版");
  const same = Object.assign({}, w.doc, { text: "同一版另一份", updatedBy: "pA" });
  assert.equal(C.docPut(now, same).ok, true, "同一版：pA 比 pB 小，pA 的算");
  assert.equal(C.docPut(now, Object.assign({}, w.doc, { text: "同一版", updatedBy: "pZ" })).ok, false);
  // 只有开这份的人能删
  assert.equal(C.boardDrop(now, d1.id, "pA"), now);
  assert.equal(C.boardOf(C.boardDrop(now, d1.id, "pB")).docs.length, 0);
});

test("锁：有人在写别人拿不到；60 秒没心跳自动放；同时拿按 peerId 小的；放锁只认拿着的人", () => {
  let l = {};
  let r = C.lockTake(l, "d1", "pB", "小林", 1000); assert.ok(r.ok); l = r.locks;
  assert.equal(C.lockTake(l, "d1", "pA", "阿星", 2000).ok, false, "小林在写，阿星拿不到");
  assert.equal(C.lockReason(l, "d1", "pA", [], 2000), "小林 正在写");
  assert.equal(C.lockReason(l, "d1", "pB", ["沈屿"], 2000), "", "自己拿着就不算锁");
  assert.equal(C.lockFree(l, "d1", "pA"), l, "别人放不了我的锁");
  // 超时
  assert.equal(C.lockLive(l, "d1", 1000 + C.LOCK_TTL + 1), null);
  assert.ok(C.lockTake(l, "d1", "pA", "阿星", 1000 + C.LOCK_TTL + 1).ok, "掉线一分钟后别人能拿");
  assert.deepEqual(C.lockPrune(l, 1000 + C.LOCK_TTL + 1), {});
  // 心跳续上就不会过期
  const hb = C.lockHear(l, { doc: "d1", on: true, name: "小林" }, "pB", 50000).locks;
  assert.ok(C.lockLive(hb, "d1", 1000 + C.LOCK_TTL + 1));
  // 并发：pB 先拿着，收到 pA（更小）的 → 归 pA，pB 被挤掉；反过来 pA 收到 pB 的 → 不理
  const lost = C.lockHear(l, { doc: "d1", on: true, name: "阿星" }, "pA", 1500);
  assert.equal(lost.locks.d1.peer, "pA"); assert.equal(lost.lost, "pB");
  const kept = C.lockHear(lost.locks, { doc: "d1", on: true, name: "小林" }, "pB", 1600);
  assert.equal(kept.locks.d1.peer, "pA"); assert.equal(kept.lost, "");
  assert.equal(C.lockHear(kept.locks, { doc: "d1", on: false }, "pB", 1700).locks.d1.peer, "pA", "pB 说放了也放不了 pA 的");
  assert.deepEqual(C.lockDropPeer(kept.locks, "pA"), {}, "离开房间的人手上的锁跟着放");
});

test("角色正在说话时也锁着：她点「改」拿不到；角色写之前也要拿锁，有人在写就不动", () => {
  assert.equal(C.lockReason({}, "d1", "pB", ["沈屿"], 1), "沈屿 正在说话，等说完再写");
  assert.equal(C.lockReason({}, "d1", "pB", [], 1), "");
  assert.match(src, /const startEdit = d => \{ const why = docWhy\(d\.id\); if \(why\)/);
  assert.match(src, /const speakingNames = \(\) => Object\.keys\(busyRef\.current\)[\s\S]{0,200}peerTypingRef\.current/);
  const cw = src.slice(src.indexOf("const charWrite = "), src.indexOf("finally { freeLock(lockId); }"));
  assert.ok(cw.length > 100, "抠不出 charWrite");
  assert.match(cw, /myLocks\.current\.has\(old\.id\) \|\| Core\.lockLive\(locksRef\.current, old\.id, Date\.now\(\)\)/);
  assert.match(cw, /if \(!takeLock\(lockId, nm\)\) return;/);
});

test("编辑页：拿着锁的人以外只能看；收起编辑（存下／关掉／被挤掉）就放锁；频道那边不传锁照旧", () => {
  const i = cs.indexOf("function ChfDocPage("), j = cs.indexOf("function ChfImagePage(", i);
  assert.ok(i > 0 && j > i);
  const page = cs.slice(i, j);
  assert.match(page, /lockNote \? h\("span", \{ "data-wk": "chflocked"/);
  assert.match(page, /if \(onEditStart && onEditStart\(\) === false\) return;/);
  assert.match(page, /useEffect\(\(\) => \{ if \(!edit\) return; return \(\) => \{ endRef\.current && endRef\.current\(\); \}; \}, \[edit\]\);/);
  assert.match(page, /useEffect\(\(\) => \{ if \(edit && lockNote\) setEdit\(false\); \}, \[edit, lockNote\]\);/);
  assert.match(page, /fitTextarea\(e\.target, 100000\)/, "编辑框照旧走 fitTextarea");
  assert.match(src, /h\(ChfDocPage, \{ key: "doc" \+ d\.id, file: d, nameOf: k => docName\(d, k\), lockNote: docWhy\(d\.id\),\s*onEditStart: \(\) => startEdit\(d\), onEditEnd: \(\) => freeLock\(d\.id\)/);
  // 频道文件页调 ChfDocPage 时不带锁
  const ch = cs.slice(cs.indexOf("function ChannelFilesPage("), cs.indexOf("function GroupAdoptPage("));
  assert.ok(/h\(ChfDocPage, \{/.test(ch) && !/lockNote/.test(ch));
});

test("墙：频道和房间画的是同一张 StickyNote；公共那段里不提联机", () => {
  const k = cs.indexOf("function StickyNote("), e = cs.indexOf("function ChannelPlayView(", k);
  assert.ok(k > 0 && e > k);
  assert.ok(!/联机|netroom/i.test(cs.slice(cs.lastIndexOf("\n//", cs.indexOf("const STICKY_TINT")) - 400, e)));
  assert.match(cs.slice(e, cs.indexOf("function ChannelTabs(")), /h\(StickyNote, \{ key: n\.id, n, i, nameOf: nm, mine: n\.by === "me"/);
  assert.match(src, /h\(StickyNote, \{ key: n\.id, n, i, mine: n\.by === me/);
});

test("角色能写：note、file 从 TA 那条里解出来；一起说那条照样有", () => {
  const a = C.actsOf({ note: { text: "周六别迟到" }, file: { name: "购物清单", add: ["可乐", ""], remove: "薯片" } }, {});
  assert.equal(a.note, "周六别迟到");
  assert.deepEqual(a.file, { name: "购物清单", add: ["可乐"], remove: ["薯片"] });
  assert.ok(a.any);
  assert.equal(C.actsOf({ file: { name: "空的" } }, {}).file, null, "没写内容的不算");
  assert.equal(C.actsOf({ note: "便签字符串也认" }, {}).note, "便签字符串也认");
  const got = C.jointLines(JSON.stringify([{ name: "沈屿", text: "", note: { text: "我记下了" } }]), [{ id: "c1", name: "沈屿" }], "小林");
  assert.equal(got.length, 1); assert.equal(got[0].acts.note, "我记下了");
  // 落地：等这一轮话发完再贴、再写；今天贴满了就不贴
  assert.match(src, /if \(acts\.note\) later\.push\(\(\) => \{ if \(Core\.charNotesToday\(roomRef\.current, meId\.current, Date\.now\(\)\) < Core\.CHAR_NOTES_PER_DAY\) addNote/);
  assert.match(src, /if \(acts\.file\) later\.push\(\(\) => charWrite\(charId, nm, acts\.file\)\);/);
});

test("进提示词：墙、歌单、文档（有人在写那份标出来），单人和一起说都带；能做的那几格也在", () => {
  let r = C.noteAdd(room0(), note("n1", "pA", "周六见"));
  r = C.songAdd(r, { id: "sp1", by: "pA", name: "阿星", song: { title: "稻香" }, ts: 1 });
  r = C.docWrite(r, "行程", "周六去海边", "pA", "阿星", Date.now()).room;
  const did = C.boardOf(r).docs[0].id;
  const block = C.boardBlock(r, { locks: { [did]: { peer: "pA", name: "阿星", at: Date.now() } }, me: "pB", recent: "", nameOf: k => k === "pA" ? "阿星" : "" });
  assert.match(block, /墙上的便签：「周六见」（阿星）/);
  assert.match(block, /房间歌单（最近几首）：《稻香》，阿星加的/);
  assert.match(block, /《行程》5 字，最后是 阿星 动的；此刻 阿星 正在写/);
  assert.match(block, /《行程》全文：\n周六去海边/, "刚改过的带正文");
  const acts = { board: { noteOk: true, docOk: true, docNew: true }, playlist: ["稻香"], songOn: true };
  const one = C.lineInstruction(r, { id: "c1", name: "沈屿" }, { boardText: block, acts });
  assert.ok(one.indexOf("【房间里摆着的东西】") > 0);
  assert.match(one, /"note":\{"text":"往墙上贴一张便签"\}/);
  assert.match(one, /"file":\{"name":"文档名"/);
  assert.match(one, /歌单里有：稻香/);
  const two = C.jointInstruction(r, [{ id: "c1", name: "沈屿" }, { id: "c2", name: "顾" }], { boardText: block, acts });
  assert.ok(two.indexOf("【房间里摆着的东西】") > 0 && /"note":\{"text"/.test(two));
  assert.ok(!/"note":/.test(C.lineInstruction(r, { id: "c1", name: "沈屿" }, { acts: { board: { noteOk: false } } })), "今天贴满了就不提");
  // 长文档只给开头和最后一截
  const long = C.docWrite(room0(), "长文", "字".repeat(5000), "pA", "阿星", Date.now()).room;
  assert.ok(C.boardBlock(long, {}).length < 2500);
  // 两处开口都带上
  assert.equal((src.match(/boardText: boardText\(cur\)/g) || []).length, 2);
});

test("退房记忆：带上墙上的便签和文档开头一截", () => {
  let r = C.noteAdd(room0(), note("n1", "pA", "周六见"));
  r = C.docWrite(r, "行程", "周六去海边", "pA", "阿星", 1).room;
  const m = C.memoryInstruction(r, { id: "c1", name: "沈屿" }, []);
  assert.match(m, /【房间里留下的东西】\n墙上的便签：「周六见」（阿星）\n共用文档《行程》：周六去海边/);
});
