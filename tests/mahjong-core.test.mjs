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
