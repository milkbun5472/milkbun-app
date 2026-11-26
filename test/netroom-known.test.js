// 联机「在联机里认识的人」：只存名字印象次数时间、不存人设、按 peerId+角色 id 认人、进提示词、能删
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const src = read("js/netroom.js");
// 存档桩照写入方 saveKnown（saveJSON(KNOWN_KEY, …)）
function load() {
  const store = {};
  const w = { loadJSON: (k, d) => (k in store ? JSON.parse(store[k]) : d), saveJSON: (k, v) => { store[k] = JSON.stringify(v); } };
  new Function("window", "loadJSON", "saveJSON", src)(w, w.loadJSON, w.saveJSON);
  return { C: w.NetRoomCore, store };
}
const room = (id, name, extra) => Object.assign({ id, code: "1", myNick: "小美", myPeerId: "me",
  peers: [{ peerId: "p1", nick: "阿青", chars: [{ id: "c9", name, persona: "秘密人设" }] }], myChars: [{ id: "a", name: "甲" }],
  msgs: [{ id: "m1", side: "me", kind: "char", charId: "a", name: "甲", text: "你好", ts: 10 },
         { id: "m2", side: "peer", peerId: "p1", kind: "char", charId: "c9", name, text: "嗨", ts: 20, persona: "秘密人设" }] }, extra || {});

test("只存名字、谁带来的、印象、次数、时间；不存人设；存 x_ 键", () => {
  const { C, store } = load();
  C.saveKnown(C.meetPeople(C.loadKnown(), "a", room("r1", "白鹭"), [{ name: "白鹭", note: "白鹭说话很冲但讲义气" }], 20));
  assert.strictEqual(C.KNOWN_KEY, "x_netroomKnown");
  const k = JSON.parse(store.x_netroomKnown).a["p1/c9"];
  assert.deepStrictEqual(Object.keys(k).sort(), ["charId", "lastTs", "name", "note", "owner", "peerId", "rooms", "times"]);
  assert.strictEqual(k.times, 1); assert.strictEqual(k.owner, "阿青");
  assert.ok(!/秘密人设/.test(store.x_netroomKnown));
});

test("按 peerId+角色 id 认人：改了名字还是同一条；同一房间不重复算次数，新房间才加一", () => {
  const { C } = load();
  let K = C.meetPeople({}, "a", room("r1", "白鹭"), [{ name: "白鹭", note: "印象一" }], 20);
  K = C.meetPeople(K, "a", room("r1", "白鹭"), [], 30);
  assert.strictEqual(K.a["p1/c9"].times, 1);
  K = C.meetPeople(K, "a", room("r2", "鹭鹭"), [{ name: "鹭鹭", note: "印象二" }], 99);
  assert.strictEqual(Object.keys(K.a).length, 1);
  assert.strictEqual(K.a["p1/c9"].times, 2); assert.strictEqual(K.a["p1/c9"].name, "鹭鹭"); assert.strictEqual(K.a["p1/c9"].note, "印象二");
  // 同名但别人家（另一个 peerId）的是另一个人
  const other = room("r3", "鹭鹭", { peers: [{ peerId: "p2", nick: "小林", chars: [{ id: "c9", name: "鹭鹭" }] }] });
  other.msgs[1].peerId = "p2";
  K = C.meetPeople(K, "a", other, [], 100);
  assert.strictEqual(Object.keys(K.a).length, 2);
});

test("进提示词：房里有见过的人才写「你们见过」；开口两处都带", () => {
  const { C } = load();
  const K = C.meetPeople({}, "a", room("r1", "白鹭"), [{ name: "白鹭", note: "讲义气" }], Date.now());
  const line = C.knownLine(K, "a", room("r2", "白鹭"), Date.now());
  assert.match(line, /你们见过/); assert.match(line, /讲义气/); assert.match(line, /1 次/);
  assert.strictEqual(C.knownLine(K, "b", room("r2", "白鹭")), "");
  const s = C.lineInstruction(room("r2", "白鹭"), { id: "a", name: "甲" }, { known: line });
  assert.ok(s.indexOf("讲义气") > 0);
  assert.match(src, /known: Core\.knownLine\(Core\.loadKnown\(\), char\.id, cur/);
  assert.ok(C.jointInstruction(room("r2", "白鹭"), [{ id: "a", name: "甲" }], { known: line }).indexOf("讲义气") > 0);
  assert.match(src, /Core\.saveKnown\(Core\.meetPeople\(/);
});

test("能删一条", () => {
  const { C } = load();
  const K = C.meetPeople({}, "a", room("r1", "白鹭"), [], 1);
  assert.deepStrictEqual(Object.keys(C.forgetKnown(K, "a", "p1/c9").a), []);
});
