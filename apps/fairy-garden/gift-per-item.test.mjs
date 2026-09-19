import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,giftItem,giftKey,giftOptions,giveGift,giftBook,giftCatalogue,giftQuota,stanceByRank,rolledStance,GIFT_STANCES,GIFT_ORDER} from './world.mjs';
// 她 2026-09-18：「每一档都单独吧，这样才有新鲜感，送出不同的东西可以看到不同反应」

const ready = extra => ({ ...freshState(), map: 'garden', harvest: 2, potions: 2,
  magic: { ...freshState().magic, flowers: 2 }, ...extra });

test('同一类里的两样各是各的：各有各的第一次、各有各的那几句', () => {
  let s = ready();
  s = giveGift(s, { type: 'flower' }, { stance: 'love', words: ['这个留下。'] });
  s = { ...s, day: s.day + 1 };
  s = giveGift(s, { type: 'starflower' }, { stance: 'dislike', words: ['太亮了。'] });
  const book = giftBook(s), flower = book.families.find(f => f.id === 'flower');
  assert.equal(flower.items.length, 2, '两样各占一行');
  const moon = flower.items.find(x => x.key === 'flower'), star = flower.items.find(x => x.key === 'starflower');
  assert.equal(moon.stance, 'love');
  assert.equal(star.stance, 'dislike', '同一类里态度可以完全不一样');
  assert.deepEqual(moon.said, ['这个留下。']);
  assert.deepEqual(star.said, ['太亮了。'], '第二样也有自己的第一次');
});

test('同一样再递一次，不再算第一次', () => {
  let s = ready();
  s = giveGift(s, { type: 'flower' }, { stance: 'love', words: ['这个留下。'] });
  s = giveGift({ ...s, day: s.day + 1, harvest: 2 }, { type: 'flower' }, { stance: 'love', words: ['又来一次。'] });
  const it = giftBook(s).families.find(f => f.id === 'flower').items.find(x => x.key === 'flower');
  assert.equal(it.count, 2);
  assert.deepEqual(it.said, ['这个留下。'], '那几句只在第一次说，不覆盖');
});

// ⚠️「怎么保证他不是什么都喜欢」：分布由代码切，模型只排先后
test('四档都有人占：他就算把每一样都排成最爱也没用', () => {
  const cat = giftCatalogue(), quota = giftQuota(cat.length);
  const by = stanceByRank(cat.map(x => x.key));
  const tally = {};
  for (const v of Object.values(by)) tally[v] = (tally[v] || 0) + 1;
  assert.deepEqual(tally, { love: quota.love, like: quota.like, meh: quota.meh, dislike: quota.dislike });
  for (const k of GIFT_ORDER) assert.ok(quota[k] >= 1, k + ' 一个都没有');
  assert.equal(cat.length, new Set(cat.map(x => x.key)).size, '单子里有重复的标识');
});

// 井里挖出来的那些：档位掷轴，同一档同一样永远一样
test('井里那些的档位是掷出来的，掷一百次也只掷这一档', () => {
  const a = rolledStance('c1:thing:x1');
  assert.ok(Object.hasOwn(GIFT_STANCES, a));
  for (let i = 0; i < 20; i++) assert.equal(rolledStance('c1:thing:x1'), a, '同一个种子掷出两种档位');
  const spread = new Set(Array.from({ length: 40 }, (_, i) => rolledStance('c1:thing:' + i)));
  assert.ok(spread.size >= 3, '四十样只掷出 ' + spread.size + ' 种档位，太齐了');
});

test('每一样东西都有自己的标识', () => {
  const s = ready();
  assert.equal(giftKey(giftItem(s, { type: 'flower' })), 'flower');
  assert.equal(giftKey(giftItem(s, { type: 'starflower' })), 'starflower');
  const cat = giftCatalogue();
  assert.ok(cat.some(x => x.key === 'food:tea'), '吃的每一样都在单子上');
  assert.ok(cat.every(x => x.name && x.family));
});
