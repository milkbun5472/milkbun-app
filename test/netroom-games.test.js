// 联机房间第三期：一起玩小游戏（设计单第七节）。邀请卡白名单、报名座位、NPC 补位、只发给一个人的那条、
//   角色座位由主人那台出手、五子棋胜负走小游戏那份规则、战绩卡那一行、旧版对端不认识也不崩
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const gsrc = read("js/netroom-games.js"), nsrc = read("js/netroom.js"), games = read("js/games.js");

// 五子棋规则：照 games.js 里那一段原样切出来（跟 test/gomoku.test.js 同一刀）
const gi = games.indexOf("  const GMK_N = 15;"), gj = games.indexOf("  function GomokuBoard(props) {");
const GMK = new Function(games.slice(gi, gj) + "\nreturn { N: GMK_N, empty: gmkEmpty, place: gmkPlace, replay: gmkReplay, wins: gmkWins, bestMove: gmkBestMove, threat: gmkThreat, coord: gmkCoord };")();

// 存档桩：照写入方 saveJSON(STORE_KEY, …)（netroom.js 的 saveRooms）
function load(opts) {
  const store = {};
  const w = { loadJSON: (k, d) => (k in store ? JSON.parse(store[k]) : d), saveJSON: (k, v) => { store[k] = JSON.stringify(v); } };
  if (!(opts && opts.old)) { new Function("window", gsrc)(w); w.GameShared = { gomoku: GMK, guess: (opts && opts.guess) || null }; }
  new Function("window", "loadJSON", "saveJSON", nsrc)(w, w.loadJSON, w.saveJSON);
  return { C: w.NetRoomCore, G: w.NetGameCore, w };
}
const GOMOKU = { key: "gomoku", zh: "五子棋", min: 2, max: 2 };
const SOUP = { key: "haigui", zh: "海龟汤", min: 2, max: 8 };

test("邀请卡、战绩卡走 cleanRich 白名单：多塞的字段一个不收", () => {
  const { C } = load();
  const dirty = { gid: "g1", key: "gomoku", zh: "五子棋", min: 2, max: 2, host: "A", status: "playing", mode: "hack", npcFill: true, persona: "人设全文", truth: "汤底",
    seats: [{ kind: "char", peer: "A", charId: "c1", name: "小克", persona: "不该出门", memory: "x" }, { kind: "god", name: "坏人" }, { kind: "user", peer: "B", name: "乙" }] };
  const x = C.cleanRich("game", dirty);
  assert.deepStrictEqual(Object.keys(x).sort(), ["gid", "host", "key", "max", "min", "mode", "npcFill", "seats", "status", "zh"]);
  assert.strictEqual(x.mode, "normal");
  assert.strictEqual(x.seats.length, 2, "座位不许多过 max");
  assert.deepStrictEqual(x.seats[0], { kind: "char", name: "小克", peer: "A", charId: "c1" });
  assert.deepStrictEqual(x.seats[1], { kind: "open" }, "认不得的座位当空位");
  const rec = C.cleanRich("gamerec", { gid: "g1", key: "gomoku", zh: "五子棋", text: "甲赢了", winners: [0, 99], seats: [{ name: "甲", kind: "user", peer: "A" }],
    replay: { moves: [[7, 7, 1], [7, 8, 2], "bad"], secret: "x" } });
  assert.deepStrictEqual(rec.replay, { moves: [[7, 7, 1], [7, 8, 2]] });
  assert.deepStrictEqual(rec.winners, [0]);
  assert.ok(!("peer" in rec.seats[0]));
  const unk = C.cleanRich("gamerec", { key: "nope", zh: "?", replay: { a: 1 } });
  assert.ok(!("replay" in unk), "没登记的游戏不收回看");
  assert.ok(C.RICH_TYPES.indexOf("game") >= 0 && C.RICH_TYPES.indexOf("gamerec") >= 0);
});

test("海龟汤：汤底不进公开那一份，揭晓了才给", () => {
  const { G } = load();
  const A = G.ADAPTERS.haigui;
  const st = { surface: "汤面", truth: "真相", log: [], turn: 0, done: false, solvedBy: -1, reveal: "", busy: false };
  assert.ok(!JSON.stringify(A.view(st)).includes("真相"));
  assert.ok(!JSON.stringify(A.cleanView(Object.assign({}, A.view(st), { truth: "" }))).includes("真相"));
  assert.ok(JSON.stringify(A.view(Object.assign({}, st, { done: true }))).includes("真相"));
});

