// 开局的人重进房间后，她开过、这台手机已经不记得的那几局：广播 gone，大家把卡标成「接不上了」，只认开局的人；失效卡不出加入键、横幅不列
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const gsrc = read("js/netroom-games.js"), nsrc = read("js/netroom.js");
const tick = () => new Promise(ok => setTimeout(ok, 3));
async function until(fn) { for (let i = 0; i < 2000; i++) { if (fn()) return true; await tick(); } return false; }

function load() { const w = {}; new Function("window", gsrc)(w); return w; }
// 房间那一份卡片：照 netroom.js 的 patchCard 写（只改「我发的」或「origin 发的」那张，x 可以是函数）
function room(me) {
  const msgs = [];
  return { msgs, patchCard: (gid, x, mine, origin) => msgs.forEach(m => { if (m.x.gid === gid && (mine ? m.side === "me" : m.side === "peer" && m.peerId === origin)) m.x = typeof x === "function" ? x(m.x) : x; }) };
}

test("gone：开局的人重进房间后广播作废；只认开局的人发的；join 不认得的局也回 gone", async () => {
  const w = load(), C = w.NetGameCore;
  const card = C.newInvite({ gid: "g1", game: { key: "gomoku", zh: "五子棋", min: 2, max: 2 }, cfg: { total: 2 }, host: "A", nick: "甲", picks: [{ kind: "user" }] });
  const RA = room("A"), RB = room("B");
  RA.msgs.push({ side: "me", x: card }); RB.msgs.push({ side: "peer", peerId: "A", x: card });
  const S = {}, sent = [];
  const deliver = (from, obj, to) => { sent.push({ from, obj, to }); ["A", "B", "C"].filter(id => id !== from && (!to || to === id)).forEach(id => setTimeout(() => S[id].onMessage(JSON.parse(JSON.stringify(obj)), from), 0)); };
  ["A", "B", "C"].forEach(id => { const R = id === "A" ? RA : id === "B" ? RB : room(id);
    S[id] = w.NetGameSession({ me: () => id, nick: () => id, nickOf: x => x, fast: true, send: (o, to) => deliver(id, o, to), post: () => {}, patchCard: R.patchCard, myCards: () => R.msgs.filter(m => m.side === "me").map(m => m.x), presence: () => ({}) }); });
  // 冒名：C 说这一局没了 → B 那张（A 发的）不动
  S.C.onMessage({ t: "game", op: "gone", gid: "g1" }, "C");
  assert.strictEqual(RB.msgs[0].x.status, "open");
  // A 重进房间（新 Session，内存里没有 g1）：有人进来时 resend → 广播 gone
  S.A.resend();
  assert.ok(await until(() => RB.msgs[0].x.status === "lost"));
  assert.strictEqual(RA.msgs[0].x.status, "lost", "开局的人自己那张也标上");
  assert.ok(sent.some(l => l.from === "A" && l.obj.op === "gone" && !l.to));
  // 失效的局：横幅不列；cleanInvite 认得 lost
  assert.deepStrictEqual(C.openTables([{ x: RB.msgs[0].x }], "B"), []);
  assert.strictEqual(C.cleanInvite(RB.msgs[0].x).status, "lost");
  // 有人点了一张旧卡的「加入」：开局的人那台不认得 → 也广播 gone
  sent.length = 0;
  S.A.onMessage({ t: "game", op: "join", gid: "g2", picks: [{ kind: "user" }] }, "B");
  assert.ok(sent.some(l => l.obj.op === "gone" && l.obj.gid === "g2" && !l.to));
});

test("失效卡：卡上不出加入／开始，写一句接不上了", () => {
  // 加入那排按钮只在 open 时出；lost 那句给别人和开局的人各一种说法
  assert.match(gsrc, /x\.status === "lost" \? h\("div", \{ "data-wk": "nrgamelost"/);
  assert.match(gsrc, /开这一局的人重新进过房间，这一局接不上了。/);
  assert.match(gsrc, /!lost && x\.status === "open" && h\("div", \{ className: "flex flex-wrap"/);
  assert.match(nsrc, /myCards: \(\) =>/);
  assert.match(nsrc, /old => typeof x === "function" \? x\(old\) : x/);
});
