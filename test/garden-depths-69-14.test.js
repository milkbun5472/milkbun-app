// 星井接到手机那一侧的钉子（游戏内部的规则在 apps/fairy-garden/depths.test.mjs）。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const game = rd('apps/fairy-garden/game.mjs');
const rules = rd('apps/fairy-garden/rules.js');
const depths = rd('apps/fairy-garden/depths.mjs');

test('井底不铺草地和远树——外面那层景是关掉的', () => {
  assert.match(game, /surroundings\.root\.visible=!underground/);
  // 关了就得自己有一块地，不然镜头直接看见空背景
  assert.match(depths, /mesh\(cyl,'#23252f',0,\.02,0,30,\.04,30\)/);
});

test('墙只在镜头背面长高', () => {
  // 四米高的一圈石柱，斜视角下会把井底整个挡住（试出来的）
  assert.match(depths, /const near=\(x\+z\)>1\.6,h=near\?/);
});

test('每一层的矿脉不许长进石壁里', () => {
  // 采集是站到 z+.48 去刨的，太靠外那个落脚点就嵌进墙里，路径算不出来
  assert.match(rules, /const a=\(depth\*2\.1\+i\*2\.4\),r=1\.15\+\(\(depth\*7\+i\*3\)%5\)\*\.22;/);
});

test('副标题只有一处在写——另一处写了也会被每分钟那次盖掉', () => {
  assert.equal((game.match(/place-subtitle'\)\.textContent=/g) || []).length, 1);
  assert.match(game, /第 '\+data\.depth\+' 层 · 往下还通 /);
});

test('井底那张图的字要亮，不然深色底上看不见', () => {
  assert.match(rd('apps/fairy-garden/style.css'), /body\.depths h1[^}]*color:#cdd4e6/);
  assert.match(game, /classList\.toggle\('depths',down\)/);
});