test("报名：房主先坐，别人坐空位；换人先腾旧位；同一个角色只占一个；坐满了的退回", () => {
  const { G } = load();
  let inv = G.newInvite({ gid: "g", game: SOUP, cfg: { total: 3, mode: "normal", npcFill: true }, host: "A", nick: "甲", picks: [{ kind: "user" }] });
  assert.strictEqual(inv.seats.length, 3);
  assert.deepStrictEqual(inv.seats.map(s => s.kind), ["user", "open", "open"]);
  let r = G.joinSeats(inv, "B", "乙", [{ kind: "user" }, { kind: "char", charId: "b1", name: "阿B" }, { kind: "char", charId: "b1", name: "阿B" }]);
  inv = r.inv;
  assert.deepStrictEqual(inv.seats.map(s => s.name), ["甲", "乙", "阿B"]);
  assert.strictEqual(r.dropped.length, 0, "重复的角色不算没坐上");
  r = G.joinSeats(Object.assign({}, inv, { max: 3 }), "C", "丙", [{ kind: "user" }]);
  assert.strictEqual(r.dropped.length, 1, "到上限坐满了要退回");
  inv = G.joinSeats(inv, "B", "乙", [{ kind: "char", charId: "b1", name: "阿B" }]).inv;
  assert.deepStrictEqual(inv.seats.map(s => s.kind), ["user", "char", "open"], "换人先把原来的位子腾出来");
  inv = G.leaveSeats(inv, "B");
  assert.strictEqual(G.takenCount(inv), 1);
  assert.strictEqual(G.addSeat(Object.assign({}, inv, { max: 3 })).seats.length, 3, "到上限不再加座位");
});

test("NPC 补位：照开局「NPC 凑数」——开着就补，关着就收掉空位、人够才能开", () => {
  const { G } = load();
  const inv = G.newInvite({ gid: "g", game: GOMOKU, cfg: { total: 2, npcFill: true }, host: "A", nick: "甲", picks: [{ kind: "user" }] });
  assert.ok(G.canStart(inv));
  const f = G.fillNpc(inv);
  assert.deepStrictEqual(f.seats.map(s => s.kind + ":" + s.name), ["user:甲", "npc:电脑"], "五子棋那位 NPC 就是单机里的「电脑」");
  const off = Object.assign({}, inv, { npcFill: false });
  assert.ok(!G.canStart(off), "人不够两个不能开");
  assert.strictEqual(G.fillNpc(off).seats.length, 1);
  const soup = G.fillNpc(G.newInvite({ gid: "s", game: SOUP, cfg: { total: 4, npcFill: true }, host: "A", nick: "甲", picks: [{ kind: "user" }] }));
  assert.deepStrictEqual(soup.seats.filter(s => s.kind === "npc").map(s => s.name), ["路人甲", "路人乙", "路人丙"]);
});

test("只发给一个人的那条：直连着只给 TA；连不上就只交给一个能转的人；netroom 收到不是给自己的不看也不广播", () => {
  const { G } = load();
  assert.deepStrictEqual(G.privateRoute(["B", "C", "D"], "C", {}), ["C"]);
  assert.deepStrictEqual(G.privateRoute(["B", "D"], "C", { B: ["A"], D: ["A", "C"] }), ["D"]);
  assert.deepStrictEqual(G.privateRoute(["B"], "C", { B: [] }), []);
  assert.deepStrictEqual(G.privateRoute(["C"], "C", {}, "C"), [], "不往回递");
  // netroom 那头：send 给了 to 就走 routeTo，不走 openIds 全发；收到别人的私信只往目标递一下就返回
  assert.match(nsrc, /const ids = to \? routeTo\(to, null\) : m\.openIds\(\);/);
  assert.match(nsrc, /if \(to !== meId\.current\) \{ if \(m\) routeTo\(to, fromId\)\.forEach\(id => m\.sendTo\(id, raw\)\); return; \}/);
});

