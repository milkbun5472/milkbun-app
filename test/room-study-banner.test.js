// 她 2026-09-23：「从哪儿开房就要有横幅导回哪儿……给 A 开了三个一起学，只有 1、2 我想放进来，
// 那就应该有横幅在最右边可以切换，然后点击进入这个一起学课程」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const study = read("study.js"), app = read("app.js"), comp = read("components.js"), rooms = read("chat-rooms.js");
const fn = name => { const i = study.indexOf("function " + name + "("); assert.ok(i > 0, "抠不出 " + name); return study.slice(i, study.indexOf("\n  }\n", i) + 4); };

// 桩照写存档那几段：课由 createCur 写（character_ids / teacher_id / roomId），
// 研究纸由 NewCostudy 的 onCreated 写（curriculum_id:null, mode:"costudy", roomId），课页由 confirm() 写（curriculum_id + roomId）。
function harness() {
  let curs = [
    { id: "cur1", subject: "日语", mode: "teach", character_ids: ["a"], teacher_id: "a", roomId: null, updated_at: 3 },
    { id: "cur2", subject: "吉他", mode: "teach", character_ids: ["a"], teacher_id: "a", roomId: null, updated_at: 2 },
    { id: "cur3", subject: "别人的课", mode: "teach", character_ids: ["b"], teacher_id: "b", roomId: null, updated_at: 1 }];
  let sess = [
    { id: "st1", curriculum_id: "cur1", mode: "teach", character_ids: ["a"], teacher_id: "a", roomId: null },
    { id: "st2", curriculum_id: null, mode: "costudy", character_ids: ["a"], teacher_id: null, subject: "论文", roomId: "room_x", updated_at: 1 }];
  const ctx = { Date, Math, JSON, Number, String, Array, Object,
    loadCurricula: () => JSON.parse(JSON.stringify(curs)), saveCurricula: a => { curs = JSON.parse(JSON.stringify(a)); },
    loadSessions: () => JSON.parse(JSON.stringify(sess)), saveSessions: a => { sess = JSON.parse(JSON.stringify(a)); } };
  vm.createContext(ctx);
  vm.runInContext(["findCurriculum", "saveCurriculum", "studyCoursesOf", "setCourseRoom"].map(fn).join("\n")
    + "\nObject.assign(this, { of: studyCoursesOf, move: setCourseRoom });", ctx);
  ctx.curs = () => curs; ctx.sess = () => sess;
  return ctx;
}

test("TA 的课：课程和研究纸都列出来，别人的不列，各自记着在哪间房", () => {
  const H = harness();
  const all = H.of("a");
  assert.equal(JSON.stringify(all.map(c => c.kind + ":" + c.id + "@" + c.roomId)), JSON.stringify(["cur:cur1@main", "cur:cur2@main", "paper:st2@room_x"]));
});

test("收进来只挪以后：课换了房，已经上过的课页还留在原来那间", () => {
  const H = harness();
  H.move("cur", "cur1", "room_y");
  assert.equal(H.curs().find(c => c.id === "cur1").roomId, "room_y");
  assert.equal(H.sess().find(s => s.id === "st1").roomId, null, "上过的那节被改了戳——那是在别的门里发生的");
  H.move("cur", "cur1", "main");
  assert.equal(H.curs().find(c => c.id === "cur1").roomId, null, "拿回主聊天要回到没戳的样子（chat-rooms 把没戳的当主线）");
  H.move("paper", "st2", "room_y");
  assert.equal(H.sess().find(s => s.id === "st2").roomId, "room_y");
});

test("房记着从哪儿开的；只有带着预设从一起学来的那一次才戳", () => {
  const Rooms=require("../js/chat-rooms.js");
  for(const from of ["study","train"])assert.equal(Rooms.normalize({id:"test",from}).from,from);
  assert.equal(Rooms.normalize({id:"test",from:"unknown"}).from,"");
  assert.match(app, /openPresetRoomFor\(charId, "focused", "[^"]*", "study"\)/);
  assert.match(app, /const draft = chatRoomsPreset && roomFromRef\.current && draft0 && draft0\.room/);
});

test("横幅：点课名进那门课，最右边换课；从横幅进去的，返回回到房里", () => {
  const i = comp.indexOf("roomStudy ? (function () {");
  assert.ok(i > 0, "那条横幅没了");
  const blk = comp.slice(i, i + 5000);
  assert.match(blk, /onOpenRoomStudy && onOpenRoomStudy\(cur\)/);
  assert.match(blk, /"换课 ›"/);
  assert.match(blk, /onMoveRoomStudy && onMoveRoomStudy\(c, true\)/);
  assert.match(blk, /onMoveRoomStudy && onMoveRoomStudy\(c, false\)/);
  assert.match(app, /mode: "course", kind: c\.kind, id: c\.id, back: "thread"/);
  assert.match(app, /setScreen\(back === "thread" \? "thread" : "home"\)/);
  assert.match(study, /if \(e\.mode === "course"\)/);
});

test("收进／拿出不是删东西：确认层不挂红印；从横幅进的课一下返回回到房里", () => {
  const i = comp.indexOf("roomStudy ? (function () {");
  const blk = comp.slice(i, i + 5000);
  assert.equal((blk.match(/null, \{ danger: false \}\)/g) || []).length, 2);
  assert.match(study, /function fromRoomAt\(id\)/);
  assert.match(study, /if \(fromRoomAt\(cur\.id\)\) return props\.onBack\(\);/);
});
