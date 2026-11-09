// 广东麻将：规则核心（整局本地牌手跑完、分数守恒、番型）＋ 接进游戏架
import { createRequire } from "node:module"; import { readFileSync } from "node:fs"; import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const M = require("../js/mahjong-core.js");
let hands = 0, wins = 0;
for (let g = 0; g < 60; g++) {
  const st = M.newGame([0, 1, 2, 3].map(i => ({ key: "p" + i, name: "P" + i })), { hands: 4, minFan: g % 2 });
  let guard = 0;
  while (st.status === "playing" && guard++ < 4000) {
    if (st.phase === "discard") { const a = M.botSelf(st, st.turn); if (a.kind === "discard") M.discard(st, st.turn, a.k); else M.selfAct(st, st.turn, a); }
    else if (st.phase === "claim") { for (const j of Object.keys(st.claim.pending)) { if (st.claim && !st.claim.decided[j]) M.decide(st, +j, M.botClaim(st, +j)); if (!st.claim) break; } }
    else { hands++; if (st.result.winner != null) { wins++; assert.ok(st.result.fan.fan >= st.minFan, "起糊番数"); } M.nextHand(st); }
  }
  assert.ok(guard < 4000, "不卡死");
  assert.equal(st.players.reduce((n, p) => n + p.pts, 0), 0, "分数守恒");
}
assert.ok(hands >= 240 && wins > hands / 2);
const thirteen = { hand: ["m1", "m9", "p1", "p9", "s1", "s9", "E", "S", "W", "N", "C", "F", "P"], melds: [], flowers: [] };
assert.equal(M.fanOf(thirteen, "P", {}).fan, 13);
const pure = { hand: ["m1", "m1", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m9", "m9"], melds: [], flowers: ["f1"] };
assert.ok(M.fanOf(pure, "m5", { seatNo: 1 }).items.some(x => x[0] === "清一色"));
const pongs = { hand: ["m2", "m2", "m2", "p5", "p5", "p5", "C", "C", "C", "E", "E", "E", "s7"], melds: [], flowers: [] };
const f = M.fanOf(pongs, "s7", { seatWind: "E", roundWind: "E" });
assert.ok(f.items.some(x => x[0] === "对对糊") && f.items.some(x => x[0] === "中刻"));
assert.equal(M.canWin(["m1", "m2", "m4"], []), false);
const games = readFileSync(new URL("../js/games.js", import.meta.url), "utf8"), list = readFileSync(new URL("../js/games-list.js", import.meta.url), "utf8"), idx = readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert.match(list, /key: "mahjong", emoji: "🀄", zh: "广东麻将", en: "Cantonese Mahjong", min: 4, max: 4/);
assert.match(games, /session\.game\.key === "mahjong" && window\.MahjongCore\) return h\(MahjongGame/);
assert.match(idx, /js\/mahjong-core\.js\?v=/);
assert.ok(idx.indexOf("mahjong-core.js") < idx.indexOf('data-src="js/games.js'));
console.log("mahjong ok");
// 她点牌墙摸牌：轮到她停在 draw，点了才摸；桌子正中那块牌墙就是按钮
{
  const st = M.newGame([{ key: "user", name: "我", isUser: true }, { key: "a", name: "a" }, { key: "b", name: "b" }, { key: "c", name: "c" }], { handDraw: true });
  let g = 0, draws = 0;
  while (st.status === "playing" && g++ < 5000) {
    if (st.phase === "draw") { assert.equal(st.turn, 0); M.drawTile(st, 0); draws++; }
    else if (st.phase === "discard") { const a = M.botSelf(st, st.turn); if (a.kind === "discard") M.discard(st, st.turn, a.k); else M.selfAct(st, st.turn, a); }
    else if (st.phase === "claim") { for (const j of Object.keys(st.claim.pending)) { if (st.claim && !st.claim.decided[j]) M.decide(st, +j, M.botClaim(st, +j)); if (!st.claim) break; } }
    else M.nextHand(st);
  }
  assert.ok(draws > 5 && st.status === "finished");
}
assert.match(games, /function MjTable\(props\)/);
assert.match(games, /"data-wk": "gamemjwall", onClick: canDraw \? props\.onDraw/);
assert.match(games, /handDraw: !cfg\.mjAutoDraw/);
console.log("mahjong table ok");
assert.match(games, /@keyframes mjToRiver/);
assert.match(games, /prefers-reduced-motion: reduce\)\{\[data-mjanim\]\{animation:none!important\}/);
assert.match(games, /anim: sel === "d" \? null : "mjDrawIn/);
console.log("mahjong anim ok");
// 说一句是公共的：每张牌桌都用 CardSay；她一开口，公共那层（useCardTableTalk）就让桌上接话
assert.match(games, /function CardSay\(props\)/);
assert.ok((games.match(/h\(CardSay, \{ t: t, state: state, setState: setState/g) || []).length >= 7, "七张牌桌都走 CardSay");
assert.ok(!/"data-part": "talk", value: \w+, onChange: function \(e\) \{ \w+\(e\.target\.value\); \}, placeholder/.test(games), "没有各写各的输入格");
assert.match(games, /if \(!\(moved \|\| said\.length\) \|\| !\(o\.ready \|\| said\.length/);
assert.match(games, /ready: hot, every: spectate \? 16 : 28/);
assert.ok((games.match(/userAct\(function/g) || []).length >= 9);
console.log("mahjong talk ok");
