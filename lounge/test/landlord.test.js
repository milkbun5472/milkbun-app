'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deck, analyze, beats, createGame, normalizeState, bid, play, viewFor, parseAction } = require('../landlord');

function cards(...ids) {
  const all = new Map(deck().map((c) => [c.id, c]));
  return ids.map((id) => all.get(id));
}

test('54 张牌、三家各 17、底牌 3 且暗牌投影不泄漏', () => {
  const state = createGame({ random: () => 0 });
  assert.equal(deck().length, 54);
  assert.equal(new Set(deck().map((card) => card.id)).size, 54);
  assert.deepEqual(Object.values(state.hands).map((h) => h.length), [17, 17, 17]);
  assert.equal(state.kitty.length, 3);
  const view = viewFor(state, 'lisa');
  assert.equal(view.hand.length, 17);
  assert.equal(view.hands, undefined);
});

test('识别常用牌型与炸弹压制', () => {
  assert.equal(analyze(cards('S3')).type, 'single');
  assert.equal(analyze(cards('S3', 'H3')).type, 'pair');
  assert.equal(analyze(cards('S3', 'H3', 'C3', 'S4')).type, 'triple_single');
  assert.equal(analyze(cards('S3', 'S4', 'S5', 'S6', 'S7')).type, 'straight');
  assert.equal(analyze(cards('S3', 'H3', 'S4', 'H4', 'S5', 'H5')).type, 'pair_straight');
  assert.equal(analyze(cards('XJ', 'BJ')).type, 'rocket');
  assert.equal(analyze(cards('SJ', 'XJ')), null); // 黑桃 J + 小王不是对子
  assert.equal(beats(analyze(cards('S4', 'H4', 'C4', 'D4')), analyze(cards('S2'))), true);
});

test('旧牌局迁移：只把旧编码小王 SJ 改成 XJ，黑桃 J 仍是 SJ', () => {
  const state = {
    hands: { lisa: [{ id: 'SJ', rank: 'J', value: 11, suit: 'S' }, { id: 'SJ', rank: '小王', value: 16, suit: 'J' }] },
    kitty: [], currentPlay: null,
  };
  normalizeState(state);
  assert.deepEqual(state.hands.lisa.map((card) => card.id), ['SJ', 'XJ']);
});

test('叫分确定地主、地主拿三张底牌', () => {
  const state = createGame({ random: () => 0 });
  bid(state, 'lisa', 1); bid(state, 'yanqiu', 0); bid(state, 'codex', 2);
  assert.equal(state.status, 'playing');
  assert.equal(state.landlord, 'codex');
  assert.equal(state.hands.codex.length, 20);
  assert.equal(state.turn, 'codex');
});

test('两家不出后由上一手重新领出', () => {
  const state = createGame({ random: () => 0 });
  state.status = 'playing'; state.turn = 'lisa'; state.landlord = 'lisa';
  const id = state.hands.lisa[0].id;
  play(state, 'lisa', [id]);
  play(state, 'yanqiu', []); play(state, 'codex', []);
  assert.equal(state.turn, 'lisa');
  assert.equal(state.currentPlay, null);
});

test('自然回复可解析为叫分、牌号或不出', () => {
  const state = createGame({ random: () => 0 });
  assert.deepEqual(parseAction('我叫 2 分', state), { kind: 'bid', points: 2, speech: '' });
  state.status = 'playing'; state.turn = 'lisa';
  const id = state.hands.lisa[0].id;
  assert.deepEqual(parseAction(`出 ${id}`, state), { kind: 'play', cards: [id], speech: '' });
  assert.deepEqual(parseAction('不出\n说：这手先让你。', state), { kind: 'pass', cards: [], speech: '这手先让你。' });
});
