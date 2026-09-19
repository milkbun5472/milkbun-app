// 她 2026-09-19：「小世界里的语音播放气泡之间还是有点延迟，第一个气泡也是。
// 能不能搞跟语音通话一样流畅点」。
// 病根是【彻底串行】：念完这一条才去合成下一条，于是两条之间必定空掉一次网络往返。
// 聊天那边 2026-09-10 已经修过同一个形状（提前一条），所以这次开公共层 ttsWarm，
// 把通话那处也搬过来（施工规则/one-public-mechanism.md）。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const engine = read('js/engine.js');
const app = read('js/app.js');
const host = read('js/fairy-garden.js');
const game = read('apps/fairy-garden/game.mjs');

// 提前合成只有一处，通话和庭院都走它
test('ttsWarm 是公共的那一层，不许谁再自己写一遍预热', () => {
  assert.match(engine, /function ttsWarm\(text, voiceId, opts\)/);
  assert.match(app, /typeof ttsWarm === "function"\) ttsWarm\(ln\.speech, char\.voiceId\)/);
  assert.doesNotMatch(app, /ttsSpeak\(ln\.speech, char\.voiceId\)\.catch/, '通话那处还留着旧的预热写法');
  assert.match(host, /warmAloud: text =>/);
  assert.match(host, /ttsWarm\(line, c\.voiceId\)/);
});

// 预热那次和真要播那次同时在飞＝两枪两份钱：合流必须在 ttsSpeak 这一处
test('同一句话同一个音色，同时只发一枪', () => {
  const i = engine.indexOf('const _ttsFlight = new Map();');
  const j = engine.indexOf('async function ttsSynth(', i);
  assert.ok(i > 0 && j > i, '抠不出 ttsSpeak 的合流层');
  const src = engine.slice(i, j);
  let calls = 0;
  const { ttsSpeak, ttsWarm } = new Function('ttsKeyFor', 'ttsSynth',
    src + ';return {ttsSpeak,ttsWarm};')(
    (t, v) => ({ key: v + '|' + t }),
    () => { calls++; return new Promise(r => setTimeout(() => r('blob'), 5)); });
  const warm = ttsWarm('你回来了', 'v1');
  const play = ttsSpeak('你回来了', 'v1');
  assert.equal(calls, 1, '预热和播放各发了一枪');
  assert.equal(warm, play, '两边拿到的不是同一个 Promise');
  ttsSpeak('别的话', 'v1');
  assert.equal(calls, 2, '不同的句子不该被合流');
  return play.then(() => {
    ttsSpeak('你回来了', 'v1');
    assert.equal(calls, 3, '落地之后没把在途的那笔清掉');
  });
});

// 算不出钥匙时不许把这句话吞掉——照样合成，只是不合流
test('钥匙算不出来也要照常合成', () => {
  const i = engine.indexOf('const _ttsFlight = new Map();');
  const j = engine.indexOf('async function ttsSynth(', i);
  let calls = 0;
  const { ttsSpeak } = new Function('ttsKeyFor', 'ttsSynth',
    engine.slice(i, j) + ';return {ttsSpeak};')(
    () => { throw new Error('没配音色库'); },
    () => { calls++; return Promise.resolve('blob'); });
  ttsSpeak('x', 'v1');
  assert.equal(calls, 1);
});

test('念着这一条的时候，下一条已经在合成了', () => {
  const i = game.indexOf('function warmNext(){');
  const j = game.indexOf('function nextBubble(){', i);
  assert.ok(i > 0 && j > i, '抠不出 warmNext');
  const warm = game.slice(i, j);
  assert.match(warm, /bubbleWho==='me'/, '她自己那几只不该念，也就不该预热');
  assert.match(warm, /bubbleQueue\[0\]/, '预热的不是队里下一条');
  assert.match(warm, /if\(!voiceOn/, '开关关着还在花钱合成');
  // 预热这一声要在【开口的时候】喊，不是念完才喊——念完再喊就等于没提前
  const k = game.indexOf('host.readAloud(line).then');
  assert.ok(game.lastIndexOf('warmNext();', k) > game.indexOf('const mine=++bubbleTurn;'),
    'warmNext 没有排在 readAloud 之前');
});

test('念出来的时候那段读字的空档要收掉', () => {
  assert.match(game, /VOICE_GAP=\d{2,3}/);
  const gap = Number(/VOICE_GAP=(\d+)/.exec(game)[1]);
  const read0 = Number(/BUBBLE_GAP=(\d+)/.exec(game)[1]);
  assert.ok(gap < read0, '念出来那条还在用读字的间隔');
  assert.match(game, /bubbleUntil=Date\.now\(\)\+VOICE_GAP;bubbleTimer=setTimeout\(nextBubble,VOICE_GAP\)/);
});

test('第一只气泡：回复一落地就去合成，不等写完存档', () => {
  assert.match(game, /warmVoice:line=>\{if\(!voiceOn/, 'warmVoice 没挡住关着开关的时候');
  assert.match(host, /g0\.warmVoice\(first\)/);
  // ⚠️必须排在校验之后：校验没过的那一轮不该花这笔钱
  const guard = host.indexOf('throw new Error("角色或存档已变更，这次回复没有写入。")');
  const warm = host.indexOf('g0.warmVoice(first)');
  const speak = host.indexOf('game().speak(result.parts)');
  assert.ok(guard > 0 && warm > guard && speak > warm, '预热的位置不对');
});
