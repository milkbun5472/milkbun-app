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
  // ⚠️桩照真的那一份写：readSaves 会扫 localStorage 认回没登记的存档
  const localStorage = {
    get length() { return Object.keys(mem).length; },
    key: i => Object.keys(mem)[i],
    removeItem: k => { delete mem[k]; }
  };
  return new Function('loadJSON', 'saveJSON', 'KEY', 'localStorage',
    shell + ';return {WORLDS,INDEX_KEY,saveKeyOf,readSaves,saveMeta};')(
    (k, d) => (k in mem ? mem[k] : d), (k, v) => { mem[k] = v; return true; }, 'x_fairyGarden', localStorage);
};

// 她 2026-09-18：「这块没删其他的」——占位的那三个世界全撤了。
// ⚠️许了三件谁都没在做的事，别人打开看见的就是三张空头支票。
test('世界页：只列真进得去的，占位的一个都不许留', () => {
  const { WORLDS } = build({});
  assert.equal(WORLDS.length, 2, '这里只开放庭院和列车');
  assert.equal(WORLDS[0].id, 'garden');
  assert.ok(WORLDS[0].note, '连一句说明都没有');
  assert.doesNotMatch(host, /敬请期待/, '「敬请期待」那一档渲染要跟着那三行一起走');
  assert.doesNotMatch(host, /晨雾学院|潮汐集市|云上列车/);
  assert.doesNotMatch(host, /disabled: !!dim/, '点不动的卡片没有对象了，不许留着当死代码');
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

test('名册对不上时以存档本身为准——不许让一段日子从界面上消失', () => {
  // 她 2026-09-16：「我回不到有花园的小屋了」。名册只是目录，存档才是那段日子。
  const { readSaves, saveKeyOf } = build({
    x_fairyGardenSaves: [],
    'x_fairyGarden:g_lost': { world: { day: 9 } },
    'x_fairyGarden::c1::room::r1': { world: { day: 3 } }
  });
  const rows = readSaves();
  assert.equal(rows.length, 2, '扫不回来的存档就等于丢了');
  const room = rows.find(r => r.key && r.key.indexOf('::room::') > -1);
  assert.ok(room, '聊天里那间房的存档也要认回来');
  assert.equal(room.name, '聊天里的庭院房');
  // ⚠️房间那种键自带冒号，拼不回来——必须整把钥匙一起记
  assert.equal(saveKeyOf(room), 'x_fairyGarden::c1::room::r1');
  assert.equal(saveKeyOf(rows.find(r => r.id === 'g_lost')), 'x_fairyGarden:g_lost');
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

// ⚠️钉的是【这句话要保住什么】，不是整句原文：措辞她随时会改
// （施工规则/anchor-on-code.md）。要保的两件——说清删不回来、先叫她导出一份
// （.claude/rules/never-say-delete-first.md）。
test('删一档是不可逆的，必须先让她看见这句话', () => {
  assert.match(host, /requestAppConfirm\("删掉这一档？"/);
  assert.match(host, /找不回来/, '没说清这是删不回来的');
  assert.match(host, /导出全部数据/, '没先叫她导出一份就让她删');
});

test('庭院房那条路不走这两页：一间房就是一个世界一个存档', () => {
  assert.match(host, /if \(props\.storeKey \|\| props\.lockPartnerId\) return h\(WorldSession, props\);/);
  // 选存档进去要整屏换掉：storeKey 是在 GardenSession 第一次渲染时钉死的。
  // openId 存的是整把钥匙（房间那种键拼不回来），所以这儿直接当 storeKey 用。
  assert.match(host, /key: openId, storeKey: openId/);
});
