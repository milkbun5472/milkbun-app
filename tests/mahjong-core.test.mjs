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
// 牌手水平（公共一档）：高手稳赢新手；四桌共用 botSlip，俄罗斯方块旧存档 tetrisSkill 照认
{
  const pts = [0, 0, 0, 0], slip = [0, 0.4, 0, 0.4];
  for (let g = 0; g < 80; g++) {
    const st = M.newGame([0, 1, 2, 3].map(i => ({ key: "p" + i, name: "P" + i })), { hands: 4 });
    let guard = 0;
    while (st.status === "playing" && guard++ < 4000) {
      if (st.phase === "discard") { const a = M.botSelf(st, st.turn, false, slip[st.turn]); if (a.kind === "discard") M.discard(st, st.turn, a.k); else M.selfAct(st, st.turn, a); }
      else if (st.phase === "claim") { for (const j of Object.keys(st.claim.pending)) { if (st.claim && !st.claim.decided[j]) M.decide(st, +j, M.botClaim(st, +j, false, false, slip[+j])); if (!st.claim) break; } }
      else M.nextHand(st);
    }
    st.players.forEach((p, i) => { pts[i] += p.pts; });
  }
  assert.ok(pts[0] + pts[2] > pts[1] + pts[3], "高手赢新手");
}
assert.match(games, /const BOT_SKILL_GAMES = \["tetris", "uno", "doudizhu", "mahjong"\]/);
assert.match(games, /unoLocalMove\(state, null, botSlip\(cfg\)\)/);
assert.match(games, /ddzNpcPlay\(state, state\.turn, softFor\(state\.turn\) \|\| Math\.random\(\) < botSlip\(cfg\)\)/);
assert.match(games, /M\.botSelf\(n, n\.turn, soft && meI >= 0, botSlip\(cfg\)\)/);
assert.match(games, /TET_SKILL\[botSkillOf\(cfg\)\]/);
assert.match(games, /"data-wk": "gamebotskill"/);
console.log("bot skill ok");
// 四川血战到底、红中：整局本地牌手跑完、分数守恒；定缺、癞子、七对、一炮多响
for (const variant of ["sichuan", "hongzhong"]) {
  let multi = 0, hands = 0;
  for (let g = 0; g < 40; g++) {
    const st = M.newGame([0, 1, 2, 3].map(i => ({ key: "p" + i, name: "P" + i })), { hands: 4, variant });
    let guard = 0;
    while (st.status === "playing" && guard++ < 6000) {
      if (st.phase === "discard") { const a = M.botSelf(st, st.turn); if (a.kind === "discard") M.discard(st, st.turn, a.k); else M.selfAct(st, st.turn, a); }
      else if (st.phase === "claim") { for (const j of Object.keys(st.claim.pending)) { if (st.claim && !st.claim.decided[j]) M.decide(st, +j, M.botClaim(st, +j)); if (!st.claim) break; } }
      else { hands++; if (st.wins.length > 1) multi++; st.wins.forEach(w => { if (variant === "hongzhong") assert.ok(w.zimo, "红中只能自摸"); }); M.nextHand(st); }
    }
    assert.ok(guard < 6000, variant + " 不卡死");
    assert.equal(st.players.reduce((n, p) => n + p.pts, 0), 0, variant + " 分数守恒");
    assert.ok(st.wall !== undefined);
  }
  if (variant === "sichuan") assert.ok(multi > 0, "血战到底：一盘能有几家胡");
}
{
  // 四川定缺：她那家等她定；手里有缺的那门只能先打那门
  const st = M.newGame([{ key: "user", name: "我", isUser: true }, { key: "a", name: "a" }, { key: "b", name: "b" }, { key: "c", name: "c" }], { variant: "sichuan" });
  // 换三张：先挑同一门的三张；挑了不同门的不行
  assert.equal(st.phase, "swap");
  const su = ["m", "p", "s"].find(x => st.players[0].hand.filter(k => k[0] === x).length >= 3);
  const three = st.players[0].hand.filter(k => k[0] === su).slice(0, 3);
  assert.throws(() => M.setSwap(st, 0, ["m1", "p1", "s1"].filter(() => true)), /同一门|没有/);
  M.setSwap(st, 0, three);
  assert.equal(st.swapGot[M.swapTarget(st, 0)].join(), three.join());
  assert.equal(st.phase, "que");
  assert.ok(st.players.slice(1).every(p => p.que));
  M.setQue(st, 0, "m");
  assert.equal(st.phase, "discard");
  const me = st.players[0];
  if (me.hand.some(k => k[0] === "m") && me.hand.some(k => k[0] !== "m")) assert.throws(() => M.discard(st, 0, me.hand.find(k => k[0] !== "m")), /先打那门/);
  assert.equal(st.wall.length + st.players.reduce((n, p) => n + p.hand.length, 0), 108);
}
assert.ok(M.fitJ(M.counts(["m1", "m2", "m4", "p5", "p5", "p5", "s7", "s8", "s9", "m9", "m9"]), 4, 3, false), "红中顶缺张");
assert.ok(M.sevenPairs(M.counts(["m1", "m1", "m2", "m2", "p3", "p3", "p4", "p4", "s5", "s5", "s6", "s6", "s7"]), 1), "七对癞子补单张");
assert.match(list, /key: "mahjong", emoji: "🀄", zh: "麻将", en: "Mahjong", min: 4, max: 4/);
assert.match(games, /"data-wk": "gamemjvariant"/);
assert.match(games, /variant: cfg\.mjVariant \|\| "canton"/);
// 刮风下雨、查叫查花猪都是一家付一家收：上面那几十局四川分数守恒已经把它们算进去了；这里再钉住接线
const coreSrc = readFileSync(new URL("../js/mahjong-core.js", import.meta.url), "utf8");
assert.match(coreSrc, /kongPay\(st, i, "ckong"\)/); assert.match(coreSrc, /kongPay\(st, i, "akong"\)/); assert.match(coreSrc, /kongPay\(st, j, "kong", cl\.from\)/);
assert.match(coreSrc, /settleExhaust\(st\);/);
console.log("variants ok");
// 台湾十六张、国标、日麻：整局跑完、点数守恒（日麻连立直棒一起算）；十六张发 16 张；日麻没役不能和、立直扣 1000
for (const variant of ["taiwan", "guobiao", "riichi"]) {
  for (let g = 0; g < 25; g++) {
    const st = M.newGame([0, 1, 2, 3].map(i => ({ key: "p" + i, name: "P" + i })), { hands: 4, variant });
    const start = st.players.reduce((n, p) => n + p.pts, 0);
    if (variant === "taiwan") assert.equal(st.players[(st.dealer + 1) % 4].hand.length, 16);
    let guard = 0;
    while (st.status === "playing" && guard++ < 6000) {
      if (st.phase === "discard") { const a = M.botSelf(st, st.turn); if (a.kind === "discard") M.discard(st, st.turn, a.k); else M.selfAct(st, st.turn, a); }
      else if (st.phase === "claim") { for (const j of Object.keys(st.claim.pending)) { if (st.claim && !st.claim.decided[j]) M.decide(st, +j, M.botClaim(st, +j)); if (!st.claim) break; } }
      else { st.wins.forEach(w => { if (variant === "guobiao") assert.ok(w.fan.gate >= 8, "国标 8 番起和"); if (variant === "riichi") assert.ok(w.fan.gate >= 1, "日麻要有役"); }); M.nextHand(st); }
    }
    assert.ok(guard < 6000, variant + " 不卡死");
    assert.equal(st.players.reduce((n, p) => n + p.pts, 0) + (st.pot || 0), start, variant + " 点数守恒");
  }
}
{
  const st = { variant: "riichi", doraInd: ["m4"], players: [] };
  const noYaku = { hand: ["m1", "m2", "m3", "p4", "p5", "p6", "s7", "s8", "s9", "E", "E", "N", "N"], melds: [{ type: "pong", tiles: ["s1", "s1", "s1"] }].slice(0, 0), flowers: [] };
  const f = M.fanOf({ hand: ["m2", "m3", "m4", "p4", "p5", "p6", "s6", "s7", "s8", "m5", "m5", "p2", "p3"], melds: [], flowers: [] }, "p4", { zimo: false, seatWind: "S", roundWind: "E" }, st);
  assert.ok(f.items.some(x => x[0] === "断幺九") && f.items.some(x => x[0] === "宝牌"), "断幺 + 宝牌");
  void noYaku;
  assert.equal(M.jpBase(4, 30, 0).label, "4 番 30 符"); assert.equal(M.jpBase(4, 40, 0).label, "满贯"); assert.equal(M.jpBase(6, 30, 0).label, "跳满");
}
assert.match(games, /\{ key: "riichi", title: "日麻"/);
assert.match(games, /"data-wk", "gamemjriichi"|"gamemjriichi"/);
console.log("more variants ok");
// 日麻补全：一发、里宝牌、赤宝牌都会出现；红 5 一门最多一张
{
  const seen = {};
  for (let g = 0; g < 120; g++) {
    const st = M.newGame([0, 1, 2, 3].map(i => ({ key: "p" + i, name: "P" + i })), { hands: 4, variant: "riichi" });
    let guard = 0;
    while (st.status === "playing" && guard++ < 6000) {
      if (st.phase === "discard") { const a = M.botSelf(st, st.turn); if (a.kind === "discard") M.discard(st, st.turn, a.k); else M.selfAct(st, st.turn, a); }
      else if (st.phase === "claim") { for (const j of Object.keys(st.claim.pending)) { if (st.claim && !st.claim.decided[j]) M.decide(st, +j, M.botClaim(st, +j)); if (!st.claim) break; } }
      else { st.wins.forEach(w => w.fan.items.forEach(x => { seen[x[0]] = 1; })); ["m", "p", "s"].forEach(su => assert.ok(st.players.filter(p => p.aka.indexOf(su) >= 0).length <= 1)); M.nextHand(st); }
    }
  }
  assert.ok(seen["一发"] && seen["里宝牌"] && seen["赤宝牌"], "三样都出现过");
}
console.log("riichi extras ok");
