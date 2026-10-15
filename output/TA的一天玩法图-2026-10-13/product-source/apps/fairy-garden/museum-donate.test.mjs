import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,restoreState,SHARD_KINDS,CRAFT_WAYS,craftError,craftThing,recipeIndex,RECIPE_TOTAL,recipeKey,
 donate,donateError,collectedKinds,COLLECTION_CAP,thingReady} from './world.mjs';
// 她 2026-09-17：「收藏馆和配方都做吧宝宝」。
// 配方那一半不是补空（十二格本来就是满的），是【加两条轴】：
//   完整的一片＝下潜的回报；合炉＝让那四种碎片互相认识。
// 收藏馆那一半是【出口】：屋檐、窗台、池边一共三个位置，第四样往后没地方去。
const shard = (kind, id, whole=false) => ({ id, kind, text: '一段'+kind+'。', whole, depth: 2, day: 1, pinned: false });
const withShards = (...rows) => ({ ...freshState(), shards: rows });
// ⚠️捐在馆里发生（codex v69.43 那栋楼），做东西还在庭院的锅前：两处地图不一样
const inMuseum = s => ({ ...s, map: 'museum' });

test('配方一共三十种：十二 ＋ 完整的十二 ＋ 合炉六', () => {
  const rows = recipeIndex();
  assert.equal(RECIPE_TOTAL, 30);
  assert.equal(rows.length, 30);
  assert.equal(new Set(rows.map(r => r.key)).size, 30, '键重了就有两种做法记成同一种');
  assert.equal(new Set(rows.map(r => r.name)).size, 30, '名字重了，笔记上就分不出是哪一条');
  rows.forEach(r => { assert.ok(r.name && r.note && r.how, r.key + ' 缺东西'); });
});

test('完整的一片做出来是另一样东西——这才是下到深处的回报', () => {
  for (const kind of Object.keys(SHARD_KINDS)) {
    for (const way of ['distill', 'set', 'ferment']) {
      const a = craftThing(withShards(shard(kind, 's1')), 's1', way).things[0];
      const b = craftThing(withShards(shard(kind, 's1', true)), 's1', way).things[0];
      assert.notEqual(a.name, b.name, kind + '/' + way + '：完整的一片跟碎的做出来一模一样，那口井就只剩一个数字在变');
      assert.notEqual(a.recipe, b.recipe);
    }
  }
});

test('合炉要两片不一样的，少一片或同种都不许开炉', () => {
  const s = withShards(shard('echo', 's1'), shard('echo', 's2'), shard('dream', 's3'));
  assert.match(craftError(s, 's1', 'fuse'), /两片/);
  assert.match(craftError(s, 's1', 'fuse', 's1'), /两片/);
  assert.match(craftError(s, 's1', 'fuse', 's2'), /一样的/);
  assert.equal(craftError(s, 's1', 'fuse', 's3'), '');
  assert.equal(craftThing(s, 's1', 'fuse', 's2'), s, '拦住了还做得出来＝闸是假的');
});

test('合炉吃掉两片，出来的是第三样；先挑谁后挑谁算的是同一条配方', () => {
  const s = withShards(shard('echo', 's1'), shard('dream', 's2'));
  const out = craftThing(s, 's1', 'fuse', 's2');
  assert.equal(out.shards.length, 0, '两片都要吃掉');
  assert.equal(out.things.length, 1);
  assert.equal(out.things[0].name, '半梦半醒的一句');
  assert.match(out.things[0].from, /／/, '两片的原文都要留着');
  const other = craftThing(withShards(shard('dream', 's2'), shard('echo', 's1')), 's2', 'fuse', 's1');
  assert.equal(other.things[0].recipe, out.things[0].recipe, '顺序不同算成两条，笔记就永远差一格');
});

test('做成过的记进炼金笔记，重复做不会记第二遍', () => {
  let s = withShards(shard('echo', 's1'), shard('echo', 's2'));
  s = craftThing(s, 's1', 'set');
  assert.deepEqual(s.made, [recipeKey('echo', 'set', false)]);
  s = craftThing(s, 's2', 'set');
  assert.equal(s.made.length, 1);
  assert.deepEqual(restoreState(s).made, s.made, '笔记要存得住');
  assert.deepEqual(restoreState({ ...s, made: ['乱写的', 'echo:set'] }).made, ['echo:set'], '不认识的键不许进笔记');
});

