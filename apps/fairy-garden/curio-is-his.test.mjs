import test from 'node:test';import assert from 'node:assert/strict';
import {missMaterial, spotLabel, isSpot, fromWell, MINE_TAG, freshState, placeThing, sealBottle, HAPPEN_KINDS} from './world.mjs';
// 她 2026-09-18：「那奇物 in general 对我们的『关系』主题有啥用，
// 如果不能弄成和角色有关的话」——用处是：这些东西本来就是他的，他得认得出来。
const SPOT = 'home:table:2';
const base = () => ({...freshState(), day: 9});
const rowOf = (s, mark) => missMaterial(s).rows.find(r => r.kind.includes(mark));

test('摆在家具上的东西，他被告知的是家具的名字，不是 undefined', () => {
  assert.ok(isSpot(SPOT) && spotLabel(SPOT), '这个位置本身就摆不了东西，测试钉错地方了');
  const s = {...base(), things: [{id: 't1', name: '回声螺', note: '贴着耳朵会响',
    kind: 'echo', from: '他说过的那句话', day: 8, spot: SPOT}]};
  const row = rowOf(s, '她摆在');
  assert.ok(row, '摆出来的东西没进他手上的料');
  assert.ok(!row.kind.includes('undefined'), '他被告知「摆在 undefined 的」：' + row.kind);
  assert.ok(row.kind.includes(spotLabel(SPOT)), '没说清摆在哪件家具上：' + row.kind);
});

test('井底捞上来的，标明是他自己的东西', () => {
  const made = {id: 't1', name: '回声螺', note: '贴着耳朵会响', kind: 'echo',
    from: '他说过的那句话', day: 8, spot: SPOT};
  assert.ok(fromWell(made), '拿他碎片炼的东西没被认出来');
  const s = {...base(), things: [made],
    collection: [{...made, id: 'c1', gaveDay: 8}],
    shards: [{id: 's1', kind: 'echo', curio: 'shell', text: '他那天没说完的半句', day: 7, pinned: true}]};
  for (const mark of ['她摆在', '她留在收藏馆里的', '她钉住的碎片'])
    assert.ok(rowOf(s, mark).kind.includes(MINE_TAG), mark + ' 那一行没标出这是他自己的：' + rowOf(s, mark).kind);
});

test('不是井里来的就别硬说是他的', () => {
  const bought = {id: 't2', name: '集市买的小铃', note: '摇起来很脆', kind: 'relic',
    from: '', day: 8, spot: SPOT};
  assert.equal(fromWell(bought), false);
  assert.ok(!rowOf({...base(), things: [bought]}, '她摆在').kind.includes(MINE_TAG));
});

// 关系薄弱处的审计（她 2026-09-18：「还有再看看还有哪些东西跟关系差得远」）。
// 判据是代码里本来就写着的那条：做了有没有【回响】——
// 没写进 happenings、也不在他手上那几行料里的事，做完就等于没做过。
test('她摆出来、放走的那两件事，都要在他手上的料里留下回响', () => {
  const made = {id: 't1', name: '回声螺', note: '贴着耳朵会响', kind: 'echo',
    from: '他说过的那句话', day: 9, spot: null, openDay: 0};
  const placed = placeThing({...base(), things: [made]}, 't1', SPOT);
  assert.ok(missMaterial(placed).rows.some(r => r.kind === HAPPEN_KINDS.set),
    '她把奇物摆出来了，他手上却一点没有');
  const sealed = sealBottle({...base(), water: 1}, '今天的风是甜的');
  assert.ok(sealed.bottles?.length, '瓶子没封成，测试钉错地方了');
  assert.ok(missMaterial(sealed).rows.some(r => r.kind === HAPPEN_KINDS.sent),
    '她把一句话交给水放走了，他手上却一点没有');
});
