// 围棋引擎（她 2026-10-23）：提子、打劫、自杀、数子、电脑挑子、时间
const assert = require("node:assert/strict");
const G = require("../js/go-core.js");
const at = (s, str) => G.parse(s.size, str);
const put = (s, list) => { list.forEach(([str, c]) => { s.board[at(s, str)] = c; }); return s; };
// 提子：白子四面被围就被提
let s = G.newGame(9);
put(s, [["E5", 2], ["D5", 1], ["F5", 1], ["E6", 1]]);
let s2 = G.move(s, { p: at(s, "E4") });
assert.equal(s2.board[at(s, "E5")], 0, "没提掉");
assert.equal(s2.caps[1], 1);
// 自杀不合法
s = G.newGame(9); put(s, [["D5", 2], ["F5", 2], ["E6", 2], ["E4", 2]]);
assert.equal(G.isLegal(s, at(s, "E5")), false, "自杀竟然能下");
// 打劫：提一子后对面不能马上提回
s = G.newGame(9);
put(s, [["D5", 1], ["E6", 1], ["E4", 1], ["F5", 2], ["E6", 1], ["G5", 2]]);
put(s, [["F6", 2], ["F4", 2], ["E5", 2]]);
// 黑在 F5? 构造标准劫：黑 D5 E6 E4，白 F6 F4 G5 E5；黑下 F5 提 E5
s.board[at(s, "F5")] = 0;
s.turn = 1;
s2 = G.move(s, { p: at(s, "F5") });
assert.equal(s2.board[at(s, "E5")], 0, "劫没提掉");
assert.equal(s2.ko, at(s, "E5"));
assert.equal(G.isLegal(s2, at(s, "E5")), false, "打劫马上提回了");
// 数子：空盘白贴 7.5 赢
s = G.newGame(9);
let sc = G.score(s, []);
assert.equal(sc.winner, 2);
// 黑占左半边一列墙
s = G.newGame(9); for (let y = 0; y < 9; y++) { s.board[y * 9 + 5] = 1; s.board[y * 9 + 6] = 2; }
sc = G.score(s, []); assert.equal(sc.black, 54); assert.equal(sc.white, 27 + 7.5); assert.equal(sc.winner, 1);
// 停两手就结束
s = G.move(G.move(G.newGame(9), { pass: true }), { pass: true }); assert.equal(s.passes, 2);
// 电脑：能吃就吃（白一子只剩一口气）
s = G.newGame(9); put(s, [["E5", 2], ["D5", 1], ["F5", 1], ["E6", 1], ["C3", 2], ["G7", 2]]); s.turn = 1;
const m = G.bestMove(s, "normal");
assert.equal(G.coord(9, m.p), "E4", "放着能提的子不提：" + G.coord(9, m.p));
// 每档、每种风格都给合法步；时间
["easy", "normal", "hard"].forEach(lv => G.STYLES.concat([undefined]).forEach(st => {
  const g = G.newGame(9), t0 = Date.now(), mv = G.bestMove(g, lv, st);
  assert.ok(mv.pass || G.isLegal(g, mv.p));
  assert.ok(Date.now() - t0 < 6000, lv + " 太慢");   // 想多久由 THINK 封顶；这里只防死循环，发版时测试并行跑会慢
}));
const g19 = G.newGame(19), t1 = Date.now(), m19 = G.bestMove(g19, "hard"); assert.ok(G.isLegal(g19, m19.p)); assert.ok(Date.now() - t1 < 8000, "十九路太慢");
// 死子估：角上孤零零一颗白子在黑的大地里
s = G.newGame(9); for (let y = 0; y < 9; y++) s.board[y * 9 + 4] = 1; s.board[at(s, "B2")] = 2; s.board[at(s, "H8")] = 2; for (let y = 0; y < 9; y++) s.board[y * 9 + 6] = 2;
const dead = G.estimateDead(s, 300);
assert.ok(dead.indexOf(at(s, "B2")) >= 0, "孤子没判死");
assert.equal(G.zh(G.newGame(9), { p: at(s, "E5") }), "黑下在 E5");
console.log("ok");
// 十七路（她 2026-10-23）
assert.equal(G.newGame(17).size, 17);
console.log("17 ok");