// 一张假的桌子：几台手机的 Session 用一根假线连起来，to 的只送到那一台
function bus(ids, presence, mk) {
  const S = {}, log = [];
  const deliver = (from, obj, to) => {
    log.push({ from, obj, to });
    const targets = to ? [to] : ids.filter(x => x !== from);
    targets.forEach(id => setTimeout(() => S[id] && S[id].onMessage(JSON.parse(JSON.stringify(obj)), from), 0));
  };
  ids.forEach(id => { S[id] = mk(id, (obj, to) => deliver(id, obj, to)); });
  return { S, log };
}
const tick = () => new Promise(ok => setTimeout(ok, 5));
async function until(fn, n) { for (let i = 0; i < (n || 2000); i++) { if (fn()) return true; await tick(); } return false; }

test("私密那份：庄只发给座位主人那一台，不进广播", async () => {
  const { G, w } = load();
  G.ADAPTERS.secret = { seatRange: () => ({ min: 2, max: 2 }), init: () => ({ word: ["苹果", "梨"], turn: -1 }), view: () => ({ open: 1 }), cleanView: v => v,
    priv: (st, i) => ({ word: st.word[i] }), turn: () => -1, result: () => null };
  const { S, log } = bus(["A", "B"], null, (id, send) => w.NetGameSession({ me: () => id, nick: () => id, nickOf: x => x, send, fast: true,
    post: () => {}, patchCard: () => {}, charOf: () => null, apiFor: () => null, presence: () => ({ A: "on", B: "on" }) }));
  const gid = S.A.invite({ key: "secret", zh: "秘", min: 2, max: 2 }, { total: 2 }, [{ kind: "user" }]);
  S.B.join(gid, [{ kind: "user" }], "A");
  await until(() => G.takenCount(S.A.seen(gid) ? S.A.seen(gid).inv : { seats: [] }) === 2 || log.some(l => l.obj.op === "card" && l.obj.x.seats[1].kind === "user"));
  assert.ok(await S.A.start(gid));
  await until(() => S.B.seen(gid) && S.B.seen(gid).priv);
  const priv = log.filter(l => l.obj.op === "priv");
  assert.strictEqual(priv.length, 1);
  assert.strictEqual(priv[0].to, "B", "私密那份只给 B");
  assert.deepStrictEqual(S.B.seen(gid).priv, { word: "梨" });
  assert.ok(!log.filter(l => !l.to).some(l => JSON.stringify(l.obj).includes("梨")), "广播里不许出现 B 的词");
  assert.strictEqual(S.A.seen(gid).priv.word, "苹果", "庄自己那份不用发");
  delete G.ADAPTERS.secret;
});

test("角色座位由带 TA 来的那台出手、用 TA 自己的线路；NPC 由庄下；五子棋下到分出胜负，战绩卡回到房里", async () => {
  const { G, w } = load();
  const posts = [], apiAsked = [];
  const mk = (id, send) => w.NetGameSession({ me: () => id, nick: () => id === "A" ? "甲" : "乙", nickOf: x => x === "A" ? "甲" : "乙", send, fast: true,
    post: (type, x) => posts.push({ by: id, type, x }), patchCard: () => {},
    charOf: cid => cid === "b1" && id === "B" ? { id: "b1", name: "阿B", persona: "（只在 B 手机上）" } : null,
    apiFor: cid => { apiAsked.push(id + ":" + cid); return { id: "api" }; },
    presence: () => ({ A: "on", B: "on" }) });
  const { S, log } = bus(["A", "B"], null, mk);
  const gid = S.A.invite(GOMOKU, { total: 2, npcFill: true }, []);        // 房主观战，不坐
  S.B.join(gid, [{ kind: "char", charId: "b1", name: "阿B" }], "A");
  await until(() => log.some(l => l.obj.op === "card"));
  assert.ok(await S.A.start(gid));
  assert.ok(await until(() => posts.some(p => p.type === "gamerec"), 4000), "没下完");
  const inv = S.A.seen(gid).inv;
  assert.deepStrictEqual(inv.seats.map(s => s.kind), ["char", "npc"]);
  const moves = log.filter(l => l.obj.op === "move");
  assert.ok(moves.length > 0 && moves.every(l => l.from === "B" && l.to === "A" && l.obj.seat === 0), "角色那一手只能由 B 那台发给庄");
  assert.ok(apiAsked.every(x => x === "B:b1"), "用的是 B 手机上那个角色自己的线路");
  assert.strictEqual(posts[0].type, "game", "先是那张邀请卡");
  const rec = posts.find(p => p.type === "gamerec");
  assert.strictEqual(rec.by, "A"); assert.strictEqual(rec.type, "gamerec");
  assert.match(rec.x.text, /阿B（黑）对 电脑（白），\d+ 手，/);
  assert.strictEqual(S.A.seen(gid).inv.status, "done");
  // 终局那份 view 跟战绩卡是两条消息，B 那边可能晚一拍才到：等它到，不是一拍都不让
  assert.ok(await until(() => S.B.seen(gid) && S.B.seen(gid).view.winner > 0), "B 那边也看到终局了");
});

