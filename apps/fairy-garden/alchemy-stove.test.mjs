import test from 'node:test';import assert from 'node:assert/strict';
import {MAPS, walkable} from './world.mjs';
// 她 2026-09-18：「还有我的锅看不见啊能不能移动一下」
// 查下来锅在 (-11.6, 8)，而小屋本体是 x∈[-14.75,-11.25]、z∈[3.55,8.05]——
// 锅整个埋在房子里。锅是随「home 区整体平移」搬的，brew 站位是另一条路搬的，
// 「扩建童话大宅」把房子撑大之后两边就错开了，没人报错。
const g = MAPS.garden;
const buildings = g.obstacles.filter(o => o.h != null);
const inside = (p, o) => o.r != null
  ? Math.hypot(p.x - o.x, p.z - o.z) < o.r
  : Math.abs(p.x - o.x) < o.w / 2 && Math.abs(p.z - o.z) < o.d / 2;

test('庭院里能走过去的点，一个都不许埋在房子轮廓里', () => {
  const points = [
    ...Object.entries(g.stations).map(([id, p]) => ['站位 ' + id, p]),
    ...g.interactions.filter(i => i.kind !== 'door' && i.kind !== 'visit').map(i => ['点判 ' + i.kind, i]),
  ];
  assert.ok(buildings.length >= 6, '带高度的房子轮廓没了，这条审计就成了空转');
  for (const [name, p] of points) for (const o of buildings) {
    assert.ok(!inside(p, o), name + ' 埋在房子里了：' + JSON.stringify(p));
  }
});

test('炼金炉的模型占地和 brew 点判绑在一起，搬一个就得搬另一个', () => {
  const stove = g.obstacles.find(o => o.id === 'alchemy-stove');
  const ring = g.interactions.find(i => i.kind === 'brew');
  assert.ok(stove, '找不到炼金炉那块占地');
  assert.ok(inside(ring, stove), 'brew 点判跑到炉子外面去了——锅和点判又各走各的了');
  assert.ok((stove.r ?? Math.min(stove.w, stove.d) / 2) >= .36, '占地比锅还小，会被走穿');
});

test('煮药的站位站得住，而且不在炉子里', () => {
  const stove = g.obstacles.find(o => o.id === 'alchemy-stove');
  const spot = g.stations.brew;
  assert.ok(walkable(spot.x, spot.z, 'garden'), '煮药的站位站不住，她会被挡在外面');
  assert.ok(!inside(spot, stove), '站位在炉膛里');
  assert.equal(g.stations.craft.x, spot.x, '做东西和煮药共用一个站位，别分家');
});
