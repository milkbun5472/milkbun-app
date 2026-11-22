// 联机房间：角色也能自己用 ＋ 里的那些（投票、请示、红包、位置、语音、名片、话题卡、照片）。
//   字段名照群聊（pollNew / askNew / redpacket / voice / photo）和单聊（location）；单人开口和一起说共用 actsOf / actBits
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const src = read("js/netroom.js"), app = read("js/app.js");
function load() { const w = {}; new Function("window", "loadJSON", "saveJSON", src)(w, () => null, () => {}); return w.NetRoomCore; }
const C = load();

test("actsOf：每种都解得出，坏的丢掉", () => {
  const a = C.actsOf({ pollNew: { title: "吃啥", options: ["火锅", "烧烤", "火锅"], anon: true }, askNew: { what: "买个耳机", reason: "旧的坏了", amount: 300 },
    redpacket: { total: 88.888, count: 99, message: "请客" }, location: { name: "学校门口" }, topic: "最近在追什么剧", namecard: "沈屿白",
    photo: { kind: "view", scene: "窗外下雨" }, voice: ["你听我说"] }, {});
  const types = a.rich.map(r => r.type);
  assert.deepStrictEqual(types, ["poll", "poll", "geo", "topic"]);
  assert.deepStrictEqual(a.rich[0].x.options.map(o => o.text), ["火锅", "烧烤"]);
  assert.strictEqual(a.rich[0].x.anon, true);
  assert.deepStrictEqual(a.rich[1].x.ask, { what: "买个耳机", reason: "旧的坏了", amount: 300 });
  assert.deepStrictEqual(a.rich[1].x.options.map(o => o.text), ["准", "驳"]);
  assert.deepStrictEqual(a.rp, { total: 88.89, count: 50, message: "请客" });
  assert.deepStrictEqual(a.photo, { scene: "窗外下雨", kind: "view" });
  assert.strictEqual(a.card, "沈屿白");
  assert.deepStrictEqual(a.voice, ["你听我说"]);
  assert.strictEqual(a.any, true);
  // 旧版 selfie 字符串＝自拍；一个选项的投票、0 元红包、null 字符串都不算
  const b = C.actsOf({ selfie: "对镜子", pollNew: { title: "x", options: ["一"] }, redpacket: { total: 0 }, location: "null", topic: "null" }, {});
  assert.deepStrictEqual(b.photo, { scene: "对镜子", kind: "self" });
  assert.strictEqual(b.rich.length, 0); assert.strictEqual(b.rp, null);
  assert.strictEqual(C.actsOf({ text: "hi" }, {}).any, false);
  // 一起说：voice:true 整条用语音
  assert.strictEqual(C.actsOf({ voice: true }, { joint: true }).voice, true);
});

test("新的两种过白名单：话题卡只留一句；角色发的投票/请示/位置照旧过 cleanRich", () => {
  assert.deepStrictEqual(C.cleanRich("topic", { text: "  聊聊猫  ", evil: 1 }), { text: "聊聊猫" });
  assert.strictEqual(C.cleanRich("topic", { text: "" }), null);
  const a = C.actsOf({ pollNew: { title: "去哪", options: ["山", "海"] }, location: "家" }, {});
  a.rich.forEach(r => assert.ok(C.cleanRich(r.type, Object.assign({ pollId: "p1" }, r.x)), r.type));
  const w = C.wireMsg({ id: "m", kind: "char", name: "A", charId: "c1", type: "topic", x: { text: "冷场救星" } });
  assert.strictEqual(w.text, "[话题卡] 冷场救星");
});

test("红包只是玩法：角色发的走房里那套拆法，不碰钱包", () => {
  const i = src.indexOf("const actsInto = async"), j = src.indexOf("const shootFor = async", i);
  const body = src.slice(i, j);
  assert.ok(i > 0 && j > i);
  assert.match(body, /splitRedPacket/);
  assert.match(body, /grabForMine\(rpId, charId\)/);
  assert.doesNotMatch(body, /changeWallet|adjustCharBalance|kinCharge/);
  assert.match(C.richLine({ type: "rp", x: { message: "m", count: 2, claims: [] } }), /只是玩法不动钱包/);
});

test("自拍开关关了不发：只有 myChars 里 selfie 为真的才拍；默认照 selfieOk", () => {
  const i = src.indexOf("const actsInto = async"), j = src.indexOf("const shootFor = async", i);
  assert.match(src.slice(i, j), /if \(acts\.photo && me && me\.selfie\) later\.push/);
  assert.match(src, /selfie: selfieOn\(c\.id\)/);
  assert.match(src, /props\.selfieOk && props\.selfieOk\(id\)/);
  // 提示词：没开的人不给照片那一格
  assert.ok(!C.actBits({ photo: false }, false).some(b => b.indexOf("\"photo\"") === 0));
  assert.ok(C.actBits({ photo: true }, false).some(b => b.indexOf("\"photo\"") === 0));
  assert.ok(!C.actBits({ photo: [] }, true).some(b => b.indexOf("\"photo\"") === 0));
  // app 那边出图走单聊那套 shootCharPhoto
  assert.match(app, /drawPhoto: async \(charId, scene, kind\) =>/);
  assert.match(app, /const out = await shootCharPhoto\(\{ char, realChar, charId,/);
});

test("两条开口的路都带上这几样出口", () => {
  const room = { myNick: "我", peers: [], myChars: [{ id: "c1", name: "A" }], msgs: [] };
  const one = C.lineInstruction(room, { id: "c1", name: "A" }, { acts: { photo: true, cards: ["B"] } });
  ["pollNew", "askNew", "redpacket", "location", "voice", "namecard", "topic", "photo"].forEach(k => assert.ok(one.includes("\"" + k + "\""), "单人缺 " + k));
  const two = C.jointInstruction(room, [{ id: "c1", name: "A" }, { id: "c2", name: "B" }], { acts: { photo: ["A"] } });
  ["pollNew", "askNew", "redpacket", "location", "\"voice\":true", "namecard", "topic", "photo"].forEach(k => assert.ok(two.includes(k), "一起说缺 " + k));
  // jointLines 把这几样带回来：只发了个投票的那条也留着
  const got = C.jointLines(JSON.stringify([{ name: "A", text: "", pollNew: { title: "t", options: ["1", "2"] } }]), [{ id: "c1", name: "A" }], "我");
  assert.strictEqual(got.length, 1); assert.strictEqual(got[0].acts.rich[0].type, "poll");
});
