import test from 'node:test';import assert from 'node:assert/strict';
import {MAPS,walkable,findPath,freshState} from './world.mjs';
// 她 2026-09-18：「种后面的花圃会穿模宝宝」
// ⚠️病根是【站得太近】：花圃是个有高度的木框，站位离它南边只有 0.25 米，
//   而小人半个身子就有 0.35——所以身体插进框里。站位往南挪 0.4。
const BODY = 0.35;

test('浇花／播种那个站位不插进花圃里', () => {
  const st = MAPS.garden.stations.garden;
  for (const bed of MAPS.garden.flowerbeds){
    const dx = Math.abs(st.x - bed.x) - bed.w / 2, dz = Math.abs(st.z - bed.z) - bed.d / 2;
    assert.ok(dx > BODY || dz > BODY, bed.id + '：站位离它只有 ' + Math.max(dx, dz).toFixed(2) + ' 米');
  }
});

test('三件事还是同一个站位，而且走得到', () => {
  const st = MAPS.garden.stations.garden;
  assert.deepEqual(MAPS.garden.stations.note, st);
  assert.deepEqual(MAPS.garden.stations.sow, st);
  assert.equal(walkable(st.x, st.z, 'garden'), true);
  assert.ok(findPath(freshState().position, st, 'garden')?.length);
});

// ⚠️他帮你浇花要求离这个站位 0.5 米以内（companionCare）：站位挪了，他也照样够得着
test('挪完他还是走到同一个点上', () => {
  assert.deepEqual(MAPS.garden.stations.garden, MAPS.garden.stations.sow);
});
