import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,restoreState,nextDay,perform,MISS_READY,MISS_CAP,MISS_WAIT,addMiss,talkedWith,
 missWanting,missWaiting,missArrived,missGaveUp,missTaken,missLetGo,missMaterial,restoreMiss,
 donate,drawBottle,sowSeed,craftThing,MAPS} from './world.mjs';
// 她 2026-09-17：「让他自己来找我说话，攒够思念就来到我身边，
//                  然后出一个他好像有话要说，我确认了才 call 模型」
const beside = s => ({ ...s, companion: { ...s.companion, map: s.map, position: { ...s.position } } });
const away = s => ({ ...s, companion: { ...s.companion, map: s.map, position: { x: s.position.x + 8, z: s.position.z + 8 } } });
const ready = s => ({ ...s, miss: { ...restoreMiss(s.miss), score: MISS_READY } });

test('攒的是真发生过的事，不是计时器', () => {
  const s0 = freshState();
  assert.equal(restoreMiss(s0.miss).score, 0);
  // 她往馆里留了一件
  let s = craftThing({ ...s0, shards: [{ id: 's1', kind: 'echo', text: '一段回声。', whole: false, depth: 1, day: 1, pinned: false }] }, 's1', 'set');
  const kept = donate({ ...s, map: 'museum' }, s.things[0].id);
  assert.ok(restoreMiss(kept.miss).score > 0, '她留了东西进馆，他一点都没感觉到');
  // 她在花笺上问了他一句
  assert.ok(restoreMiss(sowSeed(s0, 'miss', '你在吗').miss).score > 0);
  // 她捞到一只瓶子
  const drew = drawBottle({ ...s0, day: 9, notes: [{ id: 'n1', kind: 'today', ask: '', reply: '旧的一句。', day: 2, pinned: false }] });
  assert.ok(restoreMiss(drew.miss).score > 0);
});

test('她做事的时候他就在旁边，也算一笔；他不在就不算', () => {
  const base = { ...freshState(), water: 0, position: { ...MAPS.garden.stations.well } };
  const near = perform(beside(base), 'well');
  const far = perform(away(base), 'well');
  assert.ok(restoreMiss(near.miss).score > restoreMiss(far.miss).score, '他在不在场算出来一样，那这一笔就是假的');
});

test('过一天她一句话没说，是最主要的那一笔；说过话的当天不重复算', () => {
  const s = nextDay({ ...freshState(), day: 1, miss: { score: 0, day: 0, since: 1, cameAt: 0 } });
  assert.ok(restoreMiss(s.miss).score > 0);
  const talked = talkedWith({ ...s, day: s.day });
  assert.equal(restoreMiss(nextDay(talked).miss).score, restoreMiss(talked.miss).score + 4, '一天就该记一笔，不是两笔');
  assert.ok(restoreMiss({ score: 999 }).score <= MISS_CAP, '攒到天上去，那就是刷分了');
});

test('攒够了他才来；睡着的时候不来，不在同一张地图也不来', () => {
  const s = ready(beside(freshState()));
  assert.equal(missWanting(s), true);
  assert.equal(missWanting({ ...s, miss: { ...restoreMiss(s.miss), score: MISS_READY - 1 } }), false);
  assert.equal(missWanting({ ...s, sleep: { player: null, companion: 'left' } }), false, '把人从睡梦里叫起来说话');
  assert.equal(missWanting({ ...s, companion: { ...s.companion, map: 'forest' } }), false);
  assert.equal(missWanting({ ...s, miss: { ...restoreMiss(s.miss), day: s.day } }), false, '一天最多一次，不然就成了催命的');
});

test('走到身边是零调用的：那一枪要等她点头', () => {
  let s = missArrived(ready(beside(freshState())));
  assert.ok(restoreMiss(s.miss).cameAt, '到了身边要记一笔，界面靠它出那个记号');
  assert.equal(missWaiting(s), true);
  assert.equal(missWaiting(missArrived(ready(away(freshState())))), false, '人还没走到就问她要不要听');
});

