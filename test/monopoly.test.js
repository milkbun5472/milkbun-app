"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { MONO_BOARD, monoMove, monoNetWorth, monoAdvance, monoOwnsGroup, monoRent } = require("../js/games.js");

test("monopoly movement wraps and reports passing start", () => {
  assert.deepEqual(monoMove(14, 4), { pos: 2, passed: 1 });
  assert.deepEqual(monoMove(3, 2), { pos: 5, passed: 0 });
});

test("monopoly net worth includes owned land", () => {
  const p = { key: "a", cash: 500 };
  assert.equal(monoNetWorth(p, { 1: "a", 3: "b", 5: "a" }), 500 + MONO_BOARD[1].price + MONO_BOARD[5].price);
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
