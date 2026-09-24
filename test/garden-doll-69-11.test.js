// 她 2026-09-16：「codex 搞模型…他做好一版人物模型了，你去看看接进来吧」。
// 接的是 art/fairy-garden 那套脚本长出来的布偶：一个身体 ＋ 十二款头发。
// ⚠️这份钉的是三个真踩过的坑，不是形状好不好看（那是美术那边的事）。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const trav = rd('apps/fairy-garden/traveler.mjs');
const game = rd('apps/fairy-garden/game.mjs');
const exp = rd('art/fairy-garden/export_traveler.py');
const clay = rd('art/fairy-garden/clay_doll.py');
const doll = rd('art/fairy-garden/doll_hair.py');

test('美术源和运行时模型是两个文件，导出不许烧掉自己的输入', () => {
  // 第一次跑就把 traveler.glb（doll_hair.SRC 读的那一份）覆盖了，靠 git 才捞回来
  assert.ok(fs.existsSync(path.join(__dirname, '../art/fairy-garden/base_traveler.glb')), '美术源不在 art/ 里');
  assert.ok(fs.existsSync(path.join(__dirname, '../apps/fairy-garden/doll.glb')), '运行时模型没导出来');
  assert.ok(!fs.existsSync(path.join(__dirname, '../apps/fairy-garden/traveler.glb')), 'apps/ 里还留着旧的美术源');
  assert.match(doll, /SRC = os\.path\.join\(os\.path\.dirname\(os\.path\.abspath\(__file__\)\), 'base_traveler\.glb'\)/);
  assert.match(exp, /'apps',\s*'fairy-garden',\s*'doll\.glb'/);
  assert.ok(fs.existsSync(path.join(__dirname, '../art/fairy-garden/clay-reference.glb')));
  assert.match(game, /loadAsync\('\.\/doll\.glb/);
});

test('头发名字里不许带点——GLTFLoader 会把点洗掉', () => {
  // 带点的那一版接进去：十二款头发全都显示，糊成一颗白球（渲染三角形从 25 万涨到 51 万）
  assert.match(clay, /replace\('hair\.',\s*'hair_'\)/);
  assert.match(trav, /const isHair=o=>\/\^hair\[\._\]\/i\.test\(o\.name\)/);
  assert.match(trav, /hairName='hair_'\+style/);
  assert.doesNotMatch(trav, /o\.name\.startsWith\('hair\.'\)/, '还有地方按带点的名字认头发');
});

test('每个实例自己一份材质——clone(true) 只克隆节点', () => {
  assert.match(trav, /const mine=new Map\(\)/);
  assert.match(trav, /if\(!mine\.has\(o\.material\)\)mine\.set\(o\.material,o\.material\.clone\(\)\)/);
  assert.match(trav, /o\.material=mine\.get\(o\.material\)/);
});

test('枢轴由新模型导出，随同一套体型形变更新', () => {
  assert.match(trav, /o.userData.dollRig/);
  assert.match(trav, /rigMorphs/);
  assert.match(trav, /fitRig\(n.dims\)/);
  assert.match(clay, /q=deform\(p,dummy,key\)-p/);
});

test('十二款是数据不是十二个模型，存档能指定样貌', () => {
  assert.match(trav, /export const HAIR_STYLES=\['korean','wolf','mullet','curtains','comma','pixie','bob','hush','airbang','wavy','bun','ponytail'\]/);
  const labels = JSON.parse(rd('art/fairy-garden/hairstyles.json'));
  const runtime = trav.match(/HAIR_STYLES=\[([^\]]+)\]/)[1].split(',').map(s => s.trim().replace(/'/g, ''));
  assert.deepEqual(runtime.slice().sort(), Object.keys(labels).sort(), '运行时那份名单和美术目录对不上');
  assert.match(trav, /setLook\(next\)/);
  assert.match(game, /if\(data\.look\)playerAvatar\.setLook\(data\.look\)/);
});