test("庄只认座位真正的主人：别人冒名下一手不算", async () => {
  const { G, w } = load();
  const { S, log } = bus(["A", "B", "C"], null, (id, send) => w.NetGameSession({ me: () => id, nick: () => id, nickOf: x => x, send, fast: true,
    post: () => {}, patchCard: () => {}, charOf: () => null, apiFor: () => null, presence: () => ({ A: "on", B: "on", C: "on" }) }));
  const gid = S.A.invite(GOMOKU, { total: 2 }, [{ kind: "user" }]);
  S.B.join(gid, [{ kind: "user" }], "A");
  await until(() => log.some(l => l.obj.op === "card"));
  await S.A.start(gid);
  S.A.move(gid, 0, { x: 7, y: 7 });
  await until(() => S.C.seen(gid) && S.C.seen(gid).view.moves.length === 1);
  S.C.onMessage({ op: "move", gid, seat: 1, move: { x: 8, y: 8 } }, "C");
  S.A.onMessage({ op: "move", gid, seat: 1, move: { x: 8, y: 8 } }, "C");
  await tick();
  assert.strictEqual(S.A.seen(gid).view.moves.length, 1, "C 不是白方，不许替 B 下");
  S.B.move(gid, 1, { x: 8, y: 8 });
  assert.ok(await until(() => S.A.seen(gid).view.moves.length === 2));
});

test("掉线：轮到的人不在房里 20 秒就转 NPC 托管，回来就交还", () => {
  const { G } = load();
  const inv = { host: "A", seats: [{ kind: "user", peer: "A", name: "甲" }, { kind: "user", peer: "B", name: "乙" }] };
  assert.strictEqual(G.awayPlan(inv, 1, { B: "on" }, 0, 100), null);
  assert.strictEqual(G.awayPlan(inv, 1, { B: "off" }, 1000, 5000), "wait");
  assert.strictEqual(G.awayPlan(inv, 1, { B: "fail" }, 1000, 1000 + G.AWAY_MS), "away");
  const away = G.setAway(inv, "B", true);
  assert.strictEqual(G.actorOf(away.seats[1], "A", "A"), "host-npc", "托管的那一手归庄");
  assert.strictEqual(G.actorOf(away.seats[1], "B", "A"), "remote");
  assert.strictEqual(G.awayPlan(away, 1, { B: "relay" }, 0, 0), "back");
  assert.ok(!G.setAway(away, "B", false).seats[1].away);
  assert.strictEqual(G.awayPlan(inv, 0, {}, 0, 1e9), null, "庄自己的座位不托管");
  assert.strictEqual(G.actorOf({ kind: "char", peer: "B", charId: "b1" }, "B", "A"), "mine-char");
  assert.strictEqual(G.actorOf({ kind: "npc", name: "电脑" }, "B", "A"), "remote");
});

