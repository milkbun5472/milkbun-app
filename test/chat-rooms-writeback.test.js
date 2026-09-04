const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const Rooms = require(path.join(root, "js/chat-rooms.js"));

// 她 2026-08-28 让查侧房和线下上下文那几处改动会不会撞车。两处真的会：
// ① 主房的【从其他房间带回的交接】拼进 system、每轮都发，而且不过 ChatContextWindow 的秤，
//    一条摘要 maxTokens 2400（中文两三千字），六条比整个历史窗口预算还大。
// ③ 认知开关和写回开关不联动：自定义房能配成「看不到心情/印象卡」+「能写回共同状态」，
//    于是一间看不见旧内容的房，每轮凭空重判心情、并把印象卡【整块重写】覆盖掉。

const room = (inner, shared, extra) => ({
  cognition: { innerLife: inner },
  writeback: Object.assign({ sharedState: shared }, extra || {})
});

test("看不见就不许改：认知关了内在状态，心情和印象卡一律不写回", () => {
  const blind = room(false, true);
  assert.equal(Rooms.canWrite(blind, "mood"), false);
  assert.equal(Rooms.canWrite(blind, "gaze"), false);
  // 动作/穿着这些不需要读旧值就能写，仍跟着总开关走
  assert.equal(Rooms.canWrite(blind, "state"), true);
});

test("看得见的时候照常写，总开关关掉则全不写", () => {
  assert.equal(Rooms.canWrite(room(true, true), "mood"), true);
  assert.equal(Rooms.canWrite(room(true, true), "gaze"), true);
  assert.equal(Rooms.canWrite(room(true, false), "mood"), false);
  assert.equal(Rooms.canWrite(room(true, false), "state"), false);
});

test("心情和印象卡各有一根自己的开关", () => {
  assert.equal(Rooms.canWrite(room(true, true, { stateMood: false }), "mood"), false);
  assert.equal(Rooms.canWrite(room(true, true, { stateMood: false }), "gaze"), true);
  assert.equal(Rooms.canWrite(room(true, true, { stateGaze: false }), "gaze"), false);
  assert.equal(Rooms.canWrite(room(true, true, { stateGaze: false }), "mood"), true);
  // 开关摆在 GROUPS.writeback 里，设置页那个 group() 会自动渲染出来
  const keys = Rooms.GROUPS.writeback.map(x => x[0]);
  assert.ok(keys.includes("stateMood") && keys.includes("stateGaze"));
});

test("没有房间概念（主线本身）一律照写，别把旧数据锁死", () => {
  assert.equal(Rooms.canWrite(null, "mood"), true);
  assert.equal(Rooms.canWrite(undefined, "gaze"), true);
  // 老存档没有这两个新字段：normalize 要给成开着，不能悄悄把已有房间的写回关掉
  const old = Rooms.normalize({ id: "room_x", writeback: { sharedState: true } }, "c1");
  assert.equal(old.writeback.stateMood, true);
  assert.equal(old.writeback.stateGaze, true);
});

test("两道闸都要在代码里，解析后一次、salvage 之后再一次", () => {
  assert.match(app, /if \(!window\.ChatRooms\.canWrite\(room, "mood"\)\) parsed\.mood = null;/);
  // v61.80 起这道闸同时封 impressionChecked：它不改内容，却照样往主线那张卡写
  // 「他又想了一遍」的时刻——只封 impression 是漏了半边。
  assert.match(app, /if \(!window\.ChatRooms\.canWrite\(room, "gaze"\)\) \{ parsed\.impression = null; parsed\.impressionChecked = null; \}/);
  assert.match(app, /const _roomCanWrite = kind =>/);
  assert.match(app, /if \(!_roomCanWrite\("mood"\)\) parsed\.mood = null;/, "salvage 会把 mood 再捞回来，之后要再封一次");
  assert.match(app, /if \(!_roomCanWrite\("gaze"\)\) \{ parsed\.impression = null; parsed\.impressionChecked = null; \}/);
  assert.match(app, /if \(_roomCanWrite\("gaze"\) && window\.Gaze && !_s\.engineerEyes\)/);
});

test("主房交接要有上限，而且是可调的", () => {
  const main = Rooms.normalize({ id: "main", main: true }, "c1");
  assert.equal(main.carryCount, 4);
  assert.equal(main.carryChars, 600);
  // 拉条范围要夹住，别让她拉出一个能把窗口撑爆的值
  assert.equal(Rooms.normalize({ id: "main", main: true, carryCount: 99 }, "c1").carryCount, 6);
  assert.equal(Rooms.normalize({ id: "main", main: true, carryChars: 99999 }, "c1").carryChars, 1500);
  assert.match(comp, /carryCount", "带回最近几条"/);
  assert.match(comp, /carryChars", "每条最多带多少字"/);
});

test("交接真的会被截断，不是只把数字存起来", () => {
  const personId = "c_cap_" + Date.now();
  const store = {};
  global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  for (let i = 0; i < 6; i++) Rooms.addSummary({ personId, roomId: "r" + i, roomName: "房" + i, frame: "", summary: "字".repeat(3000) });
  const main = Rooms.normalize({ id: "main", main: true, personId }, personId);
  const out = Rooms.prompt(main, []);
  assert.ok(out.length < 4000, "交接段还是能撑到几千字：" + out.length);
  assert.equal((out.match(/·「房/g) || []).length, 4, "默认只带最近四条");
  assert.ok(out.indexOf("…") > 0, "超长的那条没被截断");
});

test("设置页要说清楚为什么开了也不生效，别让她以为开关坏了", () => {
  assert.match(comp, /是关着的，所以这间房看不到旧的心情和印象卡/);
  assert.match(comp, /看不见就不许覆盖/);
});
