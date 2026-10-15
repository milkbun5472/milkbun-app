import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshState, takeJourney, putJourney, JOURNEY_SHAPE, JOURNEY_KEYS} from './world.mjs';
// 她 2026-09-19：「每个庭院档连一个列车档连一个别的什么档」
// ＋「我倾向各走各的，设定上就是每一个都是不同游戏，当然不应该共享进度」

test('跟着人走的只有那几样，进度一律留在这个世界', () => {
  const s = { ...freshState(), day: 42, map: 'forest', herbs: 9,
    look: { hair: 'bun' }, carry: [{ id: 'x' }] };
  const j = takeJourney(s);
  for (const k of ['day', 'map', 'herbs', 'blooms', 'season', 'position'])
    assert.equal(j[k], undefined, k + ' 被抄进旅程层了——那是进度，不许跟着走');
  assert.deepEqual(j.look, { hair: 'bun' });
  assert.deepEqual(j.carry, [{ id: 'x' }]);
});

test('盖回去只动那几样，别人一个都不碰', () => {
  const blank = freshState();
  const back = putJourney({ ...blank, day: 7 }, { look: { hair: 'wavy' }, carry: [] });
  assert.equal(back.day, 7, '盖旅程层把天数也盖了');
  assert.deepEqual(back.look, { hair: 'wavy' });
  assert.deepEqual(putJourney(blank, null), blank, '没有旅程那一份时要原样返回');
});

test('同行者的样貌也跟着走，而且是嵌在 companion 里的那一份', () => {
  const s = { ...freshState() };
  s.companion = { ...s.companion, look: { hair: 'korean' }, position: { x: 3, z: 4 } };
  const j = takeJourney(s);
  assert.deepEqual(j.companionLook, { hair: 'korean' });
  const back = putJourney(freshState(), j);
  assert.deepEqual(back.companion.look, { hair: 'korean' });
  assert.notDeepEqual(back.companion.position, s.companion.position, '同行者的位置是这个世界的事，不该跟着走');
});

// ⚠️关系那几样故意不在这一层：每一条都带着「第几天」，而天数是各走各的。
test('关系那几样不许溜进旅程层', () => {
  for (const k of ['gifts', 'bond', 'happenings', 'miss', 'collection', 'things'])
    assert.ok(!JOURNEY_KEYS.includes(k), k + ' 进旅程层了——它带着「第几天」，跨世界就对不上');
});

test('哪一样在哪一层只有一张表', () => {
  const src = fs.readFileSync(new URL('./world.mjs', import.meta.url), 'utf8');
  assert.equal((src.match(/JOURNEY_SHAPE *=/g) || []).length, 1, '这张表出现了第二处');
  assert.deepEqual(Object.keys(JOURNEY_SHAPE), JOURNEY_KEYS);
});
