// 联机「上次聊到哪」前情卡：什么时候出、缓存不重复调用、只用房间记录、进开口提示词
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const src = read("js/netroom.js");
// 存档桩照写入方 saveRooms（saveJSON(STORE_KEY, …)）
function load() {
  const store = {};
  const w = { loadJSON: (k, d) => (k in store ? JSON.parse(store[k]) : d), saveJSON: (k, v) => { store[k] = JSON.stringify(v); } };
  new Function("window", "loadJSON", "saveJSON", src)(w, w.loadJSON, w.saveJSON);
  return { C: w.NetRoomCore, store };
}
const H = 3600 * 1000;
const room = (n, t0, extra) => Object.assign({ id: "nr_1", code: "123456", myNick: "小美", myPeerId: "me", endedAt: 0,
  peers: [{ peerId: "p1", nick: "阿青", chars: [{ id: "c9", name: "白鹭" }] }], myChars: [{ id: "a", name: "甲" }],
  msgs: Array.from({ length: n }, (_, i) => ({ id: "m" + i, side: i % 2 ? "peer" : "me", peerId: i % 2 ? "p1" : undefined, text: "第" + i + "句", ts: t0 + i * 1000 })) }, extra || {});

test("触发：话够 6 句，且上次离开过或隔了 6 小时以上", () => {
  const { C } = load(); const now = Date.now();
  assert.strictEqual(C.recapDue(room(10, now - 7 * H), now), true);
  assert.strictEqual(C.recapDue(room(10, now - 1 * H), now), false);
  assert.strictEqual(C.recapDue(room(10, now - 1 * H, { endedAt: now - H }), now), true);
  assert.strictEqual(C.recapDue(room(3, now - 9 * H), now), false, "话太少不出");
});

test("缓存：总结到最后一条就直接用，有新话才再写；UI 那头只在不新鲜时调用", () => {
  const { C } = load(); const r = room(10, 1000);
  assert.strictEqual(C.recapFresh(r), false);
  const rc = C.cleanRecap({ talk: "聊了天气", said: ["阿青说明天见"], plans: [], game: "" }, C.lastTalkTs(r), 5);
  assert.strictEqual(C.recapFresh(Object.assign({}, r, { recap: rc })), true);
  const more = Object.assign({}, r, { recap: rc, msgs: r.msgs.concat([{ id: "x", side: "me", text: "又来了", ts: 999999 }]) });
  assert.strictEqual(C.recapFresh(more), false);
  const body = src.slice(src.indexOf("const rejoin = r0 =>"), src.indexOf("const start = (host, resume)"));
  assert.match(body, /due && !Core\.recapFresh\(r1\)\) makeRecap/);
});

test("只用房间记录：提示词里是 transcript，不碰人设；makeRecap 不走 ctxFor", () => {
  const { C } = load(); const r = room(8, 1000);
  const sys = C.recapInstruction(r);
  assert.ok(sys.indexOf(C.transcript(r)) >= 0);
  const mk = src.slice(src.indexOf("const makeRecap = async"), src.indexOf("const rejoin = r0 =>"));
  assert.ok(!/ctxFor|persona|castFor|runProbe/.test(mk), "前情只读房间记录");
  assert.match(mk, /props\.recapApi/);
  assert.match(mk, /maxTokens: 12000/);
});

test("进提示词：前情放在记录前面；记录很长时只带前情没盖到的、至少最近 60 条", () => {
  const { C } = load(); const r = room(200, 1000);
  const rc = C.cleanRecap({ talk: "聊了很久的猫" }, r.msgs[150].ts, 1);
  const rr = Object.assign({}, r, { recap: rc });
  const s = C.lineInstruction(rr, { id: "a", name: "甲" }, {});
  assert.ok(s.indexOf("聊了很久的猫") > 0 && s.indexOf("聊了很久的猫") < s.indexOf("第199句"));
  assert.ok(s.indexOf("第151句") > 0 && s.indexOf("第20句") < 0, "前情盖住的旧话不再整份带");
  const short = C.lineInstruction(Object.assign({}, room(30, 1000), { recap: rc }), { id: "a", name: "甲" }, {});
  assert.ok(short.indexOf("第0句") > 0, "不长就整份带");
  const j = C.jointInstruction(rr, [{ id: "a", name: "甲" }], {});
  assert.ok(j.indexOf("聊了很久的猫") > 0 && j.indexOf("第20句") < 0);
});
