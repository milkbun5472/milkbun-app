import test from 'node:test';import assert from 'node:assert/strict';
import {MAPS,walkable,findPath,freshState,hitInteraction,seatsOf} from './world.mjs';
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

// 她 2026-09-18：「坐下来为什么朝向还是不对」「喂这不对吧」
// ⚠️屋里摆家具就是围着一张桌子坐：坐下的朝向要冲着那张桌子，不是冲着空墙。
test('家具自己写了朝向就照它坐；没写的才推一个，推出来要冲着近旁那张桌子', () => {
  const FACING = ['table', 'roundtable', 'dining', 'desk', 'hearth', 'island', 'kitchen'];
  for (const map of ['home', 'hall', 'neighbor1', 'neighbor2', 'neighbor3']){
    const pieces = (MAPS[map].furniture || []).filter(q => FACING.includes(q.kind));
    for (const [id, seat] of Object.entries(seatsOf(map))){
      if (!seat.piece) continue;
      const piece = (MAPS[map].furniture || [])[Number(seat.piece.split(':').pop())];
      // 写了 heading 的以它为准——那是这件家具摆在那儿的样子，不该被我猜的规则推翻
      if (piece && Number.isFinite(piece.heading)){
        assert.ok(Math.abs(Math.atan2(Math.sin(seat.heading - piece.heading), Math.cos(seat.heading - piece.heading))) < 1e-6,
          map + ':' + id + ' 没照家具自己写的朝向坐');
        continue;
      }
      const fx = Math.sin(seat.heading), fz = Math.cos(seat.heading);
      const near = pieces.map(q => ({ d: Math.hypot(q.x - seat.x, q.z - seat.z),
        ahead: (q.x - seat.x) * fx + (q.z - seat.z) * fz }))
        .sort((a, b) => a.d - b.d)[0];
      if (!near || near.d > 3) continue;        // 边上没东西可看的那几处不算
      assert.ok(near.ahead > 0, map + ':' + id + ' 背对着 ' + near.d.toFixed(1) + ' 米外那张桌子坐');
    }
  }
});

// 言秋 2026-09-18 的方子：座位记在【家具自己的坐标系】里，世界坐标现算。
// ⚠️这条是治本的凭据：把一件家具搬走、转个角度，座位必须跟着走。
test('家具搬了转了，座位跟着走——不用再手改一处坐标', () => {
  const f = (MAPS.home.furniture || []).find(q => q.kind === 'sofa');
  const before = seatsOf('home')[Object.keys(seatsOf('home')).find(k => k.includes(':sofa:'))];
  const yaw = Number.isFinite(f.heading) ? f.heading : before.heading;
  // 座位相对沙发自己的偏移：往它正面挪了一点，朝的就是它的正面
  const fwd = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const along = (before.x - f.x) * fwd.x + (before.z - f.z) * fwd.z;
  const aside = Math.abs((before.x - f.x) * fwd.z - (before.z - f.z) * fwd.x);
  assert.ok(along > 0, '坐垫该在它正面那一侧');
  assert.ok(aside < .05, '坐垫该在它正中线上，不偏出去');
  assert.ok(Math.abs(Math.atan2(Math.sin(before.heading - yaw), Math.cos(before.heading - yaw))) < 1e-6,
    '坐着的朝向就是家具自己的朝向');
});
