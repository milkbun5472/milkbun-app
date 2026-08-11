"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { MONO_BOARD, monoMove, monoNetWorth, monoAdvance, monoOwnsGroup, monoRent, monoGridPos, monoMigrateSave, monoMaxMoves, monoShouldFlush, monoCleanLogs, monoAuctionCap, monoAuctionPlan } = require("../js/games.js");

test("monopoly movement wraps and reports passing start", () => {
  assert.deepEqual(monoMove(38, 4), { pos: 2, passed: 1 });
  assert.deepEqual(monoMove(3, 2), { pos: 5, passed: 0 });
});

test("monopoly net worth includes owned land", () => {
  const p = { key: "a", cash: 500 };
  assert.equal(monoNetWorth(p, { 1: "a", 3: "b", 6: "a" }), 500 + MONO_BOARD[1].price + MONO_BOARD[6].price);
});

test("monopoly turn advancement skips bankrupt players", () => {
  const ps = [{ bankrupt: false }, { bankrupt: true }, { bankrupt: false }];
  assert.equal(monoAdvance(ps, 0), 2);
  assert.equal(monoAdvance(ps, 2), 0);
});

test("complete color sets and upgrades increase rent", () => {
  const owners = { 1: "a", 3: "a" };
  assert.equal(monoOwnsGroup("a", "晨曦", owners), true);
  assert.equal(monoRent(1, "a", owners, {}), MONO_BOARD[1].rent * 2);
  assert.equal(monoRent(1, "a", owners, { 1: 2 }), MONO_BOARD[1].rent * 2 * 3);
});

test("upgrades count toward final net worth", () => {
  const p = { key: "a", cash: 500 }, owners = { 1: "a" };
  assert.equal(monoNetWorth(p, owners, { 1: 2 }), 500 + MONO_BOARD[1].price * 2);
});

test("classic city has 40 unique perimeter cells and 22 properties", () => {
  assert.equal(MONO_BOARD.length, 40);
  assert.equal(MONO_BOARD.filter(x => x.type === "property").length, 22);
  const cells = MONO_BOARD.map((_, i) => `${monoGridPos(i).gridRow}:${monoGridPos(i).gridColumn}`);
  assert.equal(new Set(cells).size, 40);
});

test("legacy 16-cell saves migrate ownership and positions by landmark", () => {
  const old = { players: [{ key: "a", pos: 13 }], owners: { 13: "a", 15: "b" }, levels: { 15: 2 } };
  const next = monoMigrateSave(old);
  assert.equal(MONO_BOARD[next.players[0].pos].name, "灯塔湾");
  assert.equal(next.owners[31], "a");
  assert.equal(next.owners[39], "b");
  assert.equal(next.levels[39], 2);
});

test("turn limit scales with player count instead of ending large tables early", () => {
  assert.equal(monoMaxMoves(2), 80);
  assert.equal(monoMaxMoves(4), 88);
  assert.equal(monoMaxMoves(6), 132);
});

test("model interaction batches routine events but flushes at important moments", () => {
  assert.equal(monoShouldFlush(3, "买下一块地", false), false);
  assert.equal(monoShouldFlush(4, "买下一块地", false), true);
  assert.equal(monoShouldFlush(1, "有人破产", false), true);
  assert.equal(monoShouldFlush(1, "普通收租", true), true);
  assert.equal(monoShouldFlush(1, "A经过竞价拍下春日街", false), true);
});

test("auction is deterministic, respects persona cash lines, and charges a real competing bid", () => {
  const cautious = { key: "c", name: "谨慎型", cash: 900, skill: "谨慎稳健，现金安全线至少保留 $600" };
  const bold = { key: "b", name: "进攻型", cash: 900, skill: "大胆激进，现金安全线 $150" };
  const steady = { key: "s", name: "稳健型", cash: 900, skill: "现金安全线 $300" };
  const tileIndex = 29;
  assert.ok(monoAuctionCap(bold, MONO_BOARD[tileIndex], tileIndex, {}) > monoAuctionCap(cautious, MONO_BOARD[tileIndex], tileIndex, {}));
  const a = monoAuctionPlan([cautious, bold, steady], {}, tileIndex, "nobody");
  const b = monoAuctionPlan([cautious, bold, steady], {}, tileIndex, "nobody");
  assert.deepEqual(a, b);
  assert.ok(a.bidders.length >= 2);
  assert.ok(a.bid >= a.floor);
  assert.ok(a.bid <= a.bidders[0].cap);
  assert.equal(a.winner.key, a.bidders[0].p.key);
});

test("old rule banners are removed without deleting real table conversation", () => {
  const next = monoCleanLogs([{ type: "sys", say: "每人带着 $1200 入场。45 回合后结算。" }, { type: "talk", name: "A", say: "这块地我要了。" }]);
  assert.equal(next.some(x => /1200|45 回合/.test(x.say)), false);
  assert.equal(next.some(x => x.say === "这块地我要了。"), true);
  assert.equal(next[0].say.includes("经典 40 格"), true);
});

test("mobile monopoly layout reserves space for roster and dialogue", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "../js/games.js"), "utf8");
  assert.match(src, /gridTemplateRows:"repeat\(11,30px\)"/);
  assert.match(src, /gridColumn:"2 \/ 11",gridRow:"2 \/ 11"/);
  assert.match(src, /MONO_TOKEN_COLORS/);
  assert.match(src, /monoTokenColor\(p,players\)/);
  assert.match(src, /"收起棋盘 · 看对话"/);
  assert.match(src, /setSelectedTile\(i\)/);
  assert.match(src, /minHeight:55/);
  assert.match(src, /minHeight:110/);
});
