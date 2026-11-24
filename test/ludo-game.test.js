// 她 2026-11-24：「加个飞行棋在小游戏和联机」——规则（起飞、跳格、飞虚线、撞子、回弹）、一手不调模型、单机和联机同一份规则
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const g = require("../js/games.js");
const games = read("js/games.js"), catalog = read("js/games-list.js"), nr = read("js/netroom-games.js");
const P = n => Array.from({ length: n }, (_, i) => ({ key: i ? "c" + i : "user", name: i ? "角色" + i : "我", isUser: !i }));
const fresh = n => { const s = g.ludoNewGame(P(n)); s.turn = 0; s.phase = "roll"; return s; };

test("棋盘照真的飞行棋盘画：外圈 52 格各在各的位置、一格挨一格；每色出发那格是自己的颜色、挨着自己的机库", () => {
  const at = Array.from({ length: 52 }, (_, i) => g.ludoRingCell(i).at);
  assert.equal(new Set(at.map(x => x.map(v => v.toFixed(2)).join())).size, 52);
  at.forEach((a, i) => { const b = at[(i + 1) % 52]; assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 2.05, "第 " + i + " 格断开了"); });
  [0, 1, 2, 3].forEach(c => {
    assert.equal(g.ludoGlobal(c, 0) % 4, c);
    const st = g.ludoCell(c, 0), hg = g.ludoCell(c, -1, 0);
    assert.ok(Math.hypot(st[0] - hg[0], st[1] - hg[1]) < 6, "出发格离机库太远");
    const lane = g.ludoCell(c, g.LUDO_HOME - 5), last = g.ludoCell(c, g.LUDO_HOME - 6);
    assert.ok(Math.hypot(lane[0] - last[0], lane[1] - last[1]) < 1.6, "跑道没接在回家入口后面");
  });
  assert.deepEqual(g.ludoCell(0, -1, 0).map(v => v < 9.5), [true, true], "红在左上");
});

test("掷到 6 才能起飞，起飞后再掷一次；不是 6 又没飞机在外面就轮到下一位", () => {
  const s = fresh(2);
  g.ludoRoll(s, 3);
  assert.equal(s.turn, 1, "掷 3 没有能走的");
  s.turn = 0; s.phase = "roll";
  g.ludoRoll(s, 6);
  assert.equal(s.phase, "move");
  assert.equal(g.ludoMoves(s).length, 1, "机库里四架只列一架");
  g.ludoAct(s, 0);
  assert.equal(s.players[0].planes[0], 0);
  assert.equal(s.turn, 0); assert.equal(s.phase, "roll", "掷到 6 再掷一次");
  assert.throws(() => g.ludoAct(s, 0), /走不了/);
});

test("停在自己颜色跳 4 格，停在虚线那格飞过去；终点多出来的往回弹", () => {
  assert.deepEqual(g.ludoStep(5, 3), { to: 12, stops: [8, 12], bounce: false, jump: true });
  // 照实物：自家虚线第 16 格 → 第 28 格（她 2026-11-24 一比一临摹）
  const fly = g.ludoStep(13, 3);
  assert.equal(fly.fly, true); assert.equal(fly.to, 28);
  const jf = g.ludoStep(10, 2);
  assert.ok(jf.jump && jf.fly && jf.to === 28, "跳到虚线那格接着飞");
  assert.equal(g.ludoStep(-1, 5), null);
  const b = g.ludoStep(g.LUDO_HOME - 3, 6);
  assert.equal(b.to, g.LUDO_HOME - 3); assert.equal(b.bounce, true);
  assert.equal(g.ludoStep(g.LUDO_HOME - 6, 6).to, g.LUDO_HOME);
});

test("撞子：停下那格对面只有一架就撞回机库，叠着两架撞不动", () => {
  const s = fresh(2);   // 两人局是红（0）对蓝（2）
  const red = s.players[0], blue = s.players[1];
  assert.equal(blue.color, 2);
  red.planes = [1, -1, -1, -1];
  // 红走 1→3：全局第 3 格；蓝色那一格的相对位置
  const relBlue = (g.ludoGlobal(0, 3) - g.ludoGlobal(2, 0) + 52) % 52;
  blue.planes = [relBlue, -1, -1, -1];
  s.phase = "roll"; g.ludoRoll(s, 2); g.ludoAct(s, 0);
  assert.equal(blue.planes[0], -1, "一架被撞回去");
  assert.ok(s.log.some(x => x.kind === "hit"));
  const s2 = fresh(2);
  s2.players[0].planes = [1, -1, -1, -1]; s2.players[1].planes = [relBlue, relBlue, -1, -1];
  g.ludoRoll(s2, 2); g.ludoAct(s2, 0);
  assert.deepEqual(s2.players[1].planes.slice(0, 2), [relBlue, relBlue], "叠着的不撞");
});

