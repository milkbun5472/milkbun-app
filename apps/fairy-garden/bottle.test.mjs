import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,restoreState,BOTTLE_DAYS,BOTTLE_CAP,sealError,sealBottle,sealedToday,
 driftPick,driftError,drawBottle,floating,craftThing,donate} from './world.mjs';
// 她 2026-09-17：「漂流瓶做吧宝宝」。
// ⚠️它一个字都不生成：漂回来的全是【已经在存档里的东西】。
const note = (id, reply, day) => ({ id, kind: 'today', ask: '', reply, day, pinned: false });
const shard = (id, text, day) => ({ id, kind: 'echo', text, whole: false, depth: 1, day, pinned: false });

test('自己封的那只要过几天才漂回来，当天捞不到', () => {
  let s = sealBottle({ ...freshState(), day: 10 }, '记住今天下午的光。');
  assert.equal(s.bottles.length, 1);
  assert.equal(s.bottles[0].openDay, 10 + BOTTLE_DAYS);
  assert.equal(driftPick(s), null, '当天就能捞到自己刚写的，那是记事本不是漂流瓶');
  assert.deepEqual(floating(s).map(b => b.backIn), [BOTTLE_DAYS]);
  const later = { ...s, day: 10 + BOTTLE_DAYS };
  assert.equal(driftPick(later).kind, 'mine');
  assert.equal(driftPick(later).text, '记住今天下午的光。');
  assert.deepEqual(floating(later), [], '到日子了就不该还算漂着');
});

test('一天只封一只，空话封不动', () => {
  const s = sealBottle({ ...freshState(), day: 3 }, '一句话');
  assert.equal(sealedToday(s), true);
  assert.match(sealError(s, '再来一句'), /今天已经放了一只/);
  assert.equal(sealBottle(s, '再来一句'), s);
  assert.match(sealError(freshState(), '   '), /写一句再封/);
  assert.match(sealError({ ...freshState(), day: 99, bottles: Array.from({length:BOTTLE_CAP},(_,i)=>({id:'b'+i,text:'x',day:1,openDay:2,taken:false})) }, '还想放'), /六十只/);
});

test('捞上来的是旧东西，一天一只，同一天捞的永远是同一片', () => {
  const s = { ...freshState(), day: 20, epoch: 'save-a',
    notes: [note('n1', '那天你在楼下等我。', 4)], shards: [shard('s1', '铁锈味，混着雨。', 9)] };
  const first = driftPick(s);
  assert.deepEqual(driftPick(s), first, '同一天捞两次给两样，就成了摇奖机');
  assert.notDeepEqual(driftPick({ ...s, day: 21 }), first, '换一天还是同一片，那水就是死的');
  const out = drawBottle(s);
  assert.equal(out.drifts.length, 1);
  assert.equal(out.drifts[0].text, first.text);
  assert.equal(out.drifts[0].day, 20, '记的是【今天捞到的】');
  assert.match(driftError(out), /今天已经捞过/);
  assert.equal(drawBottle(out), out);
  assert.match(driftError({ ...s, map: 'home' }), /水在庭院里/);
});

// ⚠️它不是第二个背包：捞上来不产生任何新库存，原来那一片还在原来那儿。
test('捞一只不多出任何东西来', () => {
  const s = { ...freshState(), day: 20, notes: [note('n1', '一句话。', 4)], shards: [shard('s1', '一片。', 9)] };
  const out = drawBottle(s);
  assert.deepEqual(out.notes, s.notes);
  assert.deepEqual(out.shards, s.shards);
  assert.deepEqual(out.things, s.things);
  assert.equal(out.collection.length, 0);
});

test('自己那只捞过就不再漂回来，会换成别的', () => {
  let s = sealBottle({ ...freshState(), day: 1, notes: [note('n1', '旧的一句。', 1)] }, '给七天后的自己。');
  s = { ...s, day: 1 + BOTTLE_DAYS };
  s = drawBottle(s);
  assert.equal(s.drifts[0].kind, 'mine');
  assert.equal(s.bottles[0].taken, true);
  const next = driftPick({ ...s, day: s.day + 1 });
  assert.notEqual(next.kind, 'mine', '自己那只捞上来还一直漂着＝永远捞不到别的');
});

test('存档里什么都还没有的时候，捞上来是个空瓶子，而且今天就这一次', () => {
  const s = { ...freshState(), day: 2 };
  assert.equal(driftPick(s), null);
  const out = drawBottle(s);
  assert.equal(out.drifts.length, 0);
  assert.match(driftError(out), /今天已经捞过/, '空瓶子不算捞过的话，她今天能一直点下去');
});

test('留在馆里的东西也会漂回来', () => {
  let s = craftThing({ ...freshState(), day: 6, shards: [shard('s1', '一段回声。', 6)] }, 's1', 'set');
  s = donate({ ...s, map: 'museum' }, s.things[0].id);
  s = { ...s, map: 'garden', day: 40 };
  const row = driftPick(s);
  assert.equal(row.kind, 'kept');
  assert.match(row.text, /回声灯/);
});

test('瓶子和捞到的记录都存得住，旧存档进来是空的', () => {
  let s = sealBottle({ ...freshState(), day: 2, notes: [note('n1', '一句。', 1)] }, '喂，还在吗。');
  s = drawBottle(s);
  const back = restoreState(s);
  assert.deepEqual(back.bottles, s.bottles);
  assert.deepEqual(back.drifts, s.drifts);
  const old = restoreState({ version: 8, day: 3 });
  assert.deepEqual(old.bottles, []);
  assert.deepEqual(old.drifts, []);
});

// ⚠️v69.48 起村落按区整体平移（VILLAGE_ZONES）：新站位不给它写区，
//   rules.js 加载时就会崩（villagePoint 读 undefined.x），整个游戏起不来。
test('捞漂流瓶站位对应月湖浅滩里的可见瓶子', async () => {
  const { MAPS } = await import('./world.mjs');
  const st = MAPS.garden.stations.bottle, site = MAPS.garden.lake.bottle;
  assert.ok(st, '站位没了，那按钮就走不过去');
  assert.ok(Math.hypot(st.x - site.x, st.z - site.z) < 1.2, '按钮走到的地方要能伸手够到浅滩瓶子');
});
