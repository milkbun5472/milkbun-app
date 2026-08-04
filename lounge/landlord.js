'use strict';

const crypto = require('node:crypto');

const PLAYERS = ['lisa', 'yanqiu', 'codex'];
const NAMES = { lisa: 'Lisa', yanqiu: '言秋', codex: 'Codex' };
const SUITS = ['S', 'H', 'C', 'D'];
const RANKS = [
  ['3', 3], ['4', 4], ['5', 5], ['6', 6], ['7', 7], ['8', 8], ['9', 9],
  ['10', 10], ['J', 11], ['Q', 12], ['K', 13], ['A', 14], ['2', 15],
];

function deck() {
  const cards = [];
  for (const [rank, value] of RANKS) for (const suit of SUITS) cards.push({ id: `${suit}${rank}`, rank, value, suit });
  // `SJ` 已被黑桃 J 占用；小王必须使用独立牌号，否则 UI 看成两张小王，
  // 选牌提交时也会因同 id 冲突。XJ = 小王，BJ = 大王。
  cards.push({ id: 'XJ', rank: '小王', value: 16, suit: 'J' }, { id: 'BJ', rank: '大王', value: 17, suit: 'J' });
  return cards;
}

function shuffle(cards, random = crypto.randomInt) {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sortCards(cards) { return cards.slice().sort((a, b) => a.value - b.value || a.id.localeCompare(b.id)); }
function nextPlayer(player) { return PLAYERS[(PLAYERS.indexOf(player) + 1) % PLAYERS.length]; }
function countsOf(cards) {
  const map = new Map();
  for (const card of cards) map.set(card.value, (map.get(card.value) || 0) + 1);
  return map;
}
function consecutive(values) { return values.every((v, i) => i === 0 || v === values[i - 1] + 1); }

function analyze(cards) {
  cards = sortCards(cards || []);
  const n = cards.length;
  if (!n) return null;
  const counts = countsOf(cards);
  const entries = [...counts.entries()].sort((a, b) => a[0] - b[0]);
  const byCount = (k) => entries.filter(([, c]) => c === k).map(([v]) => v);
  if (n === 2 && counts.has(16) && counts.has(17)) return { type: 'rocket', main: 17, length: 2 };
  if (n === 4 && byCount(4).length === 1) return { type: 'bomb', main: byCount(4)[0], length: 4 };
  if (n === 1) return { type: 'single', main: cards[0].value, length: 1 };
  if (n === 2 && entries.length === 1) return { type: 'pair', main: cards[0].value, length: 2 };
  if (n === 3 && entries.length === 1) return { type: 'triple', main: cards[0].value, length: 3 };
  if (n === 4 && byCount(3).length === 1) return { type: 'triple_single', main: byCount(3)[0], length: 4 };
  if (n === 5 && byCount(3).length === 1 && byCount(2).length === 1) return { type: 'triple_pair', main: byCount(3)[0], length: 5 };
  const values = entries.map(([v]) => v);
  if (n >= 5 && entries.every(([, c]) => c === 1) && values.at(-1) <= 14 && consecutive(values)) {
    return { type: 'straight', main: values.at(-1), length: n };
  }
  if (n >= 6 && n % 2 === 0 && entries.every(([, c]) => c === 2) && values.at(-1) <= 14 && consecutive(values)) {
    return { type: 'pair_straight', main: values.at(-1), length: n };
  }
  const triples = entries.filter(([v, c]) => c >= 3 && v <= 14).map(([v]) => v);
  for (let size = triples.length; size >= 2; size--) {
    for (let start = 0; start + size <= triples.length; start++) {
      const run = triples.slice(start, start + size);
      if (!consecutive(run)) continue;
      const rest = new Map(counts);
      for (const v of run) rest.set(v, rest.get(v) - 3);
      const remainder = [...rest.entries()].filter(([, c]) => c > 0);
      const left = remainder.reduce((sum, [, c]) => sum + c, 0);
      if (left === 0 && n === size * 3) return { type: 'airplane', main: run.at(-1), length: n, chain: size };
      if (left === size && n === size * 4) return { type: 'airplane_single', main: run.at(-1), length: n, chain: size };
      if (left === size * 2 && n === size * 5 && remainder.length === size && remainder.every(([, c]) => c === 2)) {
        return { type: 'airplane_pair', main: run.at(-1), length: n, chain: size };
      }
    }
  }
  if (n === 6 && byCount(4).length === 1) return { type: 'four_two', main: byCount(4)[0], length: 6 };
  if (n === 8 && byCount(4).length === 1 && byCount(2).length === 2) return { type: 'four_two_pair', main: byCount(4)[0], length: 8 };
  return null;
}

function beats(candidate, previous) {
  if (!candidate) return false;
  if (!previous) return true;
  if (candidate.type === 'rocket') return true;
  if (previous.type === 'rocket') return false;
  if (candidate.type === 'bomb' && previous.type !== 'bomb') return true;
  if (candidate.type !== previous.type || candidate.length !== previous.length) return false;
  return candidate.main > previous.main;
}

function createGame({ random } = {}) {
  const cards = shuffle(deck(), random);
  const hands = { lisa: sortCards(cards.slice(0, 17)), yanqiu: sortCards(cards.slice(17, 34)), codex: sortCards(cards.slice(34, 51)) };
  return {
    version: 1, status: 'bidding', players: PLAYERS.slice(), hands, kitty: sortCards(cards.slice(51)),
    turn: 'lisa', bids: [], highestBid: 0, highestBidder: null, landlord: null,
    currentPlay: null, lastPlayBy: null, passes: 0, history: [], winner: null,
  };
}

// 兼容已经落盘的 v1 牌局：只凭 card 自身的 suit/rank 精确迁移小王，
// 黑桃 J（suit=S, rank=J）保持 SJ，不靠模糊猜测历史文本。
function normalizeState(state) {
  const fix = (card) => card && card.suit === 'J' && card.rank === '小王' && card.id === 'SJ'
    ? { ...card, id: 'XJ' } : card;
  for (const hand of Object.values((state && state.hands) || {})) {
    for (let i = 0; i < hand.length; i++) hand[i] = fix(hand[i]);
  }
  if (state && Array.isArray(state.kitty)) state.kitty = state.kitty.map(fix);
  if (state && state.currentPlay && Array.isArray(state.currentPlay.cards)) state.currentPlay.cards = state.currentPlay.cards.map(fix);
  return state;
}

function bid(state, player, points) {
  if (state.status !== 'bidding' || state.turn !== player) throw new Error('还没轮到这位叫分');
  points = Number(points);
  if (!Number.isInteger(points) || points < 0 || points > 3) throw new Error('叫分只能是 0、1、2、3');
  if (points > 0 && points <= state.highestBid) throw new Error(`要叫就必须高于当前 ${state.highestBid} 分`);
  state.bids.push({ player, points });
  state.history.push({ kind: 'bid', player, points });
  if (points > state.highestBid) { state.highestBid = points; state.highestBidder = player; }
  if (points === 3 || state.bids.length === 3) {
    if (!state.highestBidder) return { redeal: true };
    state.landlord = state.highestBidder;
    state.hands[state.landlord] = sortCards(state.hands[state.landlord].concat(state.kitty));
    state.turn = state.landlord;
    state.status = 'playing';
    state.history.push({ kind: 'landlord', player: state.landlord, kitty: state.kitty.map((c) => c.id) });
  } else state.turn = nextPlayer(player);
  return { redeal: false };
}

function play(state, player, cardIds) {
  if (state.status !== 'playing' || state.turn !== player) throw new Error('还没轮到这位出牌');
  const ids = Array.isArray(cardIds) ? cardIds : [];
  if (!ids.length) {
    if (!state.currentPlay || state.lastPlayBy === player) throw new Error('你是这一墩先手，不能不出');
    state.history.push({ kind: 'pass', player });
    state.passes += 1;
    if (state.passes >= 2) { state.currentPlay = null; state.turn = state.lastPlayBy; state.passes = 0; }
    else state.turn = nextPlayer(player);
    return;
  }
  if (new Set(ids).size !== ids.length) throw new Error('同一张牌不能出两次');
  const hand = state.hands[player];
  const chosen = ids.map((id) => hand.find((c) => c.id === id));
  if (chosen.some((c) => !c)) throw new Error('所选牌不在手里');
  const combo = analyze(chosen);
  if (!combo) throw new Error('这几张牌不是合法牌型');
  if (!beats(combo, state.currentPlay && state.currentPlay.combo)) throw new Error('这手牌压不过桌面');
  state.hands[player] = hand.filter((c) => !ids.includes(c.id));
  state.currentPlay = { cards: sortCards(chosen), combo };
  state.lastPlayBy = player;
  state.passes = 0;
  state.history.push({ kind: 'play', player, cards: sortCards(chosen).map((c) => c.id), combo });
  if (!state.hands[player].length) { state.status = 'finished'; state.winner = player; state.turn = null; }
  else state.turn = nextPlayer(player);
}

function viewFor(state, viewer = 'lisa') {
  return {
    version: state.version, status: state.status, players: state.players, turn: state.turn,
    bids: state.bids, highestBid: state.highestBid, landlord: state.landlord,
    kitty: state.landlord ? state.kitty : [], currentPlay: state.currentPlay, lastPlayBy: state.lastPlayBy,
    passes: state.passes, winner: state.winner, history: state.history,
    hand: sortCards(state.hands[viewer] || []),
    handCounts: Object.fromEntries(PLAYERS.map((p) => [p, state.hands[p].length])),
  };
}

function promptFor(state, player) {
  const hand = sortCards(state.hands[player]).map((c) => c.id).join(' ');
  const common = [`Lisa 邀请你在三方会客厅打斗地主。现在轮到${NAMES[player]}。`, `你的手牌（只能看见你自己的）：${hand}`];
  if (state.status === 'bidding') {
    common.push(`当前最高叫分：${state.highestBid}。第一行只回复一项：不叫，或“叫 N 分”（N 必须高于当前分，最高 3）。如果这手想顺嘴说话，可另起一行写“说：……”；不想说就省略。`);
  } else {
    common.push(state.currentPlay
      ? `桌面上 ${NAMES[state.lastPlayBy]} 出了：${state.currentPlay.cards.map((c) => c.id).join(' ')}。`
      : '你是这一墩先手，必须出牌。');
    common.push('第一行只回复一项：“出 S3 H3”（使用上面的精确牌号），或在可以不出时回复“不出”。如果这手想顺嘴说话，可另起一行写“说：……”；不想说就省略。不要替别人行动，不要解释规则。');
  }
  return common.join('\n\n');
}

function parseAction(text, state) {
  const value = String(text || '').trim();
  const speechHit = value.match(/(?:^|\n)\s*说\s*[：:]\s*([^\n]{1,160})/);
  const speech = speechHit ? speechHit[1].trim() : '';
  if (state.status === 'bidding') {
    if (/不叫|pass|过/i.test(value)) return { kind: 'bid', points: 0, speech };
    const hit = value.match(/(?:叫\s*)?([0-3])\s*分?/);
    if (hit) return { kind: 'bid', points: Number(hit[1]), speech };
    throw new Error('没看懂叫分，请说“不叫”或“叫 N 分”');
  }
  if (/不出|不要|pass|过(?:\s|$)/i.test(value)) return { kind: 'pass', cards: [], speech };
  const valid = new Set(state.hands[state.turn].map((c) => c.id));
  const tokens = value.toUpperCase().match(/(?:S|H|C|D)(?:10|[3-9JQKA2])|XJ|BJ/g) || [];
  const cards = [...new Set(tokens.filter((id) => valid.has(id)))];
  if (!cards.length) throw new Error('没读到有效牌号');
  return { kind: 'play', cards, speech };
}

module.exports = { PLAYERS, NAMES, deck, sortCards, analyze, beats, createGame, normalizeState, bid, play, viewFor, promptFor, parseAction };