// ⚠️她不理他【不许罚她】
test('她不点，他等一会儿就回自己的日程，思念一分不扣', () => {
  const s = missArrived(ready(beside({ ...freshState(), minute: 600 })));
  assert.equal(missGaveUp(s), false);
  const later = { ...s, minute: 600 + MISS_WAIT };
  assert.equal(missGaveUp(later), true);
  const gone = missLetGo(later);
  assert.equal(restoreMiss(gone.miss).score, restoreMiss(s.miss).score, '没理他就扣分＝在罚她');
  assert.equal(missWaiting(gone), false);
  assert.equal(missWanting(gone), false, '走开了又立刻回来，那就是缠着不放');
});

// ⚠️无论那一枪成不成，今天都不许再打第二次（点一次＝花一次钱）
test('她点了就记上今天这一次，再点不会再来一遍', () => {
  const s = missTaken(missArrived(ready(beside(freshState()))));
  assert.equal(restoreMiss(s.miss).day, s.day);
  assert.equal(missWanting(s), false);
  assert.ok(restoreMiss(s.miss).score < MISS_READY, '说过一轮了还满着，明天立刻又来');
});

// ⚠️他要说的话得带着一件具体的东西，否则每次都是「我想你了」
test('凑给他的料全是真发生过的东西，没有就是没有', () => {
  assert.deepEqual(missMaterial(freshState()).rows, [], '手上什么都没有的时候，不许硬凑一件出来');
  let s = { ...freshState(), day: 12,
    notes: [{ id: 'n1', kind: 'today', ask: '', reply: '那天你在楼下等我。', day: 4, pinned: false }],
    shards: [{ id: 's1', kind: 'echo', text: '伞举得很高。', whole: false, depth: 2, day: 6, pinned: true },
             { id: 's2', kind: 'dream', text: '没钉住的这片。', whole: false, depth: 2, day: 6, pinned: false }] };
  const rows = missMaterial(s).rows;
  assert.ok(rows.some(r => r.text === '那天你在楼下等我。'));
  assert.ok(rows.some(r => r.text === '伞举得很高。'));
  assert.ok(!rows.some(r => r.text === '没钉住的这片。'), '没钉住的那些是背包，不是她在意的东西');
  rows.forEach(r => { assert.ok(r.kind && r.text && r.day, '每一件都要说清是哪来的、第几天的'); });
});

test('思念存得住，旧存档进来是干净的', () => {
  const s = addMiss(freshState(), 'kept');
  assert.deepEqual(restoreState(s).miss, restoreMiss(s.miss));
  assert.equal(restoreState({ version: 8, day: 3 }).miss.score, 0);
  assert.equal(restoreState({ version: 9, miss: { score: -5, day: 'x' } }).miss.score, 0);
});

// ⚠️tick 在 mode==='routine' 时【绕开 companionPlan 直接用 plannedActivity】，
//   所以只改 companionPlan 的话，他最常处的那个模式里永远不会来（2026-09-17 实机抓到：
//   他看着是走过来了，其实只是屋檐正好在她旁边）。
test('他自己要来那一版计划只有一份，跟着走／按自己的安排都认它', async () => {
  const { missPlan, companionPlan, makeCompanionController } = await import('./companion.mjs');
  const base = { ...freshState(), day: 20, minute: 600, miss: { score: MISS_READY + 8, day: 0, since: 6, cameAt: 0 } };
  for (const mode of ['routine', 'follow', 'wait', 'goto']) {
    const s = { ...base, companion: { ...base.companion, map: 'garden', position: { x: -2, z: -1 }, mode } };
    assert.ok(missPlan(s), mode + '：他想来都来不了');
    assert.equal(companionPlan(s).id, 'miss', mode);
    const c = makeCompanionController(); c.tick(s, .05, {});
    assert.match(c.view().status, /找你说句话/, mode + '：界面上说他在干别的，其实他正朝你走——那是在骗她');
  }
  // 攒不够就各干各的
  const low = { ...base, miss: { ...base.miss, score: 1 }, companion: { ...base.companion, map: 'garden', mode: 'routine' } };
  assert.equal(missPlan(low), null);
  assert.notEqual(companionPlan(low).id, 'miss');
});
