// 联机牌桌：真头像（不带人设）、停住时不出手、横幅上的第几轮（roundLabel）、昵称记住
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const gsrc = read("js/netroom-games.js"), csrc = read("js/netroom-cards.js"), ssrc = read("js/netroom-social.js"), dsrc = read("js/netroom-debate.js"), nsrc = read("js/netroom.js");

function load() {
  const w = { extractJSON: s => { try { return JSON.parse(s); } catch (e) { return null; } } };
  new Function("window", gsrc)(w);
  w.GameShared = { cards: {}, voiceRules: () => "" };
  new Function("window", csrc)(w);
  new Function("window", ssrc)(w);
  return w.NetGameCore;
}

test("停住时：heldInv 让每个座位都不归我出手，原 inv 不动", () => {
  const C = load();
  const inv = { host: "h", seats: [{ kind: "user", peer: "me", name: "她" }, { kind: "char", peer: "me", charId: "c", name: "TA" }] };
  assert.strictEqual(C.actorOf(inv.seats[0], "me", "h"), "mine-user");
  const held = C.heldInv(inv);
  assert.strictEqual(C.actorOf(held.seats[0], "me", "h"), "remote");
  assert.strictEqual(C.actorOf(held.seats[1], "me", "h"), "remote");
  assert.ok(!inv.seats[0].held, "原来那份不许被改");
  // 房间页停着时交给牌桌的是 heldInv；等的人看到的是那一句
  assert.match(nsrc, /inv: sv\.pause && !done && GC\(\)\.heldInv \? GC\(\)\.heldInv\(inv\) : inv/);
  assert.match(nsrc, /"这一轮停着，等 " \+ \(hostName \|\| "开局的人"\) \+ " 点「接着来」"/);
  // 同时交的那几盒（心有灵犀、狼人夜里）也认 held
  assert.match(csrc, /!view\.sent\[mySeat\] && !\(inv\.seats\[mySeat\] \|\| \{\}\)\.held/);
  assert.match(ssrc, /!\(inv\.seats\[mine\] \|\| \{\}\)\.held \? priv\.act : null/);
});

test("横幅第几轮：走 adapter 的 roundLabel，没有就不写", () => {
  const C = load();
  const rows = (key, view) => C.openTables([{ x: { gid: "g", key, zh: "x", host: "h", status: "playing", seats: [] }, view }], "me")[0].state;
  assert.strictEqual(rows("werewolf", { day: 2 }), "进行中 · 第 2 天");
  assert.strictEqual(rows("werewolf", { day: 0 }), "进行中 · 第一夜");
  assert.strictEqual(rows("avalon", { qn: 1 }), "进行中 · 第 2 个任务");
  assert.strictEqual(rows("spy", { round: 3 }), "进行中 · 第 3 轮");
  assert.strictEqual(rows("lingxi", { rounds: [1, 2], phase: "word" }), "进行中 · 第 3 轮");
  assert.strictEqual(rows("story", { players: [1, 2], lines: [1, 2, 3] }), "进行中 · 第 2 圈");
  assert.strictEqual(rows("tod", { round: 0 }), "进行中 · 第 1 轮");
  assert.strictEqual(rows("poker", { hand: 4 }), "进行中 · 第 4 手");
  assert.strictEqual(rows("mahjong", { handNo: 2 }), "进行中 · 第 2 盘");
  assert.strictEqual(rows("monopoly", { players: [{}, {}], moves: 5 }), "进行中 · 第 3 回合");
  assert.strictEqual(rows("gomoku", { moves: [], round: 7 }), "进行中", "没有 roundLabel 的不再拿 view.round 硬凑");
  assert.match(dsrc, /A\.roundLabel = v =>/);
});

test("牌桌头像：名片里只有名字和小头像，真人在 hi 里带自己的小头像，旧版对端不带也不崩", () => {
  const w = { loadJSON: () => [], saveJSON: () => {} };
  new Function("window", nsrc.replace(/if \(typeof window !== "undefined"\) window\.NetRoomApp = NetRoomApp;/, ""))(w);
  const C = w.NetRoomCore || w.NetRoom || Object.values(w).find(v => v && v.upsertPeer);
  assert.ok(C && C.upsertPeer, "找不到 upsertPeer");
  const r0 = { id: "r", peers: [], msgs: [] };
  const r1 = C.upsertPeer(r0, "p1", "小雨", [], { id: "me", name: "小雨", avatar: "data:image/jpeg;base64,AAA", persona: "不许带" });
  assert.deepStrictEqual(Object.keys(r1.peers[0].face).sort(), ["avatar", "color", "emoji", "id", "name"]);
  const r2 = C.upsertPeer(r1, "p1", "小雨", []);   // 旧版对端：hi 里没有 me
  assert.strictEqual(r2.peers[0].face.avatar, "data:image/jpeg;base64,AAA");
  const r3 = C.upsertPeer(r0, "p2", "阿青", []);
  assert.ok(!r3.peers[0].face);
  // 牌桌那头：NPC 不给头像（照单机写首字），其余按 faceOf 取，只取头像那几样
  assert.match(gsrc, /if \(!s \|\| s\.kind === "npc" \|\| s\.kind === "open"\) return null;/);
  assert.match(nsrc, /root\.NetGameUI\.setFaces\(faceOf\)/);
  assert.match(ssrc, /h\(root\.GameShared\.cards\.Seats, \{/);
  const fo = nsrc.slice(nsrc.indexOf("const faceOf = s =>"), nsrc.indexOf("root.NetGameUI.setFaces(faceOf)"));
  assert.ok(fo.length > 50 && fo.indexOf("persona") < 0, "牌桌头像不带人设");
});

test("昵称：重进房间用她上一次填的，不退回「朋友」", () => {
  const w = { loadJSON: () => [], saveJSON: () => {} };
  new Function("window", nsrc)(w);
  const C = Object.values(w).find(v => v && v.lastNick);
  assert.strictEqual(C.lastNick([{ myNick: "朋友", startedAt: 9 }, { myNick: "小鱼", startedAt: 5 }, { myNick: "旧的", startedAt: 1 }]), "小鱼");
  assert.strictEqual(C.lastNick([]), "");
  assert.match(nsrc, /useState\(\(\) => Core\.lastNick\(Core\.loadRooms\(\)\) \|\|/);
});
