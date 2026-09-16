// 她 2026-09-16：「先做个进入页面，点进庭院有好几个选择…然后从这里点进庭院再来到存档
// 然后搞可以选择新建或者开启已有的选好后再进去」。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const host = fs.readFileSync(path.join(__dirname, '../js/fairy-garden.js'), 'utf8');
const shell = host.slice(host.indexOf('  const WORLDS = ['), host.indexOf('  root.FairyGardenApp ='));

const build = store => {
  const mem = Object.assign({}, store);
  return new Function('loadJSON', 'saveJSON', 'KEY',
    shell + ';return {WORLDS,INDEX_KEY,saveKeyOf,readSaves,saveMeta,mem:null};')(
    (k, d) => (k in mem ? mem[k] : d), (k, v) => { mem[k] = v; return true; }, 'x_fairyGarden');
};

test('世界页：现在只有一个能进，别的明写敬请期待', () => {
  const { WORLDS } = build({});
  assert.equal(WORLDS.filter(w => w.ready).length, 1, '开着的世界不止一个？');
  assert.equal(WORLDS[0].id, 'garden');
  assert.ok(WORLDS.length >= 3, '占位太少，看不出这是个可以长的地方');
  WORLDS.filter(w => !w.ready).forEach(w => assert.ok(w.note, w.id + ' 连一句说明都没有'));
  assert.match(host, /w\.ready \? "可以进" : "敬请期待"/);
  assert.match(host, /onClick: dim \? undefined : onClick, disabled: !!dim/, '占位卡还点得动');
});

test('每一档自己一把钥匙，老那一档认回来但绝不搬家', () => {
  const { saveKeyOf, readSaves } = build({ x_fairyGarden: { version: 1, id: 'garden_old', world: { day: 7 } } });
  assert.equal(saveKeyOf('legacy'), 'x_fairyGarden', '老档的钥匙必须还是原来那把');
  assert.equal(saveKeyOf('g_abc'), 'x_fairyGarden:g_abc');
  const rows = readSaves();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'legacy');
  // ⚠️搬＝复制一份再删一份，中间断一下就少一档。名册里记一笔就够了
  assert.doesNotMatch(shell, /removeItem\(KEY\)|saveJSON\(KEY,/, '有人在搬老存档的内容');
});

test('名册里的东西当外来数据看', () => {
  const { readSaves } = build({ x_fairyGardenSaves: [null, { id: 'a' }, { id: 'b', name: 'x'.repeat(50), world: 'academy', ts: 'zz' }] });
  const rows = readSaves();
  assert.deepEqual(rows.map(r => r.id), ['a', 'b']);
  assert.equal(rows[0].world, 'garden', '没写世界的按庭院算');
  assert.equal(rows[1].name.length, 24, '名字没截断');
  assert.equal(rows[1].ts, 0, '坏时间要归零');
});

test('存档卡上写得出「这一档过到哪儿了」', () => {
  const { saveMeta } = build({ 'x_fairyGarden:g_1': { world: { day: 12 }, partnerId: 'c1' } });
  assert.deepEqual(saveMeta({ id: 'g_1' }), { day: 12, partnerId: 'c1', fresh: false });
  assert.equal(saveMeta({ id: 'g_none' }).fresh, true, '没开始过的要看得出来');
});

test('删一档是不可逆的，必须先让她看见这句话', () => {
  assert.match(host, /requestAppConfirm\("删掉这一档？"/);
  assert.match(host, /这一档里的日子、背包和聊过的话会一起删掉，找不回来。/);
});

test('庭院房那条路不走这两页：一间房就是一个世界一个存档', () => {
  assert.match(host, /if \(props\.storeKey \|\| props\.lockPartnerId\) return h\(GardenSession, props\);/);
  // 选存档进去要整屏换掉：storeKey 是在 GardenSession 第一次渲染时钉死的
  assert.match(host, /key: openId, storeKey: saveKeyOf\(openId\)/);
});
