import test from 'node:test';import assert from 'node:assert/strict';
import {MAPS, freshState, sleepPose, arrangeSleep, SLEEP_HUG_GAP} from './world.mjs';
// 她 2026-09-18：「然后在床上能不能搞个相拥而眠的动作」
const bed = MAPS.home.beds.dawn;
const inBed = (mode, companionLyingDown = true) => {
  const s = freshState();
  s.map = 'home'; s.position = {...bed.approach.player};
  const next = arrangeSleep(s, 'dawn', mode);
  next.companion = {...next.companion, map: 'home',
    position: companionLyingDown ? {...bed.approach.companion} : {x: 0, z: 0}};
  return next;
};

test('一起睡：两个人都躺下了才抱在一起，而且是面对面靠拢', () => {
  const s = inBed('together');
  const me = sleepPose(s), him = sleepPose(s, 'companion');
  assert.ok(me?.hug && him?.hug, '同一张床上两个人都躺下了，却没有相拥');
  assert.equal(me.toward, -him.toward, '两个人往同一边侧身了，那是背对背');
  assert.ok(Math.abs(me.x - him.x) - SLEEP_HUG_GAP < 1e-9, '靠拢的距离不是 SLEEP_HUG_GAP');
  const apart = Math.abs(bed.slots.player.x - bed.slots.companion.x);
  assert.ok(Math.abs(me.x - him.x) < apart, '比各睡各的还远，那没靠拢');
});

test('他还没上床就不许抱——抱着空气最难看', () => {
  const s = inBed('together', false);
  assert.equal(sleepPose(s)?.hug, undefined, '他人还没到，她就先抱上了');
  assert.equal(sleepPose(s, 'companion'), null, '他不在床边却算躺下了');
});

test('分房睡不摆相拥的姿势', () => {
  const s = inBed('separate');
  const me = sleepPose(s);
  assert.ok(me, '她自己该是躺着的');
  assert.equal(me.hug, undefined, '分房还抱在一起');
  assert.deepEqual({x: me.x, z: me.z}, {x: bed.slots.player.x, z: bed.slots.player.z}, '分房时床位不该挪');
});