test("五子棋胜负：联机那张桌跟单机那一桌走同一个 gmkPlace", () => {
  const { G } = load();
  const A = G.ADAPTERS.gomoku;
  let st = A.init();
  const seq = [[3, 7], [3, 8], [4, 7], [4, 8], [5, 7], [5, 8], [6, 7], [6, 8]];
  seq.forEach((p, i) => { const r = A.apply(st, i % 2, { x: p[0], y: p[1] }); assert.ok(r.st, r.err); st = r.st; });
  assert.ok(A.apply(st, 1, { x: 7, y: 7 }).err, "没轮到白");
  assert.ok(A.apply(st, 0, { x: 3, y: 7 }).err, "有子的格落不下");
  st = A.apply(st, 0, { x: 7, y: 7 }).st;
  assert.strictEqual(st.winner, 1);
  assert.strictEqual(A.turn(st), -1);
  assert.ok(A.apply(st, 1, { x: 9, y: 9 }).err);
  assert.match(A.result(st, { seats: [{ name: "甲" }, { name: "乙" }] }).text, /甲（黑）对 乙（白），9 手，甲（黑）赢了。/);
  // 两头都钉在同一个函数上：单机 place 和联机 apply 都过 gmkPlace
  const gm = games.slice(games.indexOf("  function GomokuGame(props) {"), games.indexOf("  function useBoardTalk("));
  assert.match(gm, /const r = gmkPlace\(board, moves, x, y, who, winner\);/);
  assert.match(gsrc, /const r = G\.place\(G\.replay\(st\.moves\), st\.moves,/);
  assert.match(games, /gomoku: \{ N: GMK_N, empty: gmkEmpty, place: gmkPlace,/);
});

test("战绩卡、邀请卡在房间记录（transcript）里各是一行能读的字", () => {
  const { C } = load();
  const room = { myNick: "甲", peers: [{ peerId: "B", nick: "乙", chars: [] }], msgs: [
    C.wireMsg({ id: "1", kind: "user", name: "甲", type: "game", x: { gid: "g", key: "gomoku", zh: "五子棋", min: 2, max: 2, host: "A", status: "open", seats: [{ kind: "user", peer: "A", name: "甲" }, { kind: "open" }] }, ts: 1 }, true),
    C.wireMsg({ id: "2", kind: "user", name: "甲", type: "gamerec", x: { gid: "g", key: "gomoku", zh: "五子棋", text: "甲（黑）对 乙（白），9 手，甲（黑）赢了。", winners: [0], seats: [{ name: "甲", kind: "user" }, { name: "乙", kind: "user" }] }, ts: 2 }, true)
  ].map(m => Object.assign(m, { side: "me" })) };
  const tx = C.transcript(room);
  assert.match(tx, /甲：\[小游戏邀请\] 五子棋 · 2 个座位，空 1 个：甲/);
  assert.match(tx, /甲：\[小游戏战绩\] 五子棋：甲（黑）对 乙（白），9 手，甲（黑）赢了。/);
});

test("旧版对端：不认识的卡退成那一行字，不认识的 {t:\"game\"} 不理、不崩", () => {
  const neu = load().C, old = load({ old: true }).C;
  const w = neu.wireMsg({ id: "1", kind: "user", name: "甲", type: "game", x: { gid: "g", key: "gomoku", zh: "五子棋", min: 2, max: 2, host: "A", seats: [{ kind: "open" }, { kind: "open" }] }, ts: 1 });
  assert.ok(w.text.startsWith("[小游戏邀请]"), "发出去的那条自带一行字");
  const got = old.wireMsg(w, true);            // 没装 netroom-games 的那一台
  assert.ok(!got.type && !got.x, "认不得就不当卡");
  assert.strictEqual(got.text, w.text, "退成那一行字照样看得到");
  assert.match(nsrc, /\/\/ 别的 t（以后的新版本发来的）：不认得就不理/);
  const { G, w: win } = load();
  const s = win.NetGameSession({ me: () => "A", nick: () => "甲", nickOf: x => x, send: () => {}, post: () => {}, patchCard: () => {}, charOf: () => null, apiFor: () => null });
  assert.doesNotThrow(() => { s.onMessage({ op: "以后的新玩法", gid: "g" }, "B"); s.onMessage({ op: "state", gid: "g", inv: { key: "没见过", host: "B" } }, "B"); s.onMessage({}, "B"); });
  assert.ok(G);
});

test("接线：＋ 面板有「小游戏」、大厅只摆接得住的那几盒、新文件进延后组且排在 netroom.js 前面", () => {
  const idx = read("index.html");
  const a = idx.indexOf('data-src="js/netroom-games.js'), b = idx.indexOf('data-src="js/netroom.js');
  assert.ok(a > 0 && b > a, "netroom-games.js 要在 netroom.js 前面加载");
  assert.match(idx, /data-lazy="netroom" data-src="js\/netroom-games\.js/);
  assert.match(nsrc, /\["game", "小游戏", "dice"\]/);
  assert.match(nsrc, /only: root\.NetGameCore\.supported\(\), onConfigured/);
  assert.match(games, /if \(props\.onConfigured\) \{ props\.onConfigured\(game, config\); return; \}/);
  // 公共版要把联机整个摘掉：小游戏里抽出来的公共那份不许带联机字样
  assert.ok(!/联机|netroom|NetRoom/.test(games), "games.js 里不许出现联机字样");
  assert.match(read("js/app.js"), /gameApi: \(\) => gameActive,/);
});

test("加入：卡上空位不够时先加座位（到上限为止）；坐不下、庄那台忘了这一局，都回一句话，不让人以为点了没反应", async () => {
  const { G, w } = load();
  let inv = G.newInvite({ gid: "g", game: SOUP, cfg: { total: 2, npcFill: true }, host: "A", nick: "甲", picks: [{ kind: "user" }, { kind: "char", charId: "a1", name: "阿A" }] });
  assert.strictEqual(inv.seats.filter(s => s.kind === "open").length, 0, "房主自己就把两个位子坐满了");
  const r = G.joinSeats(inv, "B", "乙", [{ kind: "user" }, { kind: "char", charId: "b1", name: "阿B" }]);
  assert.deepStrictEqual(r.inv.seats.map(s => s.name), ["甲", "阿A", "乙", "阿B"], "海龟汤上限 8 个：坐不下就加座位");
  assert.strictEqual(r.dropped.length, 0);
  const g2 = G.newInvite({ gid: "g2", game: GOMOKU, cfg: { total: 2 }, host: "A", nick: "甲", picks: [{ kind: "user" }, { kind: "char", charId: "a1", name: "阿A" }] });
  assert.strictEqual(G.joinSeats(g2, "B", "乙", [{ kind: "user" }]).dropped.length, 1, "五子棋到上限 2 个就不加了");
  // 两台真走一遍：B 点加入 → 庄改卡 → B 那边的卡上显示坐上了 → 能开局；满了的那台收到一句话
  const toasts = [];
  const { S, log } = bus(["A", "B"], null, (id, send) => w.NetGameSession({ me: () => id, nick: () => id, nickOf: x => x, send, fast: true,
    post: () => {}, patchCard: () => {}, charOf: () => null, apiFor: () => null, toast: s => toasts.push(id + ":" + s), presence: () => ({ A: "on", B: "on" }) }));
  const gid = S.A.invite(GOMOKU, { total: 2 }, [{ kind: "user" }]);
  S.B.join(gid, [{ kind: "user" }], "A");
  assert.ok(await until(() => log.some(l => l.from === "A" && l.obj.op === "card" && l.obj.x.seats[1].peer === "B")), "庄把 B 坐进卡里发出来了");
  assert.ok(await S.A.start(gid));
  S.B.join(gid, [{ kind: "user" }], "A");
  assert.ok(await until(() => toasts.some(x => x.startsWith("B:这一局已经开始"))), "开局了再点加入要说一声");
  S.B.join("没这局", [{ kind: "user" }], "A");
  assert.ok(await until(() => toasts.some(x => x.startsWith("B:开这一局的那台手机"))), "庄那台不记得这张卡要说一声");
});

test("牌桌页下面也摆着邀请卡：在那一页点「加入」也要弹出选人那张（原来只挂在聊天页，点了没反应）", () => {
  const a = nsrc.indexOf("const joinSheet = () =>"), gp = nsrc.indexOf('if (page === "game" && room)'), gr = nsrc.indexOf('if (page === "gamerec")', gp);
  assert.ok(a > 0 && gp > a && gr > gp, "抠不出 joinSheet / 牌桌页");
  assert.match(nsrc.slice(gp, gr), /joinSheet\(\)\);/, "牌桌页挂上选人那张");
  assert.ok((nsrc.match(/joinSheet\(\)\)/g) || []).length >= 2, "聊天页、牌桌页各挂一次");
});