test("手机替 TA 挑的那一架永远合规，一整局一定走得完", () => {
  for (const n of [2, 3, 4]) for (let k = 0; k < 40; k++) {
    const s = g.ludoNewGame(P(n)); let steps = 0;
    while (s.status === "playing" && steps++ < 6000) { if (s.phase === "roll") g.ludoRoll(s, g.ludoDie()); else g.ludoAct(s, g.ludoPick(s, [])); }
    assert.equal(s.status, "finished");
    assert.ok(s.players.find(p => p.key === s.winner).planes.every(x => x >= g.LUDO_HOME));
  }
});

test("放水局：能撞她也不撞", () => {
  const s = fresh(2); s.turn = 1;
  const relRed = (g.ludoGlobal(2, 3) - g.ludoGlobal(0, 0) + 52) % 52;
  s.players[0].planes = [relRed, -1, -1, -1];
  s.players[1].planes = [1, 30, -1, -1];
  g.ludoRoll(s, 2);
  assert.equal(g.ludoPick(s, [], () => 0), 0, "平时撞");
  assert.equal(g.ludoPick(s, ["user"], () => 0), 1, "放水不撞她");
});

test("登记齐全：目录、盒面、桌布、开局分发；骰子和挑飞机都不调模型", () => {
  assert.match(catalog, /\{ key: "ludo", emoji: "[^"]+", zh: "飞行棋",[^}]*min: 2, max: 4,/);
  assert.match(games, /^\s*ludo:\s+\{ paper:/m);
  assert.match(games, /^\s*ludo: \["#/m);
  assert.match(games, /if \(session\.game\.key === "ludo"\) return h\(LudoGame, engineProps\);/);
  const i = games.indexOf("  function LudoGame(props) {"), j = games.indexOf("  const BJ_CHIPS", i);
  assert.ok(i > 0 && j > i, "抠不出 LudoGame");
  const body = games.slice(i, j);
  assert.doesNotMatch(body, /callRetry|callAI|routeSeatCall/, "一手都不该调模型");
  assert.match(body, /useCardTableTalk\(props, state, setState, \{ on: true, zh: "飞行棋"/, "说话走牌桌那一套公共的");
  assert.match(body, /saveGameSnap\("ludo"/);
});

function loadNet() {
  const w = {};
  new Function("window", nr)(w);
  w.GameShared = { cards: { ludo: { COLORS: g.LUDO_COLORS, HOME: g.LUDO_HOME, newGame: g.ludoNewGame, roll: g.ludoRoll, act: g.ludoAct, moves: g.ludoMoves, pick: g.ludoPick, die: g.ludoDie, homeCount: g.ludoHomeCount, where: g.ludoWhere, text: g.ludoPublic } } };
  return w.NetGameCore;
}

test("联机：庄那台照单机规则推进，角色和 NPC 由手机挑，一局打得完；公开那份洗得干净", () => {
  const G = loadNet(), A = G.ADAPTERS.ludo;
  assert.ok(G.supported().indexOf("ludo") >= 0);
  assert.ok(A.localTalk && A.mergeNpc === null);
  assert.deepEqual(A.seatRange(), { min: 2, max: 4 });
  ["init", "view", "priv", "turn", "apply", "npcMove", "charMove", "result", "cleanView", "cleanReplay", "stateText"].forEach(k => assert.equal(typeof A[k], "function", k));
  assert.match(nr, /ADAPTERS\.ludo\.Table = LudoTable; ADAPTERS\.ludo\.Replay = LudoReplay;/);
  assert.match(nr, /h\(L\.Board, \{/, "联机那块棋盘就是单机那一块");
  const inv = { key: "ludo", mode: "normal", seats: [{ kind: "user", name: "她", peer: "A" }, { kind: "char", name: "TA", peer: "B", charId: "c1" }, { kind: "npc", name: "路人甲" }] };
  let st = A.init(inv), n = 0;
  assert.equal(A.priv(st, 0), null);
  assert.ok(A.apply(st, (st.turn + 1) % 3, { roll: true }).err, "没轮到的不收");
  while (!A.result(st, inv) && n++ < 6000) {
    const i = A.turn(st), mv = i === 1 ? A.charMove(A.cleanView(A.view(st)), i, inv, {}) : A.npcMove(st, i, inv);
    const r = A.apply(st, i, mv); assert.ok(!r.err, r.err); st = r.st;
  }
  const res = A.result(st, inv);
  assert.ok(res && res.winners.length === 1 && res.text.indexOf("到家") >= 0);
  assert.equal(A.turn(st), -1);
  const v = A.cleanView(Object.assign({}, A.view(st), { hack: 1, players: st.players.map(p => Object.assign({}, p, { persona: "不该出门" })) }));
  assert.ok(!("hack" in v) && !("persona" in v.players[0]));
  assert.ok(A.stateText(v, 0, inv).length > 20);
});