test('捐进馆里的东西永不删除，背包腾出来', () => {
  let s = craftThing(withShards(shard('sense', 's1')), 's1', 'set');
  const t = s.things[0];
  assert.equal(donateError(inMuseum(s), t.id), '');
  s = donate(inMuseum(s), t.id);
  assert.equal(s.things.length, 0, '捐了还占着背包＝没有出口');
  assert.equal(s.collection.length, 1);
  assert.equal(s.collection[0].gaveDay, s.day);
  assert.deepEqual(restoreState(s).collection.map(x => x.name), [t.name], '馆里那一份要存得住');
});

test('还封着的发酵物捐不出去，不在庭院里也捐不了', () => {
  const s = craftThing(withShards(shard('dream', 's1')), 's1', 'ferment');
  const t = s.things[0];
  assert.equal(thingReady(s, t), false);
  assert.match(donateError(inMuseum(s), t.id), /还封着/);
  assert.deepEqual(donate(inMuseum(s), t.id), inMuseum(s), '拦住了还捐得出去＝闸是假的');
  assert.match(donateError(s, t.id), /先走进收藏馆/, '站在庭院里就能捐＝那栋楼白盖了');
  assert.match(donateError(inMuseum(s), '没有这一件'), /先挑/);
});

test('功绩只记第一次进馆的那一种，捐十件一样的不多算一分', () => {
  let s = { ...freshState(), shards: [shard('sense', 's1'), shard('sense', 's2'), shard('echo', 's3')] };
  s = craftThing(s, 's1', 'set'); s = donate(inMuseum(s), s.things[0].id);
  assert.equal(s.deeds, 1);
  s = craftThing({ ...s, map: 'garden' }, 's2', 'set'); s = donate(inMuseum(s), s.things[0].id);
  assert.equal(s.deeds, 1, '同一种捐第二件还加分＝这就成了一条刷分的路');
  assert.equal(collectedKinds(s), 1);
  s = craftThing({ ...s, map: 'garden' }, 's3', 'set'); s = donate(inMuseum(s), s.things[0].id);
  assert.equal(s.deeds, 2);
  assert.equal(collectedKinds(s), 2);
  assert.equal(s.collection.length, 3, '件数照记，只有种数不重复算');
});

test('馆里摆满了就说摆满了，不悄悄挤掉最早那一件', () => {
  const full = Array.from({ length: COLLECTION_CAP }, (_, i) => ({ id: 'c' + i, name: '旧物' + i, kind: 'relic', way: 'set', day: 1, gaveDay: 1 }));
  let s = craftThing({ ...withShards(shard('relic', 's1')), collection: full }, 's1', 'set');
  assert.match(donateError(inMuseum(s), s.things[0].id), /摆满/);
  assert.deepEqual(donate(inMuseum(s), s.things[0].id), inMuseum(s), '摆满了还悄悄塞进去＝最早那件被挤掉了');
});

test('旧存档进来照样有笔记和馆，一件东西都不丢', () => {
  const old = restoreState({ version: 8, things: [{ id: 't1', name: '雨铃', note: '挂在屋檐下。', kind: 'sense', way: 'set', day: 3 }] });
  assert.equal(old.version, 9);
  assert.deepEqual(old.made, []);
  assert.deepEqual(old.collection, []);
  assert.equal(old.things.length, 1, '版本一换就把她做过的东西丢了，那比不升级还坏');
});

test('v69.41 之前做的老东西没有配方号，也不许一件一分', () => {
  const legacy = { id: 't1', name: '雨铃', note: '挂在屋檐下。', kind: 'sense', way: 'set', day: 2 };
  let s = { ...freshState(), things: [legacy, { ...legacy, id: 't2' }] };
  s = donate(inMuseum(s), 't1');
  assert.equal(s.deeds, 1);
  s = donate(inMuseum(s), 't2');
  assert.equal(s.deeds, 1, '没有配方号就每件都算新的一种＝又一条刷分的路');
  assert.equal(collectedKinds(s), 1);
});

// ⚠️留下的那几件必须还在展架上。donate 会把它们从 things 里拿走，
//   museumCollection 只读 things 的话，「留下一件」的结果是它当场从架子上消失——正好是反的。
test('留在馆里的那几件照样摆在炼金陈列架上', async () => {
  const { museumCollection, museumCaption } = await import('./museum.mjs');
  let s = craftThing({ ...freshState(), shards: [{ id: 's1', kind: 'echo', text: '一段回声。', whole: false, depth: 1, day: 1, pinned: false }] }, 's1', 'set');
  const name = s.things[0].name;
  s = donate({ ...s, map: 'museum' }, s.things[0].id);
  assert.equal(s.things.length, 0);
  assert.deepEqual(museumCollection(s).alchemy.map(x => x.name), [name], '捐完就从架子上没了');
  assert.match(museumCaption(s, 'alchemy'), /留在这儿的/);
});
