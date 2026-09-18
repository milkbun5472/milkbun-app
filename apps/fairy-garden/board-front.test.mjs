import test from 'node:test';import assert from 'node:assert/strict';
import {MAPS,walkable,findPath,freshState,hitInteraction} from './world.mjs';
// 她 2026-09-18：「带我来公告栏不是应该站牌子前面吗，还有牌子点击也打不开公告」
const g = MAPS.garden;
const panel = g.obstacles.find(o => Math.abs(o.x + 2.4) < .01 && Math.abs(o.z + 9.6) < .3);
const spot = g.stations.board;
const ring = g.interactions.find(x => x.kind === 'board');

test('牌子、站位、点判都在同一条线上，而且站位在牌子【南边】（广场那一侧）', () => {
  assert.ok(panel, '找不到告示板那块挡板，坐标八成动过了');
  assert.ok(spot.z > panel.z, '站位跑到牌子背后去了');
  assert.ok(ring.z > panel.z, '点判圈在牌子背后——那样怎么点都打不开');
  assert.ok(Math.abs(spot.x - panel.x) < .35 && Math.abs(ring.x - panel.x) < .35, '没对着牌子中间');
});

// ⚠️贴着牌子站会穿模（花圃那次的教训）：半个身子 0.35
test('站在牌子前面，但不插进牌子里', () => {
  const gap = Math.abs(spot.z - panel.z) - panel.d / 2;
  assert.ok(gap > .35, '离牌面只有 ' + gap.toFixed(2) + ' 米');
  assert.ok(gap < 1.2, '站得太远就不像在看板子了');
  assert.equal(walkable(spot.x, spot.z, 'garden'), true);
  assert.ok(findPath(freshState().position, spot, 'garden')?.length);
});

// 点牌子那一下：手指落在牌面前的地上，要落进这个圈里
test('点牌子点得开', () => {
  assert.ok(ring.r >= .7, '圈太小，手指差一点就落空');
  for (const z of [ring.z - .3, ring.z, ring.z + .4])
    assert.equal(hitInteraction('garden', { x: panel.x, z })?.kind, 'board', 'z=' + z.toFixed(2) + ' 点不到');
  assert.ok(Math.hypot(spot.x - ring.x, spot.z - ring.z) <= ring.r, '站定的地方不在圈里');
});
