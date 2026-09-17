// 星井接到手机那一侧的钉子（游戏内部的规则在 apps/fairy-garden/depths.test.mjs）。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const game = rd('apps/fairy-garden/game.mjs');
const rules = rd('apps/fairy-garden/rules.js');
const depths = rd('apps/fairy-garden/depths.mjs');

test('只有室外地图铺草地和远树，井底和小屋都关闭外围景观', async () => {
  const {MAPS}=await import('../apps/fairy-garden/world.mjs');
  assert.match(game, /surroundings\.root\.visible=!!MAPS\[data\.map\]\.outdoor/);
  assert.equal(!!MAPS.depths.outdoor,false);assert.equal(!!MAPS.home.outdoor,false);
  assert.equal(MAPS.garden.outdoor,true);assert.equal(MAPS.forest.outdoor,true);
});

// ⚠️井底【长什么样】归 codex（分工：庭院功能我做，模型/场景他做）。
//   v69.23 他把它重画成了苔光石室，所以这儿只钉【接线那一侧的约定】：
//   渲染器给出 root/pick/update，update 按 s.depth 只显示这一层、按 picked 收起刨过的。
test('星井渲染器要守住的那几条：一次建好十二层，按层显示，刨过的收起来', () => {
  assert.match(depths, /export function makeDepths\(\)/);
  assert.match(depths, /return \{root,/);
  assert.match(depths, /pick\(ray\)/, '点不到矿脉就只能按按钮采');
  assert.match(depths, /row\.g\.visible=depth===s\.depth/);
  assert.match(depths, /row\.vein\.visible=!s\.picked\.includes\(row\.id\)/);
  assert.match(depths, /NODES/, '矿脉位置只有 rules.js 那一份，渲染器不许自己编');
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
