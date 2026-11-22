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
  assert.match(nsrc, /only: root\.NetGameCore\.supported\(\), extra, onConfigured/);
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

test("她 11-22 改的：牌桌开着是整页，房间聊天是浮在上面的半窗（单聊半窗那份 HalfWinFrame）；牌桌收起成小条；两种样子都挂着选人那张", () => {
  assert.ok(nsrc.indexOf("const joinSheet = () =>") > 0);
  assert.match(nsrc, /if \(gp && gp\.full\) return shellOn\(gp\.bg,/, "牌桌展开＝整页");
  assert.match(nsrc, /h\(HalfWinFrame, \{ win: chatWin, setWin: setChatWin, forKey: "netchat"/, "聊天是半窗");
  assert.match(nsrc, /const pill = gameWin\.min \? h\(HalfWinFrame, \{ win: gameWin, setWin: setGameWin, forKey: "netgame"/, "收起后牌桌是小条");
  assert.match(nsrc, /joinSheet\(\), gp && gp\.pill\);/, "整页聊天挂着选人那张和牌桌小条");
  assert.match(nsrc, /const unread = chatWin\.min && GC\(\) \? GC\(\)\.winUnread\(gameWin, msgCount\(\)\)/, "聊天半窗收着时数新消息");
  assert.match(nsrc, /composerEl\(\)\]/, "整页聊天和半窗聊天同一份输入区");
  assert.match(read("js/components.js"), /function HalfWinFrame\(\{ win, setWin, pillLabel, pillHot, onClose, onBig, bigLabel, barNote, onBarNote, forKey, children \}\)/);
});

// ───────── 第一档剩下的几盒：规则都从小游戏那一份切出来（单机、联机同一个函数）─────────
const cut2 = (a, b) => { const i = games.indexOf(a), j = games.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return games.slice(i, j); };
const RULES = new Function("window", "Math0", [
  cut2("  function boardReplay(", "  const BOARD_TIER_LV"),
  cut2("  function boardOutcome(", "  function boardSkillCached("),
  cut2("  function goReplay(", "  function GoGame("),
  cut2("  const STORY_OPENERS", "  function storyLineAsk("),
  cut2("  const MONO_BOARD = [", "  function hydMonoPlayers(")
].join("\n") + "\nreturn { boardReplay, boardOutcome, goReplay, goResult, storyNewGame, storyAct, storyText, storyTotalTurns, storyIsLast, MONO_BOARD, monoRoll, monoLand, monoBuy, monoUpgrade, monoNpcDecision, monoAuctionPlan, monoSettleAuction, monoRanking, monoAdvance, monoNetWorth, monoRent, monoGridPos, monoTokenColor, monoMaxMoves };")({}, Math);
const CORES = { chess: require("../js/chess-core.js"), xiangqi: require("../js/xiangqi-core.js"), jungle: require("../js/jungle-core.js"), go: require("../js/go-core.js") };
function shared(extra) {
  const R = RULES;
  return Object.assign({ gomoku: GMK, guess: null,
    board: { chess: { C: CORES.chess, sides: ["w", "b"], sideZh: s => s === "w" ? "白" : "黑", record: m => ({ from: m.from, to: m.to, promo: m.promo }), pick: go => go.find(m => !m.promo || m.promo === "q") || go[0] },
      xiangqi: { C: CORES.xiangqi, sides: ["r", "b"], sideZh: s => s === "r" ? "红" : "黑" }, jungle: { C: CORES.jungle, sides: ["r", "b"], sideZh: s => s === "r" ? "红" : "蓝" } },
    boardReplay: R.boardReplay, boardOutcome: R.boardOutcome, boardSkillCached: () => null, BOARD_TIER_LV: { rookie: "easy", mid: "normal", pro: "hard" },
    go: { C: CORES.go, replay: R.goReplay, result: R.goResult },
    story: { newGame: R.storyNewGame, act: R.storyAct, text: R.storyText, writeLine: async () => ({ line: "她推开门，钥匙掉在地上。", say: "" }) },
    tod: { plan: () => ({ choice: "真心话" }), pickTarget: (ps, log, last) => ps.find(p => p.name !== last) || ps[0], pickAsker: (ps, tn) => ps.find(p => p.name !== tn), ask: async () => ({ prompt: "最近一次哭是为什么？" }), answer: async () => "上周看电影。" },
    mono: { BOARD: R.MONO_BOARD, roll: R.monoRoll, land: R.monoLand, buy: R.monoBuy, upgrade: R.monoUpgrade, decide: R.monoNpcDecision, auctionPlan: R.monoAuctionPlan, settleAuction: R.monoSettleAuction, ranking: R.monoRanking, advance: R.monoAdvance, netWorth: R.monoNetWorth, rent: R.monoRent, gridPos: R.monoGridPos, tokenColor: R.monoTokenColor, maxMoves: R.monoMaxMoves }
  }, extra || {});
}
function load2(extra) { const r = load(); r.w.GameShared = shared(extra); return r; }
const seats2 = (a, b) => ({ mode: "normal", seats: [{ kind: "user", peer: "A", name: a || "甲" }, { kind: "user", peer: "B", name: b || "乙" }] });

test("国际象棋：四步杀，终局走单机那份 boardOutcome；走不了的步、没轮到的那一边都退回", () => {
  const { G } = load2(), A = G.ADAPTERS.chess, inv = seats2();
  let st = A.init(inv);
  assert.ok(A.apply(st, 1, { from: [1, 4], to: [3, 4] }).err, "白先走");
  assert.ok(A.apply(st, 0, { from: [6, 4], to: [3, 4] }).err, "兵走不了三格");
  [[[6, 5], [5, 5]], [[1, 4], [3, 4]], [[6, 6], [4, 6]], [[0, 3], [4, 7]]].forEach((m, i) => { const r = A.apply(st, i % 2, { from: m[0], to: m[1] }); assert.ok(r.st, r.err); st = r.st; });
  assert.strictEqual(A.turn(st), -1);
  const res = A.result(st, inv);
  assert.deepStrictEqual(res.winners, [1]);
  assert.match(res.text, /甲（白）对 乙（黑），2 回合，乙（黑）赢了。/);
  assert.match(gsrc, /const outcome = st => GS\(\)\.boardOutcome\(B\(\)\.C, rep\(st\.mvs\), st\.resigned, B\(\)\.sides\);/);
  assert.match(games, /const oc = boardOutcome\(C, state, resigned, spec\.sides\), st = oc\.st, over = oc\.over, winner = oc\.winner;/);
});

test("中国象棋、斗兽棋：认输就结束、赢家是对面；view 只认走法和认输那两样", () => {
  const { G } = load2();
  ["xiangqi", "jungle"].forEach(k => {
    const A = G.ADAPTERS[k], inv = seats2();
    let st = A.init(inv);
    assert.strictEqual(A.turn(st), 0);
    const m = CORES[k].bestMove(A.replay(st.mvs), "easy");
    st = A.apply(st, 0, { from: m.from, to: m.to }).st;
    assert.strictEqual(A.turn(st), 1);
    st = A.apply(st, 1, { resign: true }).st;
    assert.deepStrictEqual(A.result(st, inv).winners, [0]);
    const v = A.cleanView(Object.assign(A.view(st), { hack: 1, board: "x" }));
    assert.deepStrictEqual(Object.keys(v).sort(), ["mvs", "resigned"]);
  });
});

test("围棋：两边连着停一手，庄那台估死子、照单机「数子」那一份 goResult 算", () => {
  const { G } = load2(), A = G.ADAPTERS.go, inv = seats2();
  let st = A.init(inv, { cfg: { goSize: 9 } });
  st = A.apply(st, 0, { p: 40 }).st;
  assert.ok(A.apply(st, 1, { p: 40 }).err, "有子的点下不了");
  st = A.apply(st, 1, { pass: true }).st; st = A.apply(st, 0, { pass: true }).st;
  assert.ok(st.result && A.turn(st) === -1);
  assert.deepStrictEqual(A.result(st, inv).winners, [st.result.winner - 1]);
  assert.match(gsrc, /n\.result = GS\(\)\.go\.result\(G, after, G\.estimateDead\(after, 600\)\);/);
  assert.match(games, /const confirmCount = function \(\) \{ setResult\(goResult\(G, state, dead \|\| \[\]\)\); \};/);
  assert.deepStrictEqual(Object.keys(A.cleanView(Object.assign(A.view(st), { x: 1 }))).sort(), ["mvs", "resigned", "result", "size"]);
});

test("25 问：答案不进公开那一份；直接说中走单机那份 q25Hit；问满 25 个就揭晓", async () => {
  const guess = { hit: (s, q) => String(q).includes(s), answerOne: async () => ({ verdict: "不是", note: "" }), judge: async () => ({ correct: false }), newPuzzle: async () => ({ secret: "雨伞", category: "物品" }) };
  const { G } = load2({ guess }), A = G.ADAPTERS.q25;
  const inv = Object.assign(seats2(), { setter: { mode: "system" } });
  let st = await A.init(inv, { hostApi: {} });
  assert.ok(!JSON.stringify(A.view(st)).includes("雨伞"));
  assert.ok(!JSON.stringify(A.cleanView(Object.assign({}, A.view(st), { secret: "" }))).includes("雨伞"));
  st = (await A.apply(st, 0, { ask: "是吃的吗" }, { inv, hostApi: {} })).st;
  assert.strictEqual(st.turn, 1);
  const hit = (await A.apply(st, 1, { ask: "是不是雨伞" }, { inv, hostApi: {} })).st;
  assert.ok(hit.done && hit.solvedBy === 1 && A.view(hit).secret === "雨伞");
  let s2 = st; for (let i = 0; i < 30 && !s2.done; i++) s2 = (await A.apply(s2, s2.turn, { ask: "是动物吗" + i }, { inv, hostApi: {} })).st;
  assert.ok(s2.done && s2.log.filter(l => l.q).length === 25);
  assert.match(games, /const hitQ25 = q => q25Hit\(ctx\.secret, q\);/);
});

test("海龟汤谁出题：指定座位的那位不在答题座位里、汤底只给 TA 自己那份；轮流时「再来一局」换下一个", async () => {
  const { G, w } = load2();
  const C = G;
  const inv0 = { key: "haigui", host: "A", mode: "normal", setter: { mode: "turns", peer: "B" }, seats: [{ kind: "user", peer: "A", name: "甲" }, { kind: "user", peer: "B", name: "乙" }, { kind: "char", peer: "B", charId: "b1", name: "阿B" }] };
  assert.strictEqual(C.setterSeat(inv0), 1);
  const A = G.ADAPTERS.haigui;
  let st = await A.init(inv0, {});
  assert.strictEqual(st.phase, "set"); assert.strictEqual(A.turn(st), 1, "先等出题人");
  st = (await A.apply(st, 1, { puzzle: { surface: "汤面", truth: "真相" } }, { inv: inv0 })).st;
  assert.strictEqual(st.phase, "play");
  const order = []; let s = st;
  for (let i = 0; i < 4; i++) { order.push(s.turn); s = (await A.apply(s, s.turn, { pass: true }, { inv: inv0 })).st; }
  assert.ok(order.every(i => i !== 1), "出题人轮不到问：" + order);
  assert.ok(!JSON.stringify(A.view(st)).includes("真相"));
  assert.deepStrictEqual(A.priv(st, 1), { truth: "真相" });
  assert.strictEqual(A.priv(st, 0), null);
  assert.deepStrictEqual(C.nextSetter(inv0, 1), { peer: "B", charId: "b1" }, "轮流：下一个座位");
  assert.deepStrictEqual(C.nextSetter(inv0, 2), { peer: "A" }, "转一圈回到头");
  // Session 的「再来一局」真的换人
  const s0 = w.NetGameSession({ me: () => "A", nick: () => "甲", nickOf: x => x, send: () => {}, post: () => {}, patchCard: () => {}, charOf: () => null, apiFor: () => null });
  const gid = s0.invite({ key: "haigui", zh: "海龟汤", min: 2, max: 8 }, { total: 3 }, [{ kind: "user" }], null, { mode: "turns" });
  assert.deepStrictEqual(s0.seen(gid), null);
  const ng = s0.again(gid);
  assert.ok(ng);
  assert.match(gsrc, /if \(inv\.setter && inv\.setter\.mode === "turns"\) \{ const nx = nextSetter\(inv, setterSeat\(g\.inv\)\);/);
});

test("故事接龙：轮流接、写满三圈就收；接句子走单机那份提示词（storyLineAsk → storyWriteLine）", async () => {
  const { G } = load2(), A = G.ADAPTERS.story, inv = seats2();
  let st = A.init(inv);
  assert.ok(A.apply(st, 1, { line: "抢着写" }).err);
  while (A.turn(st) >= 0) st = A.apply(st, A.turn(st), { line: "接一句" + st.lines.length }).st;
  assert.strictEqual(st.lines.length, 6);
  assert.ok(A.result(st, inv).text.startsWith("一起写了 6 句"));
  assert.deepStrictEqual(await A.npcMove(A.init(inv), 0, inv, { hostApi: {} }), { line: "她推开门，钥匙掉在地上。", say: "" });
  assert.match(games, /routeSeatCall\(current, api, ask\.sys, \[\{ role: "user", content: ask\.user \}\], \{ game: "story"/);
});

test("真心话大冒险：开局停在「转一下」→ 转的人点了庄才定指到谁 → 选 → 下一位出题 → 回应；瓶子交给答完的人；轮数可以不限", async () => {
  const { G } = load2(), A = G.ADAPTERS.tod, inv = seats2();
  let st = A.init(inv, { cfg: {} });
  assert.strictEqual(st.phase, "spin", "开局不自动开转");
  assert.strictEqual(st.rounds, 0, "默认不限轮数");
  assert.strictEqual(A.turn(st), 0, "第一位转的是 0 号座（真人就等她点）");
  assert.ok(A.apply(st, 1, { spin: true }, { inv }).err, "没轮到的人不能转");
  // 转的人塞了 target 也不认：指到谁只由庄这台的 spin 定
  const r0 = A.apply(st, 0, { spin: true, target: 0 }, { inv }).st;
  assert.strictEqual(r0.phase, "choose"); assert.strictEqual(r0.spinN, 1);
  assert.strictEqual(r0.target, 0, "照庄的 pickTarget（桩：跟上一位不同的第一个人）");
  st = r0;
  const tgt = st.target;
  assert.ok(A.apply(st, 1 - tgt, { choice: "真心话" }, { inv }).err, "没指到的人不能选");
  st = A.apply(st, tgt, { choice: "大冒险" }, { inv }).st;
  assert.strictEqual(A.turn(st), 1 - tgt, "另一个人出题");
  const mv = await A.npcMove(st, A.turn(st), inv, { hostApi: {} });
  st = A.apply(st, A.turn(st), mv, { inv }).st;
  const before = st;
  st = A.apply(st, tgt, { response: "做了" }, { inv }).st;
  assert.strictEqual(st.log.filter(x => x.type === "td").length, 1);
  assert.strictEqual(st.phase, "spin", "答完回到转瓶子");
  assert.strictEqual(st.spinner, tgt, "瓶子交给刚答完的那位");
  assert.ok(A.roundEnd(before, st, inv), "答完一轮算一轮完了");
  assert.deepStrictEqual(await A.npcMove(st, tgt, inv, { hostApi: {} }), { spin: true }, "角色／NPC 转的那轮自动转");
  // 不限：转很多轮也不自己收桌；房主收桌（reveal）才结束
  assert.ok(!st.done);
  assert.ok(A.apply(st, -1, { reveal: true }, { inv }).st.done, "收桌");
  // 开局选了轮数：转满就收
  let s6 = A.init(inv, { cfg: { todRounds: "1" } }); assert.strictEqual(s6.rounds, 1);
  assert.strictEqual(A.cleanView(A.view(st)).phase, "spin");
  assert.match(gsrc, /GS\(\)\.tod\.ask\(api, st\.choice, who,/);
  assert.match(games, /async function genTDPrompt\(api, choice, asker, hot, mode, memText, plan, target\)/);
  // 牌桌用的是单机那几块
  assert.match(gsrc, /h\(T\.SpinShow, \{/); assert.match(gsrc, /h\(T\.Choose, \{/); assert.match(gsrc, /h\(T\.RoundCard, \{/);
  assert.match(games, /tod: \{ RoundCard: TDRoundCard, SpinShow: TDSpinShow, SpinLine: TDSpinLine, Choose: TDChoose,/);
  assert.match(games, /if \(it\.type === "td"\) \{ const p = pByName\(it\.name\); return h\(TDRoundCard,/);
  assert.match(games, /action = h\(TDSpinShow, \{ t: t, name: spinName \}\)/);
});

test("一轮完了停一下：停着不推进、只有庄（开局的人）能接着来、开局选自动接着来就不停", async () => {
  const { G, w } = load();
  G.ADAPTERS.rnd = { seatRange: () => ({ min: 2, max: 2 }), init: () => ({ n: 0, turn: 0 }), view: st => ({ n: st.n, turn: st.turn }), cleanView: v => v, priv: () => null,
    turn: st => st.n >= 4 ? -1 : st.turn, apply: (st, i) => i !== st.turn ? { err: "x" } : { st: { n: st.n + 1, turn: 1 - st.turn } },
    roundEnd: (p, n) => n.n % 2 === 0 ? "第 " + (n.n / 2) + " 轮完了" : "", result: st => st.n >= 4 ? { winners: [], text: "完", replay: {} } : null, npcMove: () => ({}) };
  const run = async cfg => {
    const { S, log } = bus(["A", "B"], null, (id, send) => w.NetGameSession({ me: () => id, nick: () => id, nickOf: x => x, send, fast: true,
      post: () => {}, patchCard: () => {}, charOf: () => null, apiFor: () => null, presence: () => ({ A: "on", B: "on" }) }));
    const gid = S.A.invite({ key: "rnd", zh: "轮", min: 2, max: 2 }, Object.assign({ total: 2 }, cfg), [{ kind: "user" }]);
    S.B.join(gid, [{ kind: "user" }], "A");
    await until(() => log.some(l => l.obj.op === "card" && l.obj.x.seats[1].kind === "user"));
    assert.ok(await S.A.start(gid));
    return { S, gid };
  };
  let { S, gid } = await run({});
  S.A.move(gid, 0, {}); await until(() => S.B.seen(gid) && S.B.seen(gid).view.n === 1); S.B.move(gid, 1, {});
  assert.ok(await until(() => S.B.seen(gid) && S.B.seen(gid).pause), "两手打完停住，B 那边也看到停着");
  assert.strictEqual(S.A.seen(gid).pause.line, "第 1 轮完了");
  assert.ok(!G.myTurn(S.A.seen(gid).inv, S.A.seen(gid).view, "A", null, S.A.seen(gid).pause), "停着不算轮到谁");
  S.A.move(gid, 0, {}); await tick(); await tick();
  assert.strictEqual(S.A.seen(gid).view.n, 2, "停着不推进");
  S.B.resume(gid); await tick(); await tick();
  assert.ok(S.A.seen(gid).pause, "不是庄那台点的「接着来」不算");
  S.A.resume(gid);
  assert.ok(await until(() => S.B.seen(gid) && !S.B.seen(gid).pause));
  S.A.move(gid, 0, {});
  assert.ok(await until(() => S.A.seen(gid).view.n === 3), "接着来以后往下走");
  ({ S, gid } = await run({ autoNext: "auto" }));
  S.A.move(gid, 0, {}); await until(() => S.B.seen(gid) && S.B.seen(gid).view.n === 1); S.B.move(gid, 1, {});
  assert.ok(await until(() => S.A.seen(gid).view.n === 2));
  S.A.move(gid, 0, {});
  assert.ok(await until(() => S.A.seen(gid).view.n === 3), "自动接着来：不停");
  assert.ok(!S.A.seen(gid).pause);
  delete G.ADAPTERS.rnd;
  // 有「一轮」的那几盒都登记了 roundEnd（跑团不登记）
  ["tod", "story"].forEach(k => assert.strictEqual(typeof G.ADAPTERS[k].roundEnd, "function", k));
});

test("房里开着的几局：横幅只列没打完的；点进去按身份分报名／玩／观战；观战那台拿不到任何 priv", async () => {
  const { G, w } = load();
  const inv = (gid, status, seats) => ({ x: { gid, key: "gomoku", zh: "五子棋", min: 2, max: 2, host: "A", status, seats }, hostNick: "甲" });
  const rows = [inv("g1", "open", [{ kind: "user", peer: "A" }, { kind: "open" }]), inv("g2", "playing", [{ kind: "user", peer: "A" }, { kind: "char", peer: "B", charId: "b1" }]),
    inv("g3", "done", [{ kind: "user", peer: "A" }]), inv("g4", "cancel", []), inv("g5", "playing", [{ kind: "user", peer: "A" }, { kind: "npc" }])];
  rows.push(Object.assign(inv("g2", "playing", rows[1].x.seats), { pause: { line: "x", n: 1 } }));
  const L = G.openTables(rows, "B");
  assert.deepStrictEqual(L.map(x => x.gid), ["g1", "g2", "g5"], "打完的、取消的不列；同一局只一条");
  assert.deepStrictEqual(L.map(x => x.go), ["join", "play", "watch"], "带的角色坐着＝玩；不在桌上＝观战");
  assert.match(L[0].state, /报名中 · 差 1 人/); assert.strictEqual(L[1].state, "暂停聊天中");
  assert.match(nsrc, /onClick: \(\) => x\.go === "join" \? gameHandlers\(byGid\[x\.gid\]\)\.onJoin\(\) : openGame\(x\.gid\)/);
  assert.match(nsrc, /tablesBar\(\),\n        \.\.\.chatCore,/); assert.match(nsrc, /tablesBar\(\),\n        h\("div", \{ "data-wk": "nrgamefull"/);
  // 观战：C 不在桌上，私密那份一条都不给 C
  G.ADAPTERS.secret2 = { seatRange: () => ({ min: 2, max: 2 }), init: () => ({ word: ["苹果", "梨"] }), view: () => ({ open: 1 }), cleanView: v => v, priv: (st, i) => ({ word: st.word[i] }), turn: () => -1, result: () => null };
  const { S, log } = bus(["A", "B", "C"], null, (id, send) => w.NetGameSession({ me: () => id, nick: () => id, nickOf: x => x, send, fast: true,
    post: () => {}, patchCard: () => {}, charOf: () => null, apiFor: () => null, presence: () => ({ A: "on", B: "on", C: "on" }) }));
  const gid = S.A.invite({ key: "secret2", zh: "秘", min: 2, max: 2 }, { total: 2 }, [{ kind: "user" }]);
  S.B.join(gid, [{ kind: "user" }], "A");
  await until(() => log.some(l => l.obj.op === "card" && l.obj.x.seats[1].kind === "user"));
  assert.ok(await S.A.start(gid));
  assert.ok(await until(() => S.C.seen(gid) && S.B.seen(gid) && S.B.seen(gid).priv), "观战的 C 也看得到公开那份");
  assert.ok(!S.C.seen(gid).priv && !log.some(l => l.to === "C" && l.obj.op === "priv"), "观战拿不到 priv");
  assert.ok(!JSON.stringify(log.filter(l => !l.to)).includes("梨"));
  delete G.ADAPTERS.secret2;
});

test("大富翁：掷骰、落地、空地等这位拿主意、结束照 monoRanking；钱只在庄那台动", () => {
  const { G } = load2(), A = G.ADAPTERS.monopoly, inv = seats2();
  let st = A.init(inv), guard = 0;
  while (!st.done && guard++ < 2000) {
    const i = A.turn(st);
    const mv = st.pending ? { yes: guard % 3 === 0 } : { roll: true };
    const r = A.apply(st, i, mv); assert.ok(r.st, r.err); st = r.st;
  }
  assert.ok(st.done, "走满手数或有人破产就结算");
  const res = A.result(st, inv);
  assert.strictEqual(res.winners.length, 1);
  assert.match(gsrc, /const moves = st\.moves \+ 1, rank = M\.ranking\(ps, os, lv, moves\);/);
  assert.match(games, /function finishIfNeeded\(ps,os,ls,nextMoves\)\{const ranked=monoRanking\(ps,os,ls,nextMoves\);/);
  assert.match(games, /const need=monoLand\(ps,os,lv,turn,ls,eventParts\);/);
  const v = A.cleanView(Object.assign(A.view(st), { secret: 1 }));
  assert.ok(!("secret" in v));
});

test("新几盒的角色座位也由带 TA 来的那台出手、用 TA 自己的线路（国际象棋）", async () => {
  const { G, w } = load2();
  const apiAsked = [];
  const { S, log } = bus(["A", "B"], null, (id, send) => w.NetGameSession({ me: () => id, nick: () => id, nickOf: x => x, send, fast: true,
    post: () => {}, patchCard: () => {}, charOf: cid => id === "B" && cid === "b1" ? { id: "b1", name: "阿B", persona: "" } : null,
    apiFor: cid => { apiAsked.push(id + ":" + cid); return {}; }, presence: () => ({ A: "on", B: "on" }) }));
  const gid = S.A.invite({ key: "chess", zh: "国际象棋", min: 2, max: 2 }, { total: 2, npcFill: true }, [{ kind: "user" }]);
  S.B.join(gid, [{ kind: "char", charId: "b1", name: "阿B" }], "A");
  assert.ok(await until(() => log.some(l => l.obj.op === "card" && l.obj.x.seats[1].kind === "char")));
  assert.ok(await S.A.start(gid));
  S.A.move(gid, 0, { from: [6, 4], to: [4, 4] });
  assert.ok(await until(() => log.some(l => l.obj.op === "move" && l.obj.seat === 1)), "黑方那一手");
  const mv = log.filter(l => l.obj.op === "move" && l.obj.seat === 1);
  assert.ok(mv.every(l => l.from === "B" && l.to === "A"), "角色那一手只由 B 那台发给庄");
  assert.ok(apiAsked.every(x => x === "B:b1"));
  assert.ok(await until(() => S.A.seen(gid).view.mvs.length === 2));
});

test("大厅：第一档这几盒都摆出来；联机接不住的开局选项收起来", () => {
  const { G } = load2();
  ["gomoku", "haigui", "q25", "chess", "xiangqi", "jungle", "go", "story", "tod", "monopoly"].forEach(k => assert.ok(G.supported().indexOf(k) >= 0, k));
  const hideList = JSON.parse((nsrc.match(/setupHide: (\[[^\]]*\])/) || [])[1] || "[]");
  ["stake", "injectChat", "ccSeat", "boardTeach", "gmkBrain", "q25Host", "skillPins", "cardBrain", "bjDealer", "pkTruth", "mjAutoDraw", "mjSwap"].forEach(k => assert.ok(hideList.indexOf(k) >= 0, "联机收起 " + k));
  assert.match(games, /hide: props\.setupHide, extraOpts: props\.setupExtra, note: props\.setupNote \? props\.setupNote\(game\) : "",/);
  // 狼阵营某一种、阿瓦隆某个特殊角色按前缀收（wolf_<key>、av_<key>）
  hideList.forEach(k => { const m = /^(wolf|av)_/.exec(k); assert.ok(m ? games.indexOf('hid("' + m[0] + '" + o.') > 0 : games.indexOf('hid("' + k + '")') > 0, k); });
});

test("半窗：展开时记下房里有几条，之后来的算新消息；收起不计数；再展开从头算", () => {
  const { G } = load();
  let w = G.winOpen(null, "g1", 10);
  assert.deepStrictEqual([w.gid, w.min, w.seen], ["g1", false, 10]);
  assert.strictEqual(G.winUnread(w, 13), 3);
  w = G.winSet(w, Object.assign({}, w, { min: true }), 13);
  assert.ok(w.min); assert.strictEqual(G.winUnread(w, 20), 0, "收起了聊天就在底下，不提醒");
  w = G.winSet(w, Object.assign({}, w, { min: false }), 20);
  assert.strictEqual(G.winUnread(w, 21), 1, "再展开从那一刻算");
  w = G.winSet(w, Object.assign({}, w, { box: { x: 1 } }), 30);
  assert.strictEqual(w.seen, 20, "拖位置不重置");
  assert.strictEqual(G.winSet(w, null, 30), null);
  assert.strictEqual(G.winOpen({ gid: "g1", min: true, box: { x: 5 } }, "g1", 2).box.x, 5, "同一局再打开记得位置");
});

test("轮到我：收起的小条会亮（myTurn 只认我这台的真人座位）", () => {
  const { G } = load();
  const inv = { key: "gomoku", host: "A", status: "playing", seats: [{ kind: "user", peer: "A", name: "甲" }, { kind: "user", peer: "B", name: "乙" }] };
  assert.ok(G.myTurn(inv, { moves: [], turn: 1, winner: 0 }, "A"));
  assert.ok(!G.myTurn(inv, { moves: [], turn: 1, winner: 0 }, "B"));
  assert.ok(!G.myTurn(Object.assign({}, inv, { status: "done" }), { moves: [], turn: 1, winner: 0 }, "A"));
  assert.match(nsrc, /pillHot: turn \}/);
});

test("当前对局写给开口的角色：只用公开那一份，别人的私密那份不进去；出题人自己那座才带汤底", async () => {
  const { G } = load2();
  const inv = { key: "haigui", zh: "海龟汤", host: "A", status: "playing", seats: [{ kind: "user", peer: "A", name: "甲" }, { kind: "char", peer: "B", charId: "b1", name: "阿B" }, { kind: "user", peer: "C", name: "丙" }] };
  const A = G.ADAPTERS.haigui;
  const st = { phase: "play", setter: 1, surface: "汤面X", truth: "真相Y", log: [{ seat: 0, name: "甲", q: "是人吗", verdict: "是", note: "" }], turn: 2, done: false, solvedBy: -1, reveal: "", busy: false };
  const v = A.cleanView(A.view(st));
  const other = G.stateText(inv, v, 2, { truth: "真相Y" });
  assert.ok(other.includes("汤面X") && other.includes("是人吗"));
  assert.ok(!other.includes("真相Y"), "不是出题人那座，就算手里有 priv 也不放");
  assert.ok(G.stateText(inv, v, 1, A.priv(st, 1)).includes("真相Y"), "出题人自己那座带上自己的汤底");
  ["gomoku", "haigui", "q25", "chess", "xiangqi", "jungle", "go", "story", "tod", "monopoly"].forEach(k => assert.strictEqual(typeof G.ADAPTERS[k].stateText, "function", k + " 要有 stateText"));
  // 两条开口的路都带上
  assert.match(nsrc, /now: Date\.now\(\), game: gameStateFor\(char\.id\), presence: presence\(\),/);
  assert.match(nsrc, /targets, cast, game: gameStateFor\(null\) \}\);/);
  assert.equal((nsrc.match(/\+ \(o\.game \? "\\n\\n" \+ o\.game : ""\)/g) || []).length, 2);
  // 每盒都能写出一段
  const sts = { chess: G.ADAPTERS.chess.init(), go: G.ADAPTERS.go.init(inv, {}), story: G.ADAPTERS.story.init(inv), tod: G.ADAPTERS.tod.init(inv), monopoly: G.ADAPTERS.monopoly.init(inv) };
  Object.keys(sts).forEach(k => assert.ok(G.stateText(Object.assign({}, inv, { key: k, zh: k }), G.ADAPTERS[k].cleanView(G.ADAPTERS[k].view(sts[k])), 0).length > 20, k));
});

test("角色怎么玩：报名只带座位旁那两个字，设置不进 join 白名单；出手时用的是主人那台本地的设置", async () => {
  const { G, w } = load2();
  // 庄收到的 join：多塞的 casual / recent / recentText 一个不收，只留 tag
  const sent = [];
  const host = w.NetGameSession({ me: () => "A", nick: () => "甲", nickOf: x => x, send: (o, to) => sent.push({ o, to }), post: () => {}, patchCard: () => {}, charOf: () => null, apiFor: () => null });
  const gid = host.invite(GOMOKU, { total: 2 }, [{ kind: "user" }]);
  host.onMessage({ op: "join", gid, picks: [{ kind: "char", charId: "b1", name: "阿B", tag: "随手", casual: true, recent: true, recentText: "私房话" }] }, "B");
  const card = sent.filter(x => x.o.op === "card").pop().o.x;
  assert.deepStrictEqual(card.seats[1], { kind: "char", name: "阿B", peer: "B", charId: "b1", tag: "随手" });
  assert.ok(!JSON.stringify(sent).includes("私房话"));
  assert.match(G.inviteLine(card), /阿B（角色 · 随手）/);
  // 出手：B 那台 charOpts 给的 casual → 五子棋走放水那一档；给的 recent → 人设后面接上最近单聊
  const asked = [];
  const guess = { askOne: async (api, k, pub, hist, who) => { asked.push(who.persona); return "是人吗"; } };
  const r2 = load2({ guess });
  const opts = { recent: true, recentText: "昨天说好去看海" };
  await r2.G.ADAPTERS.haigui.charMove({ phase: "play", surface: "汤面", log: [] }, 1, {}, { api: {}, char: { name: "阿B", persona: "人设" }, opts });
  assert.ok(asked[0].includes("人设") && asked[0].includes("昨天说好去看海"));
  await r2.G.ADAPTERS.haigui.charMove({ phase: "play", surface: "汤面", log: [] }, 1, {}, { api: {}, char: { name: "阿B", persona: "人设" }, opts: {} });
  assert.ok(!asked[1].includes("昨天说好去看海"), "没勾就不带");
  assert.match(gsrc, /const lv = ctx && ctx\.opts && ctx\.opts\.casual \? 2 : this\.level\(inv, inv\.seats\[seatIdx\]\);/);
  assert.match(gsrc, /const opts = \(o\.charOpts && o\.charOpts\(gid, seat\.charId\)\) \|\| \{\};/);
  assert.match(nsrc, /charOpts: \(gid, cid\) => charOptsFor\(cid\),/);
  assert.deepStrictEqual(G.charOptKinds("chess"), ["skill", "talk"]);
  assert.deepStrictEqual(G.charOptKinds("gomoku"), ["casual", "talk"]);
});

test("半窗里打字：键盘升起时半窗贴着键盘上沿、高度压进可见区（她 11-22 截图：输入框被顶出屏幕）", () => {
  const c = read("js/components.js"); const i = c.indexOf("function HalfWinFrame("); const seg = c.slice(i, i + 6000);
  assert.ok(/window\.visualViewport/.test(seg) && /el\.contains\(a\)/.test(seg), "只在焦点落在半窗里时才挪");
  assert.ok(/top: ky, width: bx\.w, height: kh/.test(seg));
});

test("联机牌桌摆的是单机那几块：海龟汤谜面卡／问答／判词／揭晓、牌桌座位和记录、UNO 牌面；公共部件里不出现联机字样", () => {
  const csrc = read("js/netroom-cards.js");
  assert.match(gsrc, /h\(G\.guess\.PuzzleCard, \{/); assert.match(gsrc, /h\(Gq\.AskRow, \{/); assert.match(gsrc, /h\(Gq\.Verdict, \{/); assert.match(gsrc, /h\(G\.guess\.RevealCard, \{/);
  assert.match(games, /const puzzleCard = h\(GuessPuzzleCard, \{/); assert.match(games, /return h\(GuessAskRow, \{/); assert.match(games, /if \(it\.type === "a"\) return h\(GuessVerdict, \{/); assert.match(games, /h\(GuessRevealCard, \{ t: t, kind: kind, text: reveal \}\)/);
  assert.match(csrc, /h\(CD\(\)\.Seats, \{/); assert.match(csrc, /h\(CD\(\)\.Log, \{/); assert.match(csrc, /h\(CD\(\)\.UnoCard, \{/);
  assert.match(games, /Seats: CardSeats, Log: CardLog, felt: feltBox, UnoCard: UnoCardFace,/);
  assert.match(games, /return h\(UnoCardFace, \{ key: c\.uid,/);
  assert.match(games, /h\(GameNextBtn, \{ t: t, wk: "gameliarnext", onClick: nextRound \}/);
  assert.match(nsrc, /h\(G\.GameNextBtn, \{ t, wk: "nrgameresume", onClick: onGo \}, "接着来"\)/);
  // 抽出去的那几块在单机文件里：不许出现联机字样
  ["function TDRoundCard", "function GuessPuzzleCard", "function UnoCardFace", "function GameNextBtn"].forEach(k => { const i = games.indexOf(k), j = games.indexOf("\n  }\n", i); assert.ok(i > 0); assert.ok(!/联机|netroom/i.test(games.slice(i, j)), k); });
});
