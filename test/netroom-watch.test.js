// 联机·旁观（她 2026-11-22「留着按头像和一起说，但是角色不知道真人在场」）：
//   开着旁观＝角色开口的提示词里她不在场；别人那台照 watch 状态也当她不在；不自动开口；关掉恢复
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js/netroom.js"), "utf8");
function load() {
  const store = {};
  const w = { loadJSON: (k, d) => (k in store ? JSON.parse(store[k]) : d), saveJSON: (k, v) => { store[k] = JSON.stringify(v); } };
  new Function("window", "loadJSON", "saveJSON", src)(w, w.loadJSON, w.saveJSON);
  return w.NetRoomCore;
}
const C = load();
// 房间桩照写入方：start() 里 commit 的那份 + upsertPeer 的 peers 形状
const room = () => ({ id: "nr_1", code: "123456", myPeerId: "me", myNick: "小雨", peers: [{ peerId: "p", nick: "阿柚", chars: [{ id: "x", name: "乙" }] }],
  myChars: [{ id: "a", name: "甲" }, { id: "b", name: "丙" }], msgs: [{ id: "m1", kind: "user", name: "小雨", text: "早", ts: 1, side: "me" }], remembered: {}, watch: true });

test("自己旁观：单人开口的提示词不说她在场、不给面具名", () => {
  const s = C.lineInstruction(room(), { id: "a", name: "甲", you: "阿梨" }, { watch: true, presence: { p: "on" } });
  assert.ok(!/带你来的是/.test(s), "不许写带你来的是她");
  assert.ok(!s.includes("阿梨"), "面具名不出现");
  assert.ok(!/小雨 用自己的手机/.test(s));
  assert.match(s, /带你来的人此刻不在房里/);
  assert.match(s, /在场的真人有 1 个/);
  const off = C.lineInstruction(room(), { id: "a", name: "甲", you: "阿梨" }, { watch: false, presence: { p: "on" } });
  assert.match(off, /带你来的是 阿梨/, "关掉恢复");
});

test("自己旁观：一起说的提示词也不说她在场", () => {
  const s = C.jointInstruction(room(), [{ id: "a", name: "甲", you: "阿梨" }, { id: "b", name: "丙" }], { watch: true, presence: { p: "on" } });
  assert.ok(!/来的是 /.test(s) && !s.includes("阿梨") && !/小雨 用自己的手机/.test(s));
  assert.match(s, /带他们来的人此刻不在房里/);
  assert.match(C.jointInstruction(room(), [{ id: "a", name: "甲", you: "阿梨" }, { id: "b", name: "丙" }], { presence: { p: "on" } }), /带「甲」来的是 阿梨/);
});

test("别人旁观：presence=watch 时那一方只列她带来的人，说明本人不在；两边都旁观只剩角色", () => {
  const s = C.lineInstruction(room(), { id: "a", name: "甲" }, { watch: true, presence: { p: "watch" } });
  assert.match(s, /- 乙（是 阿柚 带来的，阿柚 本人此刻不在房里/);
  assert.ok(!/阿柚，TA 带来的是/.test(s));
  assert.match(s, /在场的真人有 0 个/);
  assert.strictEqual(C.humansHere(room(), { watch: false, presence: { p: "watch" } }), 1);
});

test("拍一拍的名单：旁观的真人不在里面", () => {
  assert.deepStrictEqual(C.watchTargets(room(), "小雨", { p: "watch" }, true), ["甲", "丙", "乙"]);
  assert.deepStrictEqual(C.watchTargets(room(), "小雨", { p: "on" }, false), ["阿柚", "甲", "丙", "乙", "小雨"]);
});

test("界面接线：presence 给旁观的人 watch、开口都带 watch、开口前一发言就关旁观、广播 watch", () => {
  assert.match(src, /peerWatchRef\.current\[p\.peerId\] \? "watch" : st/);
  assert.strictEqual((src.match(/watch: watchNow\(\)/g) || []).length, 2, "单人和一起说都带上");
  assert.match(src, /const sayHuman = text => \{ unwatch\(\);/);
  assert.match(src, /send\(\{ t: "watch", on: !!on \}\)/);
  assert.match(src, /e\.t === "watch"/);
});

test("旁观不自动开口：watch 那几处不碰 speak / callAI / runProbe", () => {
  const i = src.indexOf("const setWatch = on =>"), seg = src.slice(i, src.indexOf("const sayHuman", i));
  assert.ok(i > 0 && !/speak|callAI|runProbe|setTimeout|setInterval/.test(seg));
  const j = src.indexOf('e.t === "watch"'), h = src.slice(j, src.indexOf("} else if", j + 5));
  assert.ok(!/speak|callAI|runProbe/.test(h));
});
